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
      this.getView().addEventDelegate({
        onAfterShow: () => this.addFunctionKeyListener?.(),
        onAfterHide: () => this.removeFunctionKeyListener?.()
      });
    },

    // F-keys mapping (optional; if you already have it, keep your version)
    pressKeyOnKeyboard(key) {
      switch (key) {
        case "Enter":
        case "F4": this.onConfirm(); break;
        case "F1": this.onOpenTopHU(); break;
        case "F2": this.onOpenSerNb(); break;
        case "F6": this.onOpenList(); break;
        case "F7":
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

    // === Persist a stock line via backend action ConfirmStock ===
    onConfirm: async function () {
      const vm = this.getOwnerComponent().getModel("vm");
      const entry = vm.getProperty("/entry") || {};
      const serials = vm.getProperty("/serials") || [];

      // --- Validation
      const hasProduct = !isEmpty(entry.product);
      const hasQty = !isEmpty(entry.quantity);
      const hasStockHu = !isEmpty(entry.hu);

      // Minimum requirement: StockHU OR (Product + Qty)
      if (!hasStockHu && !hasProduct && !hasQty) {
        MessageBox.error(this.getI18nText("errConfirmMinReq")); // <-- add to i18n
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

      // --- Build payload
      const warehouse = vm.getProperty("/warehouse");
      const storageBin = vm.getProperty("/bin");

      const payload = {
        warehouse,
        storageBin,
        topHU: vm.getProperty("/__sub/topHu") || null,
        packMatTopHU: entry.packMat || null,
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
          // confirm with serials
          result = await this.callAction("ConfirmStockWithSerials", {
            entry: payload,
            serials
          });
        } else {
          // confirm simple
          result = await this.callAction("ConfirmStock", { entry: payload });
        }

        vm.setProperty("/hostPhysicalStockId", result?.id || result?.ID || null);
        vm.setProperty("/entry/quantity", result?.quantity ?? null);
        vm.setProperty("/serials", []); // clear buffer

        await this.onExportExcel(warehouse, storageBin);

        MessageToast.show(this.getI18nText("msgConfirmSuccess"));
        vm.setProperty("/entry", { hu: "", packMat: "", product: "", batch: "", quantity: null, uom: "" });
        vm.setProperty("/__sub/topHu", "");
      } catch (e) {
        this.showActionError(e, "Confirm failed");
      } finally {
        this.hideBusyIndicator();
      }
    },


    onExportExcel: async function (warehouse, storageBin) {
      try {
        const res = await this.callAction("ExportPhysicalStockExcel", {
          warehouse,
          storageBin
        });

        const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        let blob;

        // 1) Node Buffer serialized: { value: { type:'Buffer', data:[...] } }
        if (res?.value?.type === "Buffer" && Array.isArray(res.value.data)) {
          const u8 = new Uint8Array(res.value.data);
          blob = new Blob([u8], { type: mime });

          // 2) Raw Buffer-like object: { type:'Buffer', data:[...] }
        } else if (res?.type === "Buffer" && Array.isArray(res.data)) {
          const u8 = new Uint8Array(res.data);
          blob = new Blob([u8], { type: mime });

          // 3) ArrayBuffer
        } else if (res instanceof ArrayBuffer) {
          blob = new Blob([new Uint8Array(res)], { type: mime });

          // 4) Uint8Array
        } else if (res?.buffer instanceof ArrayBuffer) {
          blob = new Blob([new Uint8Array(res.buffer)], { type: mime });

          // 5) Base64 string (fallback—if your backend returns base64 instead)
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
        sap.m.MessageBox.error("Excel export failed");
      }
    },


    onLiveChange() { }
  });
});
