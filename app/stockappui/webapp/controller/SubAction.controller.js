sap.ui.define([
  "./BaseController",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
  "use strict";

  return BaseController.extend("stockappui.controller.SubAction", {
    onInit() {
      // Route match (sets mode and resets topHu)
      this.getRouter().getRoute("RouteSubAction")
        .attachPatternMatched(this._onMatched, this);

      // Attach/detach ONLY when this view is visible
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener(),
        onAfterHide: () => this.removeFunctionKeyListener()
      });
    },

    // F-keys mapping: F7 back everywhere; F4 confirm only for TopHU
    pressKeyOnKeyboard(key) {
      switch (key) {
        case "F7":
        case "Escape":
          this.onNavBack();
          break;
        case "F4": {
          const vm = this.getOwnerComponent().getModel("vm");
          const mode = vm.getProperty("/__sub/mode");
          if (mode === "TopHU") {
            this.onSaveTopHU();
          }
          break;
        }
        default:
          // ignore other keys here
          break;
      }
    },

    _onMatched(oEvt) {
      const { mode } = oEvt.getParameter("arguments");
      const vm = this.getOwnerComponent().getModel("vm");
      vm.setProperty("/__sub/mode", mode);
      vm.setProperty("/__sub/topHu", "");

      if (mode === "List") {
        // TODO load confirmed list from CAP if needed
        // const oModel = this.getOwnerComponent().getModel();
        // oModel.read("/PhysicalStock", {...});
      }
    },

    onNavBack() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getRouter().navTo("RouteStockEntry", {
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    // ---- Top HU ----
    onSaveTopHU() {
      const vm = this.getOwnerComponent().getModel("vm");
      const hu = (vm.getProperty("/__sub/topHu") || "").trim();
      if (!hu) {
        MessageBox.error(this.getI18nText("scanTopHU")); // reuse existing i18n prompt
        return;
      }

      // TODO: CAP upsertTopHu(bin, topHu)
      MessageToast.show(this.getI18nText("confirmF4")); // or add a dedicated success i18n if you prefer
      this.onNavBack();
    },

    // ---- Serials ----
    onAddSerial(oEvent) {
      const vm = this.getOwnerComponent().getModel("vm");
      const input = oEvent.getSource();
      const sn = (input.getValue() || "").trim();
      if (!sn) return;

      // numeric-only
      if (!/^\d+$/.test(sn)) {
        MessageBox.error(this.getI18nText("errQtyNumeric")); // reuse numeric message
        input.setValue("");
        return;
      }

      let arr = vm.getProperty("/serials") || [];
      if (arr.includes(sn)) {
        MessageBox.error("Duplicate serial number not accepted."); // add i18n if you want
      } else {
        arr.push(sn);
        vm.setProperty("/serials", arr);
        vm.setProperty("/entry/quantity", arr.length);
      }
      input.setValue("");
    },

    onBackToEntry() {
      this.onNavBack();
    }
  });
});
