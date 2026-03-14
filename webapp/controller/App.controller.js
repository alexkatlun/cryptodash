sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/thirdparty/jquery"
], function (Controller, JSONModel, jQuery) {
    "use strict";

    var CHARTS = [
        { symbol: "BTCUSDC", title: "BTC/USDC", htmlId: "chartBtc", color: "#f7931a" },
        { symbol: "ETHUSDC", title: "ETH/USDC", htmlId: "chartEth", color: "#627eea" },
        { symbol: "SOLUSDC", title: "SOL/USDC", htmlId: "chartSol", color: "#14f195" },
        { symbol: "POLUSDC", title: "POL/USDC", htmlId: "chartPol", color: "#8247e5" },
        { symbol: "AVAXUSDC", title: "AVAX/USDC", htmlId: "chartAvax", color: "#e84142" },
        { symbol: "LINKUSDC", title: "LINK/USDC", htmlId: "chartLink", color: "#2a5ada" }
    ];

    return Controller.extend("cryptodash.controller.App", {
        onInit: function () {
            this._refreshInterval = null;
            this._chartInstances = {};
            this._latestData = {};

            var oErrors = {};
            var oPrices = {};
            CHARTS.forEach(function (oChart) {
                oErrors[oChart.symbol] = "";
                oPrices[oChart.symbol] = "-";
            });

            var oCryptoModel = new JSONModel({
                errors: oErrors,
                prices: oPrices,
                lastUpdateDisplay: "-"
            });

            this.getView().setModel(oCryptoModel, "crypto");
            this._refreshAllCharts();
            this._refreshInterval = setInterval(this._refreshAllCharts.bind(this), 30000);
        },

        onAfterRendering: function () {
            this._initChartInstances();
        },

        onExit: function () {
            if (this._refreshInterval) {
                clearInterval(this._refreshInterval);
                this._refreshInterval = null;
            }

            Object.keys(this._chartInstances).forEach(function (sSymbol) {
                this._chartInstances[sSymbol].destroy();
            }.bind(this));
            this._chartInstances = {};
        },

        _refreshAllCharts: function () {
            var aPromises = CHARTS.map(function (oItem) {
                return this._loadSymbolData(oItem.symbol);
            }.bind(this));

            Promise.allSettled(aPromises).finally(function () {
                this.getView().getModel("crypto").setProperty(
                    "/lastUpdateDisplay",
                    new Date().toLocaleString()
                );
            }.bind(this));
        },

        _initChartInstances: function () {
            if (!window.Chart) {
                return;
            }

            CHARTS.forEach(function (oChart) {
                if (this._chartInstances[oChart.symbol]) {
                    return;
                }

                var oHtml = this.byId(oChart.htmlId);
                var oDomRef = oHtml && oHtml.getDomRef();
                var oCanvas = oDomRef && oDomRef.querySelector("canvas");

                if (!oCanvas) {
                    return;
                }

                var oInstance = new window.Chart(oCanvas.getContext("2d"), {
                    type: "line",
                    data: {
                        labels: [],
                        datasets: [{
                            label: oChart.title,
                            data: [],
                            borderColor: oChart.color,
                            backgroundColor: oChart.color + "33",
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.25,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                display: false
                            },
                            y: {
                                display: false
                            }
                        }
                    }
                });

                this._chartInstances[oChart.symbol] = oInstance;

                if (this._latestData[oChart.symbol]) {
                    this._applyChartData(oChart.symbol, this._latestData[oChart.symbol]);
                }
            }.bind(this));
        },

        _loadSymbolData: function (sSymbol) {
            var sUrl = "https://api.binance.com/api/v3/klines?symbol=" + encodeURIComponent(sSymbol) + "&interval=1m&limit=30";

            return jQuery.ajax({
                url: sUrl,
                method: "GET",
                dataType: "json"
            })
                .then(function (aKlines) {
                    var aSeries = aKlines.map(function (aCandle) {
                        var oTime = new Date(aCandle[0]);
                        return {
                            time: oTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            price: Number(parseFloat(aCandle[4]).toFixed(6))
                        };
                    });

                    this._latestData[sSymbol] = aSeries;
                    this._setError(sSymbol, "");
                    this._setPrice(sSymbol, aSeries.length ? aSeries[aSeries.length - 1].price : "-");
                    this._applyChartData(sSymbol, aSeries);
                }.bind(this))
                .catch(function (oError) {
                    this._latestData[sSymbol] = [];
                    this._setPrice(sSymbol, "-");
                    this._setError(sSymbol, "Unable to load " + sSymbol + " (" + (oError.statusText || oError.message || "Request failed") + ")");
                    this._applyChartData(sSymbol, []);
                }.bind(this));
        },

        _setError: function (sSymbol, sError) {
            this.getView().getModel("crypto").setProperty("/errors/" + sSymbol, sError);
        },

        _setPrice: function (sSymbol, vPrice) {
            this.getView().getModel("crypto").setProperty("/prices/" + sSymbol, String(vPrice));
        },

        _applyChartData: function (sSymbol, aData) {
            var oChart = this._chartInstances[sSymbol];
            if (!oChart) {
                return;
            }

            oChart.data.labels = aData.map(function (oPoint) {
                return oPoint.time;
            });
            oChart.data.datasets[0].data = aData.map(function (oPoint) {
                return oPoint.price;
            });
            oChart.update("none");
        }
    });
});
