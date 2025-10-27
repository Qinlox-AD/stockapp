sap.ui.define([
  "uploadapp/controller/BaseController",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
  "use strict";

  return BaseController.extend("uploadapp.controller.Upload", {
    onInit: function () {
      const oModel = new sap.ui.model.json.JSONModel({
        file: null,
        fileName: "",
        fileType: "",
        fileSize: 0
      });
      this.getView().setModel(oModel, "upload");
    },

    handleTypeMissmatch: function (oEvent) {
      const aFileTypes = oEvent.getSource().getFileType().map((t) => `*.${t}`);
      MessageToast.show(
        `The file type *.${oEvent.getParameter("fileType")} is not supported. Choose one of: ${aFileTypes.join(", ")}`
      );
    },

    handleValueChange: function (oEvent) {
      const oUploadModel = this.getView().getModel("upload");
      const files = oEvent.getParameter("files");
      const file = files && files[0] ? files[0] : null;

      if (file) {
        oUploadModel.setProperty("/file", file);
        oUploadModel.setProperty("/fileName", file.name);
        oUploadModel.setProperty("/fileType", file.type);
        oUploadModel.setProperty("/fileSize", file.size);
        sap.m.MessageToast.show(`Selected file: ${file.name}`);
      } else {
        oUploadModel.setData({ file: null, fileName: "", fileType: "", fileSize: 0 });
      }
    },


    handleUploadPress: async function () {
      const oFU = this.byId("fileUploader");
      const oUploadModel = this.getView().getModel("upload");
      const file = oUploadModel.getProperty("/file");

      if (!file) {
        sap.m.MessageToast.show("Choose a file first");
        return;
      }

      try {
        await oFU.checkFileReadable();
        this.showBusyIndicator();

        const buf = await file.arrayBuffer();
        // const bytes = new Uint8Array(buf);
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const resultMsg = await this.callAction("UploadValidationStock", { file: b64 });

        this.handleUploadComplete({
          getParameter: (name) => {
            if (name === "status") return 200;
            if (name === "response" || name === "responseRaw") return resultMsg || "Upload completed.";
            return undefined;
          }
        });
      } catch (err) {
        sap.m.MessageBox.error(err?.message || "Upload failed.");
      } finally {
        oFU.clear();
        oUploadModel.setData({ file: null, fileName: "", fileType: "", fileSize: 0 });
        this.hideBusyIndicator();
      }
    },


    handleUploadComplete: function (oEvent) {
      const response = oEvent.getParameter("responseRaw")?.value;
      const status = oEvent.getParameter("status");

      const text = response || `File upload complete. Status: ${status ?? "n/a"}`;
      const ok = typeof status === "number" ? status >= 200 && status < 300 : true;

      const msg = ok ? `${text} (Upload Success)` : `${text} (Upload Error)`;
      sap.m.MessageToast.show(msg);
    },

    onDownloadPress: async function () {
      const vm = this.getModelMain();
      const warehouse = (vm.getProperty("/warehouse") || "").trim();
      if (!warehouse) {
        MessageBox.error(this.getI18nText("warehousePlaceholder"));
        return;
      }

      try {
        this.showBusyIndicator();
        const res = await this.callAction("ExportPhysicalStockExcel", { warehouse });
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
        MessageBox.error(`Excel export failed: ${e.message || e}`);
      } finally {
        this.hideBusyIndicator();
      }
    }
  });
});
