sap.ui.define([
    "sap/ui/core/UIComponent",
    "cryptodash/model/models"
], function (UIComponent, models) {
    "use strict";

    return UIComponent.extend("cryptodash.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");
        }
    });
});
