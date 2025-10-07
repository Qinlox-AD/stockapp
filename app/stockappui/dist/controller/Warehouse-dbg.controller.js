sap.ui.define([
  "./BaseController",
  "sap/ui/core/routing/History",
  "sap/m/MessageBox"
], function (BaseController, History, MessageBox) {
  "use strict";

  return BaseController.extend("stockappui.controller.Warehouse", {
    onInit() {
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener(),
        onAfterHide: () => this.removeFunctionKeyListener()
      });
    },

    pressKeyOnKeyboard(key) {
      switch (key) {
        case "Enter":
          this.onWarehouseEnter();
          break;
        case "F7":
        case "Escape":
          this.onNavBack();
          break;
      }
    },

    onWarehouseEnter() {
      const vm = this.getOwnerComponent().getModel("vm");
      const wh = (vm.getProperty("/warehouse") || "").trim();

      if (!wh) {
        MessageBox.error(this.getI18nText("warehousePlaceholder"));
        return;
      }

      this.getRouter().navTo("RouteStorageBin", {
        warehouse: encodeURIComponent(wh)
      });
    },

    onLiveChangeWarehouse() { },

    onNavBack() {
      const hist = History.getInstance();
      if (hist.getPreviousHash() !== undefined) {
        window.history.go(-1);
      }
    }
  });
});
