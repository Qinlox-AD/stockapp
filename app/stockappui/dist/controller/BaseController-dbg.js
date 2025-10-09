sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function (BaseController) {
        "use strict";

        const FN_KEYS = new Set(["Enter", "F1", "F2", "F3", "F4", "F6", "F7", "Escape"]);

        const ROUTE_HIERARCHY = {
            RouteSubAction: { prev: "RouteStockEntry", params: ["warehouse", "bin"] },
            RouteStockEntry: { prev: "RouteStorageBin", params: ["warehouse"] },
            RouteStorageBin: { prev: "RouteWarehouse", params: [] }
        };

        return BaseController.extend("stockappui.controller.BaseController", {

            getModelMain() {
                return this.getOwnerComponent().getModel("vm");
            },

            getRouter() {
                return this.getOwnerComponent().getRouter();
            },

            getI18nText(key) {
                return this.getView().getModel("i18n").getResourceBundle().getText(key);
            },

            addFunctionKeyListener(func) {
                this.funcPressKey = func || this.getFuncPressKey();
                window.addEventListener("keydown", this.funcPressKey);
            },

            removeFunctionKeyListener() {
                window.removeEventListener("keydown", this.funcPressKey);
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

            getFuncPressKey() {
                return (event) => {
                    const key = event.key;
                    if (!FN_KEYS.has(key)) return;
                    const active = document.activeElement;
                    const isEditable = active && (
                        active.tagName === "INPUT" ||
                        active.tagName === "TEXTAREA" ||
                        active.isContentEditable
                    );
                    if (isEditable && key === "Enter") return;
                    if (key.startsWith("F")) event.preventDefault();
                    this.pressKeyOnKeyboard(key);
                };
            },

            initBackButtonRouting(routeName) {
                this._boundRouteName = routeName;
                this.getRouter().getRoute(routeName).attachPatternMatched(this._onPatternMatched, this);
            },

            attachViewShowHide(onAfterShow, onAfterHide) {
                const del = {};
                if (onAfterShow) del.onAfterShow = () => onAfterShow.call(this);
                if (onAfterHide) del.onAfterHide = () => onAfterHide.call(this);
                this.getView().addEventDelegate(del);
                this._viewDelegate = del;
            },


            onBackUp() {
                const vm = this.getModelMain();
                const router = this.getRouter();
                const currentRoute = vm.getProperty("/currentRoute");
                const cfg = ROUTE_HIERARCHY[currentRoute];
                if (!cfg) {
                    router.navTo("RouteWarehouse", {}, true);
                    return;
                }
                const lastArgs = vm.getProperty("/routeArgs") || {};
                const params = {};
                for (const key of cfg.params) {
                    const val = lastArgs[key] ?? vm.getProperty("/" + key) ?? "";
                    params[key] = encodeURIComponent(val);
                }
                router.navTo(cfg.prev, params, true);
            },

            _onPatternMatched(oEvt) {
                const vm = this.getModelMain();
                vm.setProperty("/currentRoute", oEvt.getParameter("name"));
                vm.setProperty("/routeArgs", oEvt.getParameter("arguments") || {});
                if (typeof this.onRouteMatchedExt === "function") {
                    return this.onRouteMatchedExt(oEvt);
                }
            }
        });
    }
);