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

  // ---------------------------------------------------------------------------
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
    try {
      const { warehouse, storageBin, topHU, packMat } = req.data.input || {};

      const exists = await tx.run(
        SELECT.one.from(TopHURegistry).where({ warehouse, storageBin, topHU })
      );

      if (!exists) {
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
            packMatTopHU: packMat,
            isTopHURecord: true
          })
        );

        // Return exactly the columns promised by PhysicalStockResult
        return tx.run(
          SELECT.one.from(PhysicalStock).columns(
            'ID',
            'warehouse',
            'storageBin',
            'topHU',
            'stockHU',
            'product',
            'quantity',
            'uom',
            'isTopHURecord'
          ).where({ ID })
        );
      }

      // Already registered -> return existing TopHU record with exact column list
      return tx.run(
        SELECT.one.from(PhysicalStock).columns(
          'ID',
          'warehouse',
          'storageBin',
          'topHU',
          'stockHU',
          'product',
          'quantity',
          'uom',
          'isTopHURecord'
        ).where({ warehouse, storageBin, topHU, isTopHURecord: true })
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
        packMatTopHU:  e.packMatTopHU ?? null,
        packMatStockHU: e.packMatStockHU ?? null,
        product: e.product ?? null,
        batch: e.batch ?? null,
        quantity: e.quantity == null ? 0 : Number(e.quantity),
        uom: e.uom ?? null,
        isTopHURecord: false
      };

      await tx.run(INSERT.into(PhysicalStock).entries(row));

      // Return exactly the columns promised by PhysicalStockResult
      return tx.run(
        SELECT.one.from(PhysicalStock).columns(
          'ID',
          'warehouse',
          'storageBin',
          'topHU',
          'stockHU',
          'product',
          'quantity',
          'uom',
          'isTopHURecord'
        ).where({ ID })
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

      let host = await tx.run(
        SELECT.one.from(PhysicalStock).where(hostKey).forUpdate()
      );

      if (!host) {
        const ID = cds.utils.uuid();
        await tx.run(
          INSERT.into(PhysicalStock).entries({
            ID,
            ...hostKey,
            batch,
            uom,
            quantity: 0,
            isTopHURecord: false
          })
        );
        host = { ID, ...hostKey };
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
        await tx.run(UPSERT.into(SerialNumbers).entries(rows));
      }

      const { count } = await tx.run(
        SELECT.one`count(*) as count`.from(SerialNumbers).where({ physicalStockId: host.ID })
      );

      await tx.run(UPDATE(PhysicalStock, host.ID).set({ quantity: count }));

      // This action returns ScanSerialsResult (quantity,id) — not the entity
      return { quantity: count, id: host.ID };
    } catch (err) {
      return req.reject(400, `ConfirmStockWithSerials failed: ${err.message}`);
    }
  }

  async function exportBin(req) {
    const tx = cds.tx(req);
    try {
      const { warehouse, storageBin } = req.data;
      // CDS: action ExportBin returns many PhysicalStock (service entity),
      // so returning the full entity rows is OK.
      const rows = await tx.run(
        SELECT.from(PhysicalStock)
          .where({ warehouse, storageBin, isTopHURecord: false })
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
});
