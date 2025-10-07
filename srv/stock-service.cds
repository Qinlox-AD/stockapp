using inventory from '../db/schema';

// --- Payload for ConfirmStock
type PhysicalStockInput  : {
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
};

// --- Payload for ConfirmTopHU
type TopHUInput          : {
    warehouse  : String(10);
    storageBin : String(20);
    topHU      : String(30);
    packMat    : String(40);
};

// --- Result shape returned by actions that confirm stock
type PhysicalStockResult : {
    ID            : UUID;
    warehouse     : String(10);
    storageBin    : String(20);
    topHU         : String(30);
    stockHU       : String(30);
    product       : String(40);
    quantity      : Decimal(13, 3);
    uom           : String(3);
    isTopHURecord : Boolean;
};

// --- Result for serial-related actions (no 'ok')
type ScanSerialsResult   : {
    quantity : Decimal(13, 3);
    id       : UUID;
};

service StockService @(path: '/rf') {
    @cds.redirection.target
    entity PhysicalStock as projection on inventory.PhysicalStock;

    entity SerialNumbers as projection on inventory.SerialNumbers;
    entity TopHURegistry as projection on inventory.TopHURegistry;

    entity BinList       as
        projection on inventory.PhysicalStock
        excluding {
            isTopHURecord
        }
        where
            isTopHURecord = false;

    action ConfirmTopHU(input: TopHUInput)                                                  returns PhysicalStockResult;
    action ConfirmStock(entry: PhysicalStockInput)                                          returns PhysicalStockResult;

    action ScanSerial(physicalStockId: UUID, serial: String(40))                            returns ScanSerialsResult;

    action ConfirmSerials(physicalStockId: UUID, serials: array of String(40))              returns ScanSerialsResult;

    action ConfirmStockWithSerials(entry: PhysicalStockInput, serials: array of String(40)) returns ScanSerialsResult;

    action ExportBin(warehouse: String(10), storageBin: String(20))                         returns many PhysicalStock;

    action ExportPhysicalStockExcel(warehouse: String(10), storageBin: String(20))          returns LargeBinary;
}
