sap.ui.define([
  "./BaseController",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, History, MessageToast, MessageBox) {
  "use strict";

  const isEmpty = v => v === undefined || v === null || String(v).trim() === "";

  return BaseController.extend("stockappui.controller.StockEntry", {
    onInit() {
      this.initBackButtonRouting("RouteStockEntry");
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener?.(),
        onAfterHide: () => this.removeFunctionKeyListener?.()
      });
    },

    pressKeyOnKeyboard(key) {
      switch (key) {
        case "Enter":
        case "F4": this.onConfirm(); break;
        case "F1": this.onOpenTopHU(); break;
        case "F2": this.onOpenSerNb(); break;
        case "F6": this.onOpenList(); break;
        case "F7": this.onBackUp(); break;
        case "Escape": this.onNavBack(); break;  
      }
    },

    onNavBack() {
      const hist = History.getInstance();
      if (hist.getPreviousHash() !== undefined) return window.history.go(-1);
      const vm = this.getOwnerComponent().getModel("vm");
      this.getRouter().navTo("RouteStorageBin", {
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || "")
      });
    },

    onOpenTopHU() {
      const vm = this.getModelMain();
      this.getRouter().navTo("RouteSubAction", {
        mode: "TopHU",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    onOpenSerNb() {
      const vm = this.getModelMain();
      this.getRouter().navTo("RouteSubAction", {
        mode: "SerNb",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    onOpenList() {
      const vm = this.getModelMain();
      this.getRouter().navTo("RouteSubAction", {
        mode: "List",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    onConfirm: async function () {
      const vm = this.getModelMain();
      const entry = vm.getProperty("/entry") || {};
      const serials = vm.getProperty("/serials") || [];

      const hasProduct = !isEmpty(entry.product);
      const hasQty = !isEmpty(entry.quantity);
      const hasStockHu = !isEmpty(entry.hu);

      if (!hasStockHu && !hasProduct && !hasQty) {
        MessageBox.error(this.getI18nText("errConfirmMinReq"));
        return;
      }
      if (hasProduct && !hasQty) {
        MessageBox.error(this.getI18nText("errProductNeedsQty"));
        return;
      }
      if (hasQty && isNaN(Number(entry.quantity))) {
        MessageBox.error(this.getI18nText("errQtyNumeric"));
        return;
      }
      if (!hasProduct && hasQty) {
        MessageBox.error(this.getI18nText("errQtyNoProduct"));
        return;
      }

      const warehouse = vm.getProperty("/warehouse");
      const storageBin = vm.getProperty("/bin");

      const payload = {
        warehouse,
        storageBin,
        topHU: vm.getProperty("/__sub/topHu") || null,
        packMatTopHU: vm.getProperty("/__sub/topHu") || null,
        stockHU: entry.hu || null,
        packMatStockHU: entry.packMat || null,
        product: entry.product || null,
        batch: entry.batch || null,
        quantity: hasQty ? Number(entry.quantity) : null,
        uom: entry.uom || null
      };

      try {
        this.showBusyIndicator();

        let result;
        if (serials.length > 0) {
          result = await this.callAction("ConfirmStockWithSerials", { entry: payload, serials });
        } else {
          result = await this.callAction("ConfirmStock", { entry: payload });
        }

        vm.setProperty("/hostPhysicalStockId", result?.id || result?.ID || null);
        vm.setProperty("/entry/quantity", result?.quantity ?? null);
        vm.setProperty("/serials", []);

        MessageToast.show(this.getI18nText("msgConfirmSuccess"));
        vm.setProperty("/entry", { hu: "", packMat: "", product: "", batch: "", quantity: null, uom: "" });
        vm.setProperty("/__sub/topHu", "");
      } catch (e) {
        this.showActionError(e, "Confirm failed");
      } finally {
        this.hideBusyIndicator();
      }
    },

    onLiveChange() { }
  });
});
