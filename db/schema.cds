namespace inventory;

using { cuid, managed } from '@sap/cds/common';

// --- Core physical stock line
entity PhysicalStock : cuid, managed {
  warehouse      : String(10);
  storageBin     : String(20);
  topHU          : String(30);
  packMatTopHU   : String(40);
  stockHU        : String(30);
  packMatStockHU : String(40);
  product        : String(40);
  batch          : String(20);
  quantity       : Decimal(13,3);
  uom            : String(3);
  isTopHURecord  : Boolean default false;
}

// --- Serial numbers linked to PhysicalStock
entity SerialNumbers : managed {
  key physicalStockId : UUID;        // FK to PhysicalStock
  key serialNumber    : String(40);

  physicalStock : Association to PhysicalStock
    on physicalStock.ID = physicalStockId;

  warehouse    : String(10);
  storageBin   : String(20);
  topHU        : String(30);
  stockHU      : String(30);
  product      : String(40);
}

// --- Top HU registry, unique by business keys
entity TopHURegistry : managed {
  key warehouse  : String(10);
  key storageBin : String(20);
  key topHU      : String(30);
}
