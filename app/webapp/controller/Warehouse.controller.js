sap.ui.define(["sap/ui/core/mvc/Controller"], (Controller) => {
  "use strict";

  return Controller.extend("stockappui.controller.Warehouse", {
    onWarehouseEnter() {
      const vm = this.getOwnerComponent().getModel("vm");
      const wh = (vm.getProperty("/warehouse") || "").trim();
      this.getOwnerComponent().getRouter().navTo("RouteStorageBin", {
        warehouse: encodeURIComponent(wh)
      });
    },
    onLiveChangeWarehouse() {}
  });
});
