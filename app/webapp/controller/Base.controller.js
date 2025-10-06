sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function (BaseController) {


        return BaseController.extend("stockappui.controller.BaseController", {
            getModelMain: function () {
                return this.getView().getModel();
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
                    event.preventDefault();
                    this.pressKeyOnKeyboard(event.key);
                };
            },
        });
    }
);