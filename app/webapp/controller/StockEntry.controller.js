sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], (Controller, MessageToast, MessageBox) => {
  "use strict";
  const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";

  return Controller.extend("stockappui.controller.StockEntry", {
    onNavBack() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getOwnerComponent().getRouter().navTo("RouteStorageBin", {
        warehouse: encodeURIComponent(vm.getProperty("/warehouse"))
      });
    },

    onOpenTopHU() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getOwnerComponent().getRouter().navTo("RouteSubAction", {
        mode: "TopHU",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse")),
        bin: encodeURIComponent(vm.getProperty("/bin"))
      });
    },

    onOpenSerNb() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getOwnerComponent().getRouter().navTo("RouteSubAction", {
        mode: "SerNb",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse")),
        bin: encodeURIComponent(vm.getProperty("/bin"))
      });
    },

    onOpenList() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getOwnerComponent().getRouter().navTo("RouteSubAction", {
        mode: "List",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse")),
        bin: encodeURIComponent(vm.getProperty("/bin"))
      });
    },

    onConfirm() {
      const vm = this.getOwnerComponent().getModel("vm");
      const entry = vm.getProperty("/entry");

      const hasProduct = !isEmpty(entry.product);
      const hasQty = !isEmpty(entry.quantity) && !isNaN(entry.quantity);

      if (!hasProduct && !isEmpty(entry.quantity)) {
        MessageBox.error(this._t("errQtyNoProduct"));
        return;
      }
      if (hasProduct && !hasQty) {
        MessageBox.error(this._t("errProductNeedsQty"));
        return;
      }
      if (!isEmpty(entry.quantity) && isNaN(entry.quantity)) {
        MessageBox.error(this._t("errQtyNumeric"));
        return;
      }

      // TODO: call OData V4 create to CAP service here
      // const oModel = this.getOwnerComponent().getModel();
      // oModel.create("/PhysicalStock", payload);

      MessageToast.show(this._t("msgSaved"));
      vm.setProperty("/entry", { hu: "", packMat: "", product: "", batch: "", quantity: null, uom: "" });
    },

    onLiveChange() {},

    _t(key) {
      return this.getView().getModel("i18n").getResourceBundle().getText(key);
    }
  });
});
