// srv/stock-service.js
const cds = require('@sap/cds');
const ExcelJS = require('exceljs');
const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;

module.exports = cds.service.impl(async function () {
  const { PhysicalStock, SerialNumbers, TopHURegistry } = this.entities;

  // Hooks
  this.before('CREATE', PhysicalStock, validatePhysicalStock);
  this.before('DELETE', 'PhysicalStock', deleteSerialsForStock);

  // Actions
  this.on('ConfirmTopHU', confirmTopHU);
  this.on('ConfirmStock', confirmStock);
  this.on('ConfirmStockWithSerials', confirmStockWithSerials);
  this.on('ScanSerial', scanSerial);
  this.on('ConfirmSerials', confirmSerials);
  this.on('ExportPhysicalStockExcel', exportPhysicalStockExcel);
  this.on('EditStock', editStock);
  this.on('ExportBin', exportBin);

  // ===== Actions =====
  async function exportBin(req) {
    const tx = cds.tx(req);
    try {
      const { warehouse, storageBin } = req.data;
      const rows = await tx.run(
        SELECT.from(PhysicalStock)
          .where({ warehouse, storageBin })
          .orderBy('topHU', 'stockHU', 'product')
      );
      return rows;
    } catch (err) {
      return req.reject(400, `ExportBin failed: ${err.message}`);
    }
  }

  async function editStock(req) {
    const tx = cds.tx(req);
    const { edits = [] } = req.data || {};

    if (!Array.isArray(edits) || edits.length === 0) {
      return [];
    }

    const results = [];
    const seen = new Map();

    for (const e of edits) {
      const key = JSON.stringify({
        warehouse: e.warehouse,
        storageBin: e.storageBin,
        topHU: e.topHU ?? null,
        stockHU: e.stockHU ?? null,
        product: e.product ?? null,
        currentBatch: e.currentBatch ?? null,
        uom: e.uom ?? null
      });

      seen.set(key, {
        warehouse: e.warehouse,
        storageBin: e.storageBin,
        topHU: e.topHU ?? null,
        stockHU: e.stockHU ?? null,
        product: e.product ?? null,
        currentBatch: e.currentBatch ?? null,
        newBatch: (e.newBatch ?? e.currentBatch) ?? null,
        uom: e.uom ?? null,
        qty: Math.round(Number(e.newTotalQuantity || 0) * 1000) / 1000
      });
    }

    for (const e of seen.values()) {
      const keyFields = {
        warehouse: e.warehouse,
        storageBin: e.storageBin,
        topHU: e.topHU,
        stockHU: e.stockHU,
        product: e.product,
        uom: e.uom,
        packMatTopHU: null,
        packMatStockHU: null
      };

      let rows = await tx.run(
        SELECT.from(PhysicalStock)
          .columns('ID', 'quantity', 'batch')
          .where({ ...keyFields, batch: e.currentBatch })
          .orderBy({ ref: ['createdAt'], sort: 'asc' })
          .forUpdate()
      );

      const count = rows.length;

      if (count && e.newBatch !== e.currentBatch) {
        await Promise.all(
          rows.map(r => tx.run(UPDATE(PhysicalStock, r.ID).set({ batch: e.newBatch })))
        );
        rows = rows.map(r => ({ ...r, batch: e.newBatch }));
      }

      if (count) {
        const totalMilli = Math.round(e.qty * 1000);
        const base = Math.floor(totalMilli / count);
        const remainder = totalMilli - base * count;

        for (let i = 0; i < count; i++) {
          const milli = base + (i < remainder ? 1 : 0);
          await tx.run(UPDATE(PhysicalStock, rows[i].ID).set({ quantity: milli / 1000 }));
        }
      } else {
        await tx.run(
          INSERT.into(PhysicalStock).entries({
            ...keyFields,
            batch: e.newBatch,
            quantity: e.qty,
            uom: e.uom
          })
        );
      }

      results.push({
        warehouse: e.warehouse,
        storageBin: e.storageBin,
        topHU: e.topHU,
        stockHU: e.stockHU,
        product: e.product,
        batch: e.newBatch,
        uom: e.uom,
        totalQuantity: e.qty
      });
    }

    return results;
  }

  async function confirmTopHU(req) {
    const tx = cds.tx(req);
    const { warehouse, storageBin, topHU, packMat } = req.data.input || {};

    try {
      try {
        await tx.run(
          INSERT.into(TopHURegistry).entries({ warehouse, storageBin, topHU })
        );
      } catch (err) {
        const handled = _buildDuplicateConstraintMessage(err, req, { warehouse, topHU });
        if (handled) return handled;
        throw err;
      }

      const ID = cds.utils.uuid();
      await tx.run(
        INSERT.into(PhysicalStock).entries({
          ID,
          warehouse,
          storageBin,
          topHU,
          packMatTopHU: packMat
        })
      );

      return tx.run(
        SELECT.one.from(PhysicalStock).columns(
          'ID',
          'warehouse',
          'storageBin',
          'topHU',
          'stockHU',
          'product',
          'quantity',
          'uom'
        ).where({ ID })
      );
    } catch (err) {
      return req.reject(400, `ConfirmTopHU failed: ${err.message}`);
    }
  }

  async function confirmStock(req) {
    const tx = cds.tx(req);
    const { PhysicalStock } = this.entities;

    const e = req.data?.entry || {};
    const qty = e.quantity == null ? 0 : Number(e.quantity);

    const key = {
      warehouse: e.warehouse ?? null,
      storageBin: e.storageBin ?? null,
      topHU: e.topHU ?? null,
      packMatTopHU: e.packMatTopHU ?? null,
      stockHU: e.stockHU ?? null,
      packMatStockHU: e.packMatStockHU ?? null,
      product: e.product ?? null,
      batch: e.batch ?? null,
      uom: e.uom ?? null
    };

    if (key.stockHU) {
      await validateDuplicateStockHU(req, tx, key);
    }

    const { id: ID, rowQuantity, totalQuantity } =
      await addToStockByKey(tx, PhysicalStock, key, qty);

    return { ID, ...key, quantity: rowQuantity, totalQuantity };
  }

  async function confirmStockWithSerials(req) {
    const tx = cds.tx(req);
    const { PhysicalStock, SerialNumbers } = this.entities;

    const { entry = {}, serials = [] } = req.data || {};
    const {
      warehouse, storageBin, topHU = null, stockHU = null,
      product = null, batch = null, quantity = 0, uom = null
    } = entry;

    if (!warehouse || !storageBin) return req.reject(400, 'warehouse & storageBin required');
    if (serials.length && !product) return req.reject(400, 'Product is required when confirming serials');

    const hostKey = { warehouse, storageBin, topHU, stockHU, product };
    let host = await tx.run(SELECT.one.from(PhysicalStock).where(hostKey).forUpdate());
    if (!host) {
      if (stockHU) {
        await validateDuplicateStockHU(req, tx, { warehouse, storageBin, stockHU, product, quantity, batch });
      }

      const ID = cds.utils.uuid();
      await tx.run(
        INSERT.into(PhysicalStock).entries({ ID, ...hostKey, batch, uom, quantity: 0 })
      );
      host = { ID, ...hostKey, batch, uom, quantity: 0 };
    }


    const normalized = [...new Set((serials || []).map(s => String(s).trim().toUpperCase()).filter(Boolean))];

    let addQty = 0;
    if (normalized.length) {
      const existing = await tx.run(
        SELECT.from(SerialNumbers)
          .columns('serialNumber')
          .where({ physicalStockId: host.ID, serialNumber: { in: normalized } })
      );
      const existingSet = new Set(existing.map(r => r.serialNumber));
      const toInsert = normalized.filter(sn => !existingSet.has(sn));
      if (toInsert.length) {
        await tx.run(INSERT.into(SerialNumbers).entries(
          toInsert.map(sn => ({
            physicalStockId: host.ID,
            warehouse, storageBin, topHU, stockHU, product,
            serialNumber: sn
          }))
        ));
        addQty = toInsert.length;
      }
    }

    const aggKey = buildAggregationKey({
      warehouse, storageBin, topHU,
      packMatTopHU: entry.packMatTopHU,
      stockHU, packMatStockHU: entry.packMatStockHU,
      product, batch, uom
    });

    const { id: ID, rowQuantity, totalQuantity } =
      await addToStockByKey(tx, PhysicalStock, aggKey, addQty);

    return { ID, ...aggKey, quantity: rowQuantity, totalQuantity };
  }

  async function scanSerial(req) {
    const tx = cds.tx(req);
    try {
      const { physicalStockId, serial } = req.data;

      const host = await tx.run(
        SELECT.one.from(PhysicalStock).where({ ID: physicalStockId }).forUpdate()
      );
      if (!host) return req.reject(404, 'PhysicalStock not found');
      if (!host.product) return req.reject(400, 'Cannot scan serials without Product');

      const dup = await tx.run(
        SELECT.one.from(SerialNumbers).where({ physicalStockId, serialNumber: serial })
      );
      if (dup) return req.reject(409, 'Duplicate serial number');

      await tx.run(
        INSERT.into(SerialNumbers).entries({
          physicalStockId,
          warehouse: host.warehouse,
          storageBin: host.storageBin,
          topHU: host.topHU,
          stockHU: host.stockHU,
          product: host.product,
          serialNumber: String(serial).trim().toUpperCase()
        })
      );

      const { count } = await tx.run(
        SELECT.one`count(*) as count`.from(SerialNumbers).where({ physicalStockId })
      );

      await tx.run(
        UPDATE(PhysicalStock, physicalStockId).set({ quantity: count })
      );

      return { quantity: count, id: host.ID };
    } catch (err) {
      return req.reject(400, `ScanSerial failed: ${err.message}`);
    }
  }

  async function confirmSerials(req) {
    const tx = cds.tx(req);
    try {
      const { physicalStockId, serials } = req.data;

      const host = await tx.run(
        SELECT.one.from(PhysicalStock).where({ ID: physicalStockId }).forUpdate()
      );
      if (!host) return req.reject(404, 'PhysicalStock not found');
      if (!host.product) return req.reject(400, 'Product required when confirming serials');

      await tx.run(DELETE.from(SerialNumbers).where({ physicalStockId }));

      const normalized = Array.from(new Set((serials || [])
        .map(s => String(s).trim().toUpperCase())
        .filter(Boolean)));

      if (normalized.length) {
        const rows = normalized.map(sn => ({
          physicalStockId,
          warehouse: host.warehouse,
          storageBin: host.storageBin,
          topHU: host.topHU,
          stockHU: host.stockHU,
          product: host.product,
          serialNumber: sn
        }));
        await tx.run(INSERT.into(SerialNumbers).entries(rows));
      }

      const { count } = await tx.run(
        SELECT.one`count(*) as count`.from(SerialNumbers).where({ physicalStockId })
      );

      await tx.run(
        UPDATE(PhysicalStock, physicalStockId).set({ quantity: count })
      );

      return { quantity: count, id: host.ID };
    } catch (err) {
      return req.reject(400, `ConfirmSerials failed: ${err.message}`);
    }
  }

  async function exportPhysicalStockExcel(req) {
    const tx = cds.tx(req);

    try {
      const { warehouse } = req.data;

      const stockRows = await tx.run(
        SELECT.from(PhysicalStock)
          .where({ warehouse })
          .orderBy('topHU', 'stockHU', 'product', 'storageBin')
      );

      const serialRows = await tx.run(
        SELECT.from(SerialNumbers)
          .where({ warehouse })
          .orderBy('physicalStockId', 'serialNumber')
      );

      const wb = new ExcelJS.Workbook();

      const ws1 = wb.addWorksheet('Stock');
      ws1.columns = [
        { header: 'Warehouse', key: 'warehouse', width: 12 },
        { header: 'Storage Bin', key: 'storageBin', width: 15 },
        { header: 'Top HU', key: 'topHU', width: 16 },
        { header: 'PackMat Top HU', key: 'packMatTopHU', width: 20 },
        { header: 'Stock HU', key: 'stockHU', width: 16 },
        { header: 'PackMat Stock HU', key: 'packMatStockHU', width: 20 },
        { header: 'Product', key: 'product', width: 20 },
        { header: 'Batch', key: 'batch', width: 12 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'UoM', key: 'uom', width: 8 },
      ];
      ws1.addRows(stockRows);

      const ws2 = wb.addWorksheet('SerialNumbers');
      ws2.columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 24 },
        { header: 'Warehouse', key: 'warehouse', width: 12 },
        { header: 'Storage Bin', key: 'storageBin', width: 15 },
        { header: 'Top HU', key: 'topHU', width: 16 },
        { header: 'Stock HU', key: 'stockHU', width: 16 },
        { header: 'Product', key: 'product', width: 20 }
      ];
      ws2.addRows(serialRows);

      [ws1, ws2].forEach(ws => {
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.getRow(1).font = { bold: true };
      });

      const buf = await wb.xlsx.writeBuffer();
      return Buffer.from(buf);
    } catch (err) {
      return req.reject(400, `Excel export failed: ${err.message}`);
    }
  }

  // ===== Helpers =====
  function validatePhysicalStock(req) {
    try {
      const { product, quantity } = req.data;
      if (product && quantity == null) return req.reject(400, 'Quantity is required when Product is provided');
      if (quantity != null && isNaN(Number(quantity))) return req.reject(400, 'Quantity must be numeric');
      if (!product && quantity != null) return req.reject(400, 'Product is required when Quantity is provided');
    } catch (err) {
      return req.reject(400, `Validation failed: ${err.message}`);
    }
  }

  async function validateDuplicateStockHU(req, tx, {
    warehouse,
    storageBin,
    stockHU,
    product,
    quantity,
    batch
  }) {
    const existing = await tx.run(
      SELECT.one.from(PhysicalStock)
        .columns('storageBin', 'product', 'quantity', 'batch')
        .where({ warehouse, stockHU })
    );

    if (!existing) return;

    const sameBin = existing.storageBin === storageBin;

    // Case 1: HU exists in another bin → original unchanged message
    if (!sameBin) {
      return req.reject(
        409,
        `Duplicate Stock HU ${stockHU} already exists for warehouse ${warehouse}.`
      );
    }

    // Case 2: same bin but existing entry is non-empty, and current payload is empty
    const hasData =
      existing.product != null ||
      (existing.quantity != null && Number(existing.quantity) !== 0) ||
      existing.batch != null;

    if (!product && !quantity && !batch && hasData) {
      return req.reject(
        409,
        `Cannot create empty Stock HU "${stockHU}" in warehouse ${warehouse}, bin ${storageBin} because a non-empty stock entry already exists.`
      );
    }
  }


  function buildAggregationKey(src) {
    return {
      warehouse: src.warehouse ?? null,
      storageBin: src.storageBin ?? null,
      topHU: src.topHU ?? null,
      packMatTopHU: src.packMatTopHU ?? null,
      stockHU: src.stockHU ?? null,
      packMatStockHU: src.packMatStockHU ?? null,
      product: src.product ?? null,
      batch: src.batch ?? null,
      uom: src.uom ?? null
    };
  }

  async function addToStockByKey(tx, PhysicalStock, key, addQty) {
    const existing = await tx.run(
      SELECT.one.from(PhysicalStock)
        .columns('ID', 'quantity')
        .where(key)
        .orderBy({ ref: ['createdAt'], sort: 'desc' })
    );

    if (existing) {
      const newQty = Number(existing.quantity || 0) + Number(addQty || 0);
      await tx.run(UPDATE(PhysicalStock, existing.ID).set({ quantity: newQty }));
      const sumRow = await tx.run(
        SELECT.one`coalesce(sum(quantity),0) as total`
          .from(PhysicalStock)
          .where(key)
      );
      return { id: existing.ID, rowQuantity: newQty, totalQuantity: Number(sumRow?.total || 0) };
    }

    const ID = cds.utils.uuid();
    const initQty = Number(addQty || 0);
    await tx.run(INSERT.into(PhysicalStock).entries({ ID, ...key, quantity: initQty }));
    return { id: ID, rowQuantity: initQty, totalQuantity: initQty };
  }

  async function deleteSerialsForStock(req) {
    const tx = cds.tx(req);
    try {
      const ID = req.data?.ID;

      await tx.run(
        DELETE.from('inventory.SerialNumbers').where({ physicalStockId: ID })
      );

      const host = await tx.run(
        SELECT.one.from(PhysicalStock)
          .columns('warehouse', 'storageBin', 'topHU')
          .where({ ID })
      );

      // If a Top HU is set, delete it only if this is the last stock for that (wh/bin/topHU)
      if (host?.topHU) {
        const { count } = await tx.run(
          SELECT.one`count(*) as count`
            .from(PhysicalStock)
            .where({
              warehouse: host.warehouse,
              storageBin: host.storageBin,
              topHU: host.topHU,
              ID: { '<>': ID }
            })
        ) || { count: 0 };

        if (Number(count) === 0) {
          await tx.run(
            DELETE.from(TopHURegistry).where({
              warehouse: host.warehouse,
              storageBin: host.storageBin,
              topHU: host.topHU
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to delete serials/top HU for stock:', err);
      return req.reject(500, `Failed to cleanup related data: ${err.message}`);
    }
  }


  const MESSAGES = {
    SN_PER_LOC_PROD: p =>
      `Duplicate serial ${p.serialNumber ?? ''} already exists for warehouse ${p.warehouse}.`,
    TOPHU_PER_WH: p =>
      `Duplicate Top HU ${p.topHU ?? ''} already exists for warehouse ${p.warehouse}.`,
  };

  const TABLE_TO_CONSTRAINT = {
    INVENTORY_SERIALNUMBERS: 'SN_PER_LOC_PROD',
    INVENTORY_TOPHUREGISTRY: 'TOPHU_PER_WH',
  };

  function _buildDuplicateConstraintMessage(err, req, params = {}) {
    const msg = String(err?.message || '');
    if (!/unique constraint (violated|violation)/i.test(msg)) return null;

    const indexName =
      (msg.match(/Index\(([^)]+)\)/i)?.[1]) ||
      (msg.match(/indexname=([^\s;]+)/i)?.[1]) ||
      '';

    const tableNameRaw =
      (msg.match(/Table\(([^)]+)\)/i)?.[1]) ||
      (msg.match(/for table [^:]*:([A-Z0-9_:$]+)/i)?.[1]) ||
      '';
    const tableUpper = tableNameRaw.toUpperCase();
    const tableBase = tableUpper.split('$')[0];

    const key =
      (Object.keys(MESSAGES).find(k => indexName.includes(k) || msg.includes(k))) ||
      TABLE_TO_CONSTRAINT[tableBase] ||
      null;

    if (!key) return null;

    return req.reject(409, MESSAGES[key](params));
  }
});
