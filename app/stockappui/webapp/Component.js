sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], (UIComponent, JSONModel) => {
    "use strict";

    return UIComponent.extend("stockappui.Component", {
        metadata: { manifest: "json" },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            // View model to hold app state across steps
            const vm = new JSONModel({
                warehouse: "123",
                bin: "123",
                entry: { hu: "", packMat: "", product: "", batch: "", quantity: null, uom: "" },
                serials: [],
                list: [],
                __sub: { mode: "", topHu: "" }
            });
            this.setModel(vm, "vm");

            this.getRouter().initialize();
        }
    });
});
