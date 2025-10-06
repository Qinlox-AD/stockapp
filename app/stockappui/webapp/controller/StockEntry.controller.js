sap.ui.define([
  "./BaseController",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, History, MessageToast, MessageBox) {
  "use strict";

  const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";

  return BaseController.extend("stockappui.controller.StockEntry", {

    onInit() {
      // Attach/detach F-key listener when the page is shown/hidden
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener(),
        onAfterHide: () => this.removeFunctionKeyListener()
      });
    },

    // Map keys to the same actions you have in the footer
    pressKeyOnKeyboard(key) {
      switch (key) {
        case "Enter":
        case "F4":
          this.onConfirm();
          break;
        case "F1":
          this.onOpenTopHU();
          break;
        case "F2":
          this.onOpenSerNb();
          break;
        case "F6":
          this.onOpenList();
          break;
        case "F7":
        case "Escape":
          this.onNavBack();
          break;
        default:
          break;
      }
    },

    onNavBack() {
      // Respect back stack; if deep-linked, fall back to StorageBin
      const hist = History.getInstance();
      if (hist.getPreviousHash() !== undefined) {
        window.history.go(-1);
      } else {
        const vm = this.getOwnerComponent().getModel("vm");
        this.getRouter().navTo("RouteStorageBin", {
          warehouse: encodeURIComponent(vm.getProperty("/warehouse") || "")
        });
      }
    },

    onOpenTopHU() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getRouter().navTo("RouteSubAction", {
        mode: "TopHU",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    onOpenSerNb() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getRouter().navTo("RouteSubAction", {
        mode: "SerNb",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    onOpenList() {
      const vm = this.getOwnerComponent().getModel("vm");
      this.getRouter().navTo("RouteSubAction", {
        mode: "List",
        warehouse: encodeURIComponent(vm.getProperty("/warehouse") || ""),
        bin: encodeURIComponent(vm.getProperty("/bin") || "")
      });
    },

    onConfirm() {
      const vm = this.getOwnerComponent().getModel("vm");
      const entry = vm.getProperty("/entry") || {};

      const hasProduct = !isEmpty(entry.product);
      const hasQty     = !isEmpty(entry.quantity) && !isNaN(entry.quantity);

      // If both blank → treat as missing required info
      if (!hasProduct && isEmpty(entry.quantity)) {
        MessageBox.error(this.getI18nText("errProductNeedsQty"));
        return;
      }

      // Qty entered but no product
      if (!hasProduct && !isEmpty(entry.quantity)) {
        MessageBox.error(this.getI18nText("errQtyNoProduct"));
        return;
      }

      // Product entered but no/invalid qty
      if (hasProduct && !hasQty) {
        MessageBox.error(this.getI18nText("errProductNeedsQty"));
        return;
      }

      // Explicit numeric check if quantity string is present but not a number
      if (!isEmpty(entry.quantity) && isNaN(entry.quantity)) {
        MessageBox.error(this.getI18nText("errQtyNumeric"));
        return;
      }

      // TODO: call OData V4 create to CAP service here
      // const oModel = this.getOwnerComponent().getModel();
      // await oModel.create("/PhysicalStock", payload);

      MessageToast.show(this.getI18nText("msgSaved"));

      // reset form fields
      vm.setProperty("/entry", {
        hu: "", packMat: "", product: "", batch: "", quantity: null, uom: ""
      });
    },

    onLiveChange() {
      // hook for inline validation/autocomplete if needed
    }
  });
});
