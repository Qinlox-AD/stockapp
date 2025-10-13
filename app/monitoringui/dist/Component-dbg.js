sap.ui.define([
  "sap/ui/core/UIComponent"
], (UIComponent) => {
  "use strict";

  return UIComponent.extend("monitoringui.Component", {
    metadata: { manifest: "json" },

    init() {
      UIComponent.prototype.init.apply(this, arguments);
    }
  });
});
