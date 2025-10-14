sap.ui.define([], function () {
  "use strict";

  function norm(v) { return v == null ? "" : String(v); }

  function isEditRowByKeys(bEdit, oEditKey, wh, bin, top, stock, prod, batch) {
    if (!bEdit || !oEditKey) return false;
    return norm(oEditKey.warehouse)  === norm(wh)    &&
           norm(oEditKey.storageBin) === norm(bin)   &&
           norm(oEditKey.topHU)      === norm(top)   &&
           norm(oEditKey.stockHU)    === norm(stock) &&
           norm(oEditKey.product)    === norm(prod)  &&
           norm(oEditKey.batch)      === norm(batch);
  }

  function isReadRowByKeys(bEdit, oEditKey, wh, bin, top, stock, prod, batch) {
    return !isEditRowByKeys(bEdit, oEditKey, wh, bin, top, stock, prod, batch);
  }

  return {
    norm,
    isEditRowByKeys,
    isReadRowByKeys
  };
});
