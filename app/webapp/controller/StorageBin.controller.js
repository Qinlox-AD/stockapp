sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], (Controller, History) => {
  "use strict";

  return Controller.extend("stockappui.controller.StorageBin", {
    onNavBack() {
      const hist = History.getInstance();
      if (hist.getPreviousHash() !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteWarehouse", {}, true);
      }
    },

    onStorageBinEnter() {
      const vm = this.getOwnerComponent().getModel("vm");
      const wh = vm.getProperty("/warehouse") || "";
      const bin = (vm.getProperty("/bin") || "").trim();
      this.getOwnerComponent().getRouter().navTo("RouteStockEntry", {
        warehouse: encodeURIComponent(wh),
        bin: encodeURIComponent(bin)
      });
    },

    onLiveChangeBin() {}
  });
});
