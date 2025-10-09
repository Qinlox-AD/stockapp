// srv/stock-service.js (example path)
const cds = require('@sap/cds');
const ExcelJS = require('exceljs');

const { SELECT, INSERT, UPDATE, UPSERT, DELETE } = cds.ql;

module.exports = cds.service.impl(async function () {
  // 🔑 Use the **service** entities (not cds.entities / db namespace)
  const { PhysicalStock, SerialNumbers, TopHURegistry } = this.entities;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  this.before('CREATE', PhysicalStock, validatePhysicalStock);

  this.on('ConfirmTopHU', confirmTopHU);
  this.on('ConfirmStock', confirmStock);
  this.on('ScanSerial', scanSerial);
  this.on('ConfirmSerials', confirmSerials);
  this.on('ConfirmStockWithSerials', confirmStockWithSerials);
  this.on('ExportBin', exportBin);
  this.on('ExportPhysicalStockExcel', exportPhysicalStockExcel);

  // -----------------------------------------`----------------------------------
  // Hooks / Validators
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function confirmTopHU(req) {
    const tx = cds.tx(req);
    const { warehouse, storageBin, topHU, packMat } = req.data.input || {};

    try {
      // --- Check if TopHURegistry already has the record
      const exists = await tx.run(
        SELECT.one.from(TopHURegistry).where({ warehouse, storageBin, topHU })
      );

      if (exists) {
        return req.reject(409, `Top HU ${topHU} already exists in warehouse ${warehouse}.`);
      }

      await tx.run(
        INSERT.into(TopHURegistry).entries({ warehouse, storageBin, topHU })
      );
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

    try {
      const e = req.data?.entry || {};
      const ID = cds.utils.uuid();

      const row = {
        ID,
        warehouse: e.warehouse ?? null,
        storageBin: e.storageBin ?? null,
        topHU: e.topHU ?? null,
        stockHU: e.stockHU ?? null,
        packMatTopHU: e.packMatTopHU ?? null,
        packMatStockHU: e.packMatStockHU ?? null,
        product: e.product ?? null,
        batch: e.batch ?? null,
        quantity: e.quantity == null ? 0 : Number(e.quantity),
        uom: e.uom ?? null
      };

      try {
        await tx.run(INSERT.into(PhysicalStock).entries(row));
      } catch (err) {
        const handled = _buildDuplicateConstraintMessage(err, req, {
          warehouse: row.warehouse,
          stockHU: row.stockHU,
          product: row.product
        });
        if (handled) return handled;
        throw err; // stop pretending — this is a real failure
      }

      return tx.run(
        SELECT.one
          .from(PhysicalStock)
          .columns(
            'ID',
            'warehouse',
            'storageBin',
            'topHU',
            'stockHU',
            'product',
            'quantity',
            'uom'
          )
          .where({ ID })
      );
    } catch (err) {
      return req.reject(400, `ConfirmStock failed: ${err.message}`);
    }
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


  async function confirmStockWithSerials(req) {
    const tx = cds.tx(req);

    try {
      const { entry = {}, serials = [] } = req.data || {};
      const {
        warehouse, storageBin, topHU = null, stockHU = null,
        product = null, batch = null, uom = null
      } = entry;

      if (!warehouse || !storageBin) return req.reject(400, 'warehouse & storageBin required');
      if (serials.length && !product) return req.reject(400, 'Product is required when confirming serials');

      const hostKey = { warehouse, storageBin, topHU, stockHU, product };

      let host = await tx.run(SELECT.one.from(PhysicalStock).where(hostKey).forUpdate());
      if (!host) {
        const ID = cds.utils.uuid();
        try {
          await tx.run(
            INSERT.into(PhysicalStock).entries({
              ID, ...hostKey, batch, uom, quantity: 0, isTopHURecord: false
            })
          );
          host = { ID, ...hostKey };
        } catch (err) {
          const handled = _buildDuplicateConstraintMessage(err, req, { warehouse, topHU, stockHU, product });
          if (handled) return handled;
          throw err;
        }
      }

      const normalized = [...new Set(
        (serials || []).map(s => String(s).trim().toUpperCase()).filter(Boolean)
      )];

      if (normalized.length) {
        const rows = normalized.map(sn => ({
          physicalStockId: host.ID,
          warehouse, storageBin, topHU, stockHU, product,
          serialNumber: sn
        }));

        try {
          await tx.run(UPSERT.into(SerialNumbers).entries(rows));
        } catch (err) {
          const handled = _buildDuplicateConstraintMessage(err, req, { warehouse, product });
          if (handled) return handled;
          throw err;
        }
      }

      const { count } = await tx.run(
        SELECT.one`count(*) as count`.from(SerialNumbers).where({ physicalStockId: host.ID })
      );

      await tx.run(UPDATE(PhysicalStock, host.ID).set({ quantity: count }));

      return { quantity: count, id: host.ID };
    } catch (err) {
      return req.reject(400, `ConfirmStockWithSerials failed: ${err.message}`);
    }
  }


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

  async function exportPhysicalStockExcel(req) {
    const tx = cds.tx(req);
    try {
      const { warehouse } = req.data;

      const stockRows = await tx.run(
        SELECT.from(PhysicalStock)
          .where({ warehouse })
          .orderBy('topHU', 'stockHU', 'product')
      );

      const serialRows = await tx.run(
        SELECT.from(SerialNumbers)
          .where({ warehouse })
          .orderBy('physicalStockId', 'serialNumber')
      );

      const wb = new ExcelJS.Workbook();

      // --- Sheet 1: Stock
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

      // --- Sheet 2: Serials
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

      // Optional cosmetics
      [ws1, ws2].forEach(ws => {
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.getRow(1).font = { bold: true };
      });

      const buf = await wb.xlsx.writeBuffer(); // ArrayBuffer
      return Buffer.from(buf); // LargeBinary
    } catch (err) {
      return req.reject(400, `Excel export failed: ${err.message}`);
    }
  }

  // const MESSAGES = {
  //   SN_PER_LOC_PROD: p =>
  //     `Duplicate serial ${p._display} already exist for warehouse ${p.warehouse}.`,
  //   STOCKHU_PER_WH: p =>
  //     `Duplicate Stock HU ${p._display} already exist for warehouse ${p.warehouse}.`,
  //   TOPHU_PER_WH: p =>
  //     `Duplicate Top HU ${p._display} already exist for warehouse ${p.warehouse}.`,
  // };

  // const TABLE_TO_CONSTRAINT = {
  //   INVENTORY_TOPHUREGISTRY: 'TOPHU_PER_WH',
  //   INVENTORY_PHYSICALSTOCK: 'STOCKHU_PER_WH',
  //   INVENTORY_SERIALREGISTRY: 'SN_PER_LOC_PROD',
  // };

  // function _buildDuplicateConstraintMessage(err, req, params = {}) {
  //   const msg = String(err?.message || '');
  //   if (!/unique constraint (violated|violation)/i.test(msg)) return null;

  //   const indexName =
  //     (msg.match(/Index\(([^)]+)\)/i)?.[1]) ||
  //     (msg.match(/indexname=([^\s;]+)/i)?.[1]) ||
  //     '';

  //   const tableNameRaw =
  //     (msg.match(/Table\(([^)]+)\)/i)?.[1]) ||
  //     (msg.match(/for table [^:]*:([A-Z0-9_:$]+)/i)?.[1]) ||
  //     '';
  //   const tableName = tableNameRaw.toUpperCase();

  //   let values = [];
  //   const valueMatch = msg.match(/value='([^']+)'/i);
  //   const keyMatch = msg.match(/key=([^\s;]+)/i);
  //   if (valueMatch) {
  //     const raw = valueMatch[1];
  //     const parts = raw.includes(';') ? raw.split(';') : [raw];
  //     values = [...new Set(parts.map(v => v.trim()).filter(Boolean))];
  //   } else if (keyMatch) {
  //     values = [keyMatch[1]];
  //   }

  //   const display =
  //     values.length === 0
  //       ? (params.topHU || params.stockHU || 'one or more values')
  //       : values.join(', ');

  //   let key =
  //     Object.keys(MESSAGES).find(k => indexName.includes(k) || msg.includes(k)) ||
  //     Object.entries(TABLE_TO_CONSTRAINT).find(([tbl]) => tableName.includes(tbl))?.[1] ||
  //     null;

  //   if (!key) return null;

  //   const payload = { ...params, _display: display };
  //   return req.reject(409, MESSAGES[key](payload));
  // }
});
