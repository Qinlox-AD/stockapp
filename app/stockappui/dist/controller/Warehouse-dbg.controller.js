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
        case "F3":
          this.onExportExcelFromVM();
          break;
        case "F7":
        case "Escape":
          this.onNavBack();
          break;
      }
    },

    async onExportExcel() {
      const vm = this.getModelMain();
      const warehouse = (vm.getProperty("/warehouse") || "").trim();

      if (!warehouse) {
        MessageBox.error(this.getI18nText("warehousePlaceholder"));
        return;
      }

      try {
        const res = await this.callAction("ExportPhysicalStockExcel", {
          warehouse
        });

        const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        let blob;

        if (res?.value?.type === "Buffer" && Array.isArray(res.value.data)) {
          blob = new Blob([new Uint8Array(res.value.data)], { type: mime });
        } else if (res?.type === "Buffer" && Array.isArray(res.data)) {
          blob = new Blob([new Uint8Array(res.data)], { type: mime });
        } else if (res instanceof ArrayBuffer) {
          blob = new Blob([new Uint8Array(res)], { type: mime });
        } else if (res?.buffer instanceof ArrayBuffer) {
          blob = new Blob([new Uint8Array(res.buffer)], { type: mime });
        } else if (typeof res === "string") {
          const s = atob(res);
          const bytes = new Uint8Array(s.length);
          for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
          blob = new Blob([bytes], { type: mime });
        } else {
          throw new Error("Unexpected Excel payload type");
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "PhysicalStock.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        MessageBox.error("Excel export failed");
      }
    },

    onWarehouseEnter() {
      const vm = this.getModelMain();
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
