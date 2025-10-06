sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function (BaseController) {


        const FN_KEYS = new Set(["Enter", "F1", "F2", "F6", "F7", "Escape"]);
        return BaseController.extend("stockappui.controller.BaseController", {

            getModelMain: function () {
                return this.getView().getModel();
            },

            getRouter() {
                return this.getOwnerComponent().getRouter();
            },

            getI18nText(key) {
                return this.getView().getModel("i18n").getResourceBundle().getText(key);
            },

            loadXmlFragment(fragmentName) {
                if (!this[fragmentName]) {
                    this[fragmentName] = this.loadFragment({ name: fragmentName });
                }
                return this[fragmentName];
            },

            async openFragment(fragmentPath) {
                const dialog = await this.loadXmlFragment(fragmentPath);

                dialog.open();
            },

            addFunctionKeyListener: function (func) {
                this.funcPressKey = func || this.getFuncPressKey();
                window.addEventListener("keydown", this.funcPressKey);
            },

            removeFunctionKeyListener: function () {
                window.removeEventListener("keydown", this.funcPressKey);
            },

            getFuncPressKey: function () {
                return (event) => {
                    const key = event.key;
                    if (!FN_KEYS.has(key)) return;

                    // ignore Enter while typing in an Input/TextArea
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
        });
    }
);