sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
  "use strict";

  return Controller.extend("monitoringui.controller.PhysicalOverview", {

    onInit: function () { },

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

      const sWarehouse = oCtx.getProperty("warehouse");
      const sStorageBin = oCtx.getProperty("storageBin");
      const sTopHU = oCtx.getProperty("topHU");
      const sStockHU = oCtx.getProperty("stockHU");
      const sProduct = oCtx.getProperty("product");

      const aFilters = [
        new Filter("warehouse", FilterOperator.EQ, sWarehouse),
        new Filter("storageBin", FilterOperator.EQ, sStorageBin),
        new Filter("topHU", FilterOperator.EQ, sTopHU || null),
        new Filter("stockHU", FilterOperator.EQ, sStockHU || null),
        new Filter("product", FilterOperator.EQ, sProduct || null)
      ];

      const oSerialsTable = this.byId("serialsTable");
      oSerialsTable.unbindItems();
      oSerialsTable.removeAllItems();

      const oTemplate = this.byId("serialsItemTemplate").clone();

      oSerialsTable.bindItems({
        path: "/SerialNumbers",
        template: oTemplate,
        templateShareable: false,
        filters: aFilters
      });

      this.byId("serialsHint").setText(
        `Serials for ${sWarehouse} / ${sStorageBin} / ${sProduct || "(no product)"} / TopHU ${sTopHU || "–"} / StockHU ${sStockHU || "–"}`
      );
      MessageToast.show("Serial numbers loaded");
    },

    onRefresh: function () {
      const oPhysTable = this.byId("physTable");
      const oSerialsTable = this.byId("serialsTable");

      const b1 = oPhysTable.getBinding("items");
      const b2 = oSerialsTable.getBinding("items");

      oPhysTable.setBusy(true);
      if (b2) oSerialsTable.setBusy(true);

      if (b1) {
        b1.attachEventOnce("dataReceived", () => oPhysTable.setBusy(false));
        b1.refresh();
      } else {
        oPhysTable.setBusy(false);
      }

      if (b2) {
        b2.attachEventOnce("dataReceived", () => oSerialsTable.setBusy(false));
        b2.refresh();
      }

      MessageToast.show("Refreshing data…");
    }

  });
});
