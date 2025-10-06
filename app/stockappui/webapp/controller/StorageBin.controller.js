sap.ui.define([
  "./BaseController",
  "sap/ui/core/routing/History",
  "sap/m/MessageBox"
], function (BaseController, History, MessageBox) {
  "use strict";

  return BaseController.extend("stockappui.controller.StorageBin", {
    onInit() {
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener(),
        onAfterHide: () => this.removeFunctionKeyListener()
      });
    },

    pressKeyOnKeyboard(key) {
      switch (key) {
        case "Enter":
          this.onStorageBinEnter();
          break;
        case "F7":
        case "Escape":
          this.onNavBack();
          break;
      }
    },

    onNavBack() {
      const hist = History.getInstance();
      if (hist.getPreviousHash() !== undefined) {
        window.history.go(-1);
      } else {
        this.getRouter().navTo("RouteWarehouse", {}, true);
      }
    },

    onStorageBinEnter() {
      const vm = this.getOwnerComponent().getModel("vm");
      const wh = vm.getProperty("/warehouse") || "";
      const bin = (vm.getProperty("/bin") || "").trim();

      if (!bin) {
        MessageBox.error(this.getI18nText("binPlaceholder"));
        return;
      }

      this.getRouter().navTo("RouteStockEntry", {
        warehouse: encodeURIComponent(wh),
        bin: encodeURIComponent(bin)
      });
    },

    onLiveChangeBin() { }
  });
});
