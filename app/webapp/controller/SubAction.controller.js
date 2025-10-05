sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], (Controller, MessageToast, MessageBox) => {
  "use strict";

  return Controller.extend("stockappui.controller.SubAction", {
    onInit() {
      this.getOwnerComponent().getRouter().getRoute("RouteSubAction")
        .attachPatternMatched(this._onMatched, this);
    },

    _onMatched(oEvt) {
      const { mode } = oEvt.getParameter("arguments");
      const vm = this.getOwnerComponent().getModel("vm");
      vm.setProperty("/__sub/mode", mode);
      vm.setProperty("/__sub/topHu", "");

      if (mode === "List") {
        // TODO: Load confirmed list from CAP
        // const oModel = this.getOwnerComponent().getModel();
        // oModel.read("/PhysicalStock", { .... });
      }
    },

    onNavBack() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getOwnerComponent().getRouter().navTo("RouteStockEntry", {
        warehouse: encodeURIComponent(vm.getProperty("/warehouse")),
        bin: encodeURIComponent(vm.getProperty("/bin"))
      });
    },

    // Top HU
    onSaveTopHU() {
      const vm = this.getOwnerComponent().getModel("vm");
      const hu = (vm.getProperty("/__sub/topHu") || "").trim();
      if (!hu) { MessageBox.error("Enter Top HU."); return; }

      // TODO: CAP upsertTopHu(bin, topHu)
      MessageToast.show("Top HU saved.");
      this.onNavBack();
    },

    // Serials
    onAddSerial(oEvent) {
      const vm = this.getOwnerComponent().getModel("vm");
      const input = oEvent.getSource();
      const sn = (input.getValue() || "").trim();
      if (!sn) { return; }

      const arr = vm.getProperty("/serials") || [];
      if (arr.includes(sn)) {
        MessageBox.error("Duplicate serial number not accepted.");
      } else {
        arr.push(sn);
        vm.setProperty("/serials", arr);
      }
      input.setValue("");
    },

    onBackToEntry() { this.onNavBack(); }
  });
});
