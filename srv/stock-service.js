const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { PhysicalStock, SerialNumbers, TopHURegistry } = this.entities;

  // --- Validations
  this.before('CREATE', PhysicalStock, req => {
    const { product, quantity } = req.data;
    if (product && quantity == null) {
      return req.reject(400, 'Quantity is required when Product is provided');
    }
    if (quantity != null && isNaN(Number(quantity))) {
      return req.reject(400, 'Quantity must be numeric');
    }
    if (!product && quantity != null) {
      return req.reject(400, 'Product is required when Quantity is provided');
    }
  });

  // --- TopHU confirm
  this.on('ConfirmTopHU', async req => {
    const { warehouse, storageBin, topHU, packMat } = req.data;
    const exists = await SELECT.one.from(TopHURegistry).where({ warehouse, storageBin, topHU });
    if (!exists) {
      await INSERT.into(TopHURegistry).entries({ warehouse, storageBin, topHU });
      const rec = await INSERT.into(PhysicalStock).entries({
        warehouse, storageBin, topHU, packMatTopHU: packMat, isTopHURecord: true
      }).returning('*');
      return rec[0];
    }
    return await SELECT.one.from(PhysicalStock).where({ warehouse, storageBin, topHU, isTopHURecord: true });
  });

  // --- Stock confirm
  this.on('ConfirmStock', async req => {
    const { entry } = req.data;
    return (await INSERT.into(PhysicalStock).entries(entry).returning('*'))[0];
  });

  // --- Serial scanning
  this.on('ScanSerial', async req => {
    const { physicalStockId, serial } = req.data;
    const host = await SELECT.one.from(PhysicalStock).where({ ID: physicalStockId });
    if (!host?.product) return req.reject(400, 'Cannot scan serials without Product');

    const dup = await SELECT.one.from(SerialNumbers).where({ physicalStockId, serialNumber: serial });
    if (dup) return req.reject(409, 'Duplicate serial number');

    await INSERT.into(SerialNumbers).entries({
      physicalStockId,
      warehouse: host.warehouse,
      storageBin: host.storageBin,
      topHU: host.topHU,
      stockHU: host.stockHU,
      product: host.product,
      serialNumber: serial
    });

    const { count } = await SELECT.one`count(*) as count`.from(SerialNumbers).where({ physicalStockId });
    await UPDATE(PhysicalStock, physicalStockId).set({ quantity: count });
    return { ok: true, quantity: count };
  });

  // --- Export bin
  this.on('ExportBin', async req => {
    const { warehouse, storageBin } = req.data;
    const rows = await SELECT.from(PhysicalStock)
      .where({ warehouse, storageBin, isTopHURecord: false })
      .orderBy('topHU', 'stockHU', 'product');
    // TODO: build and return CSV/XLSX
    return JSON.stringify(rows);
  });
});
