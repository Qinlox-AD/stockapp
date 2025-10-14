sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  function mapConditionsToFilter(field, aConds) {
    if (!Array.isArray(aConds) || aConds.length === 0) return null;
    const parts = [];
    for (const c of aConds) {
      const op = c.operator || "EQ";
      const v1 = c.values?.[0];
      const v2 = c.values?.[1];
      if (v1 === undefined || v1 === null || v1 === "") continue;

      switch (op) {
        case "BT":
          if (v2 !== undefined && v2 !== null && v2 !== "")
            parts.push(new Filter(field, FilterOperator.BT, v1, v2));
          break;
        case "Contains": parts.push(new Filter(field, FilterOperator.Contains, v1)); break;
        case "StartsWith": parts.push(new Filter(field, FilterOperator.StartsWith, v1)); break;
        case "EndsWith": parts.push(new Filter(field, FilterOperator.EndsWith, v1)); break;
        case "NE": parts.push(new Filter(field, FilterOperator.NE, v1)); break;
        case "LT": parts.push(new Filter(field, FilterOperator.LT, v1)); break;
        case "LE": parts.push(new Filter(field, FilterOperator.LE, v1)); break;
        case "GT": parts.push(new Filter(field, FilterOperator.GT, v1)); break;
        case "GE": parts.push(new Filter(field, FilterOperator.GE, v1)); break;
        default: parts.push(new Filter(field, FilterOperator.EQ, v1)); break;
      }
    }
    if (!parts.length) return null;
    return parts.length === 1 ? parts[0] : new Filter({ and: false, filters: parts });
  }

  function getFirstConditionValue(aConds) {
    return Array.isArray(aConds) && aConds[0]?.values?.[0] ? String(aConds[0].values[0]).trim() : "";
  }

  return Controller.extend("monitoringui.controller.PhysicalOverview", {
    onInit: function () { },

    _getSelectedContext: function () {
      const aSel = this.byId("physTable").getSelectedContexts();
      return aSel && aSel.length ? aSel[0] : null;
    },

    onPhysSelect: function () {
      const hasSel = !!this._getSelectedContext();
      this.byId("btnDownload").setEnabled(hasSel);
      this.byId("btnDelete").setEnabled(hasSel);
      this.byId("btnEdit").setEnabled(hasSel); // stays as a plain button (no edit logic)
    },

    onFBSearch: function () {
      const oBinding = this.byId("physTable").getBinding("items");
      if (!oBinding) return;

      const getConds = id => this.byId(id).getConditions();

      const perField = [
        mapConditionsToFilter("warehouse", getConds("ffWarehouse")),
        mapConditionsToFilter("storageBin", getConds("ffBin")),
        mapConditionsToFilter("stockHU", getConds("ffStockHU")),
        mapConditionsToFilter("topHU", getConds("ffTopHU")),
        mapConditionsToFilter("product", getConds("ffProduct")),
        mapConditionsToFilter("batch", getConds("ffBatch"))
      ].filter(Boolean);

      const sSearch = getFirstConditionValue(getConds("ffSearch"));
      if (typeof oBinding.changeParameters === "function") {
        oBinding.changeParameters({ $search: sSearch || undefined });
      }
      oBinding.filter(perField, "Application");
    },

    onDeleteRow: function () {
      const oCtx = this._getSelectedContext();
      if (!oCtx) { MessageToast.show("Select a row first"); return; }

      MessageBox.confirm("Delete the selected row?", {
        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.OK,
        onClose: async (sAction) => {
          if (sAction !== MessageBox.Action.OK) return;
          try {
            await oCtx.delete(); // note: will fail if bound to an aggregation/projection w/o deletions
            MessageToast.show("Row deleted");
            this.byId("physTable").removeSelections(true);
            this.byId("btnDownload").setEnabled(false);
            this.byId("btnDelete").setEnabled(false);
            this.byId("btnEdit").setEnabled(false);
            const b = this.byId("physTable").getBinding("items");
            if (b) b.refresh();
          } catch (e) {
            MessageBox.error(e?.message || "Delete failed");
          }
        }
      });
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
        new Filter("storageBin", FilterOperator.EQ, sStorageBin)
      ];
      if (sTopHU) aFilters.push(new Filter("topHU", FilterOperator.EQ, sTopHU));
      if (sStockHU) aFilters.push(new Filter("stockHU", FilterOperator.EQ, sStockHU));
      if (sProduct) aFilters.push(new Filter("product", FilterOperator.EQ, sProduct));

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
    },

    onStartEdit: function () {
      MessageToast.show("Edit mode is disabled in this screen.");
    },

    onSave() {
      const table = this.byId("physTable");
      const item = table.getSelectedItem();
      if (!item) {
        return sap.m.MessageToast.show("Select a row first.");
      }
      const ctx = item.getBindingContext(); 

      const cells = item.getCells();
      const newBatch = cells[3].getValue();
      const newQty = parseFloat(cells[4].getValue());

      if (Number.isNaN(newQty) || newQty < 0) {
        return sap.m.MessageBox.error("Quantity must be a non-negative number.");
      }

      ctx.invokeAction("ApplyEdit", {
        method: "POST",
        parameters: {
          newBatch: newBatch || null,
          newTotalQuantity: newQty
        }
      }).then(() => {
        sap.m.MessageToast.show("Saved.");
        ctx.getModel().refresh();
      }).catch((e) => {
        sap.m.MessageBox.error(e?.message || "Save failed.");
      });
    }

  });
});
