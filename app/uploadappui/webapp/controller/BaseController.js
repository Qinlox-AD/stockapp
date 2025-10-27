sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageBox, BusyIndicator) {
    "use strict";

    return Controller.extend("uploadapp.controller.BaseController", {
        getRouter() {
            return this.getOwnerComponent().getRouter();
        },

        getModelMain() {
            return this.getOwnerComponent().getModel("vm");
        },

        getI18nText(key) {
            return this.getView().getModel("i18n").getResourceBundle().getText(key);
        },

        showBusyIndicator() {
            BusyIndicator.show(0);
        },

        hideBusyIndicator() {
            BusyIndicator.hide();
        },


        async callAction(name, params = {}) {
            const oModel = this.getOwnerComponent().getModel();
            const oContext = oModel.bindContext(`/${name}(...)`);
            Object.entries(params).forEach(([k, v]) => oContext.setParameter(k, v));
            await oContext.execute();
            return oContext.getBoundContext().getObject();
        },

        showActionError(e, fallback) {
            const msg =
                e?.message ||
                e?.error?.message ||
                e?.cause?.message ||
                (typeof e === "string" ? e : null) ||
                fallback ||
                "Action failed";
            MessageBox.error(msg);
        }
    });
});
