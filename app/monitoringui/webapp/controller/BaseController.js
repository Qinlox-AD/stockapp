sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function (BaseController) {
        "use strict";


        return BaseController.extend("monitoringui.controller.BaseController", {

            getModelMain() {
                return this.getOwnerComponent().getModel("vm");
            },

            getRouter() {
                return this.getOwnerComponent().getRouter();
            },

            getI18nText(key) {
                return this.getView().getModel("i18n").getResourceBundle().getText(key);
            },

            showBusyIndicator() {
                sap.ui.core.BusyIndicator.show(0);
            },

            hideBusyIndicator() {
                sap.ui.core.BusyIndicator.hide();
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
                sap.m.MessageBox.error(msg);
            },
        });
    }
);