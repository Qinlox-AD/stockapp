namespace inventory;

using {
  cuid,
  managed
} from '@sap/cds/common';

entity PhysicalStock : cuid, managed {
  warehouse      : String(10);
  storageBin     : String(20);
  topHU          : String(30);
  packMatTopHU   : String(40);
  stockHU        : String(30);
  packMatStockHU : String(40);
  product        : String(40);
  batch          : String(20);
  quantity       : Decimal(13, 3);
  uom            : String(3);
}


@assert.unique: {sn_per_loc_prod: [
  warehouse,
  product,
  serialNumber
]}
entity SerialNumbers : managed {
  key physicalStockId : UUID;
  key serialNumber    : String(40);

      physicalStock   : Association to PhysicalStock
                          on physicalStock.ID = physicalStockId;

      warehouse       : String(10);
      storageBin      : String(20);
      product         : String(40);

      // HU fields can stay nullable if that’s intended
      topHU           : String(30);
      stockHU         : String(30);
}

// --- Top HU registry, unique by business keys
entity TopHURegistry : managed {
  key warehouse  : String(10);
  key storageBin : String(20);
  key topHU      : String(30);
}

view PhysicalStockQuantities as select from inventory.PhysicalStock {
  key warehouse,
  key storageBin,
  key topHU,
  key packMatTopHU,
  key stockHU,
  key packMatStockHU,
  key product,
  key batch,
  key uom,
  sum(quantity) as totalQuantity : Decimal(15,3)
}
group by
  warehouse,
  storageBin,
  topHU,
  packMatTopHU,
  stockHU,
  packMatStockHU,
  product,
  batch,
  uom;

