sap.ui.define([
  "./BaseController",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
  "use strict";

  return BaseController.extend("stockappui.controller.SubAction", {
    onInit() {
      this.initBackButtonRouting("RouteSubAction");
      this.getRouter().getRoute("RouteSubAction").attachPatternMatched(this.onRouteMatched, this);
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener?.(),
        onAfterHide: () => this.removeFunctionKeyListener?.()
      });
    },


    async onRouteMatched(oEvt) {
      const { mode } = oEvt.getParameter("arguments") || {};
      const vm = this.getModelMain();
      vm.setProperty("/__sub/mode", mode);

      if (mode === "List") {
        const warehouse = vm.getProperty("/warehouse");
        const bin = vm.getProperty("/bin");

        if (!warehouse || !bin) {
          vm.setProperty("/list", []);
          return;
        }
        await this._loadBinList(warehouse, bin);
      }
    },


    // Only F7/Escape back; F4 confirms only in TopHU mode
    pressKeyOnKeyboard(key) {
      switch (key) {
        case "F7":
          this.onBackUp();
          break;
        case "Escape": this.onNavBack(); break;
        case "F4": {
          const vm = this.getModelMain();
          if (vm.getProperty("/__sub/mode") === "TopHU") this.onConfirmTopHu();
          break;
        }
      }
    },

    onNavBack() {
      const vm = this.getModelMain();
      this.getRouter().navTo("RouteStockEntry", {
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    // === ConfirmTopHU backend action F4 ===
    onConfirmTopHu: async function () {
      const vm = this.getModelMain();
      const hu = (vm.getProperty("/__sub/topHu") || "").trim();
      const packMatTopHU = (vm.getProperty("/__sub/packMatTopHu") || "").trim();
      if (!hu) { MessageBox.error(this.getI18nText("scanTopHU")); return; }

      const input = {
        warehouse: vm.getProperty("/warehouse"),
        storageBin: vm.getProperty("/bin"),
        topHU: hu,
        packMatTopHU
      };

      try {
        this.showBusyIndicator();
        const res = await this.callAction("ConfirmTopHU", { input }); // PhysicalStockResult
        vm.setProperty("/__sub/topHu", res?.topHU || hu); // display on StockEntry
        MessageToast.show(this.getI18nText("msgSaved"));
        this.onNavBack();
      } catch (e) {
        this.showActionError(e, "ConfirmTopHU failed");
      } finally {
        this.hideBusyIndicator();
      }
    },


    onAddSerial: function (oEvent) {
      const vm = this.getModelMain();
      const input = oEvent.getSource();
      const sn = (input.getValue() || "").trim().toUpperCase();
      input.setValue(""); // clear input early

      if (!sn) return;

      // numeric-only guard (adapt if serials can be alphanumeric)
      if (!/^\d+$/.test(sn)) {
        MessageBox.error(this.getI18nText("errQtyNumeric"));
        return;
      }

      let arr = vm.getProperty("/serials") || [];
      if (arr.includes(sn)) {
        MessageBox.error(this.getI18nText("errDuplicateSerial"));
      } else {
        arr.push(sn);
        vm.setProperty("/serials", arr);
        vm.setProperty("/entry/quantity", arr.length); // show running quantity
      }
    },

    async _loadBinList(warehouse, storageBin) {
      this.showBusyIndicator();

      try {
        const data = await this.callAction("ExportBin", { warehouse, storageBin });
        this.getModelMain().setProperty("/list", data?.value ?? []);
      } catch (err) {
        this.getModelMain().setProperty("/list", []);
        sap.m.MessageBox.error(err?.message || "Failed to load storage bins");
      } finally {
        this.hideBusyIndicator();
      }
    },
  });
});
