sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
  "use strict";

  return Controller.extend("monitoringui.controller.PhysicalOverview", {

    onInit: function () {

    },

    _getSelectedContext: function () {
      const aSel = this.byId("physTable").getSelectedContexts();
      return aSel && aSel.length ? aSel[0] : null;
    },

    onPhysSelect: function () {
      this.byId("btnDownload").setEnabled(!!this._getSelectedContext());
    },

    onSearchPhysical: function (oEvent) {
      const sQuery = oEvent.getParameter("newValue") || "";
      const oBinding = this.byId("physTable").getBinding("items");
      const aFilters = [];
      if (sQuery) {
        aFilters.push(new Filter({
          filters: [
            new Filter("warehouse", FilterOperator.Contains, sQuery),
            new Filter("storageBin", FilterOperator.Contains, sQuery),
            new Filter("product", FilterOperator.Contains, sQuery),
            new Filter("batch", FilterOperator.Contains, sQuery),
            new Filter("topHU", FilterOperator.Contains, sQuery),
            new Filter("stockHU", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }
      oBinding.filter(aFilters, "Application");
    },

    onDownloadSerials: function () {
      const oCtx = this._getSelectedContext();
      if (!oCtx) { MessageToast.show("Select a row first"); return; }

      const sPhysId = oCtx.getProperty("ID");
      const oSerialsTable = this.byId("serialsTable");

      oSerialsTable.unbindItems();
      oSerialsTable.removeAllItems();

      const oTemplate = this.byId("serialsItemTemplate").clone();

      oSerialsTable.bindItems({
        path: "/SerialNumbers",
        parameters: { $count: true },
        filters: [new Filter("physicalStockId", FilterOperator.EQ, sPhysId)],
        template: oTemplate
      });

      this.byId("serialsHint").setText(`Serials for PhysicalStock ID ${sPhysId}`);
      MessageToast.show("Serial numbers loaded");
    }


  });
});
