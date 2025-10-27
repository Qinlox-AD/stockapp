sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], (UIComponent, JSONModel) => {
    "use strict";

    return UIComponent.extend("uploadapp.Component", {
        metadata: { manifest: "json" },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            const oViewModel = new JSONModel({
                warehouse: ""
            });

            this.setModel(oViewModel, "vm");

            this.getRouter().initialize();
        }
    });
});
