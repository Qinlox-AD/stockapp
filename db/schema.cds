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
  quantity       : Decimal(13, 1);
  uom            : String(3);
}


entity ValidationStock : managed {
  key warehouse    : String(10);
  key product      : String(40);
  key batch        : String(20);
      batchManaged : Boolean default false;
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

      topHU           : String(30);
      stockHU         : String(30);
}

entity TopHURegistry : managed {
  key warehouse  : String(10);
  key topHU      : String(30);
      storageBin : String(20);
}
