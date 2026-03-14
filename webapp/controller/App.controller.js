sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/thirdparty/jquery"
], function (Controller, JSONModel, jQuery) {
    "use strict";

    var CHARTS = [
        { symbol: "BTCUSDC", title: "BTC/USDC", canvasId: "canvasBtc", color: "#f7931a" },
        { symbol: "ETHUSDC", title: "ETH/USDC", canvasId: "canvasEth", color: "#627eea" },
        { symbol: "SOLUSDC", title: "SOL/USDC", canvasId: "canvasSol", color: "#14f195" },
        { symbol: "POLUSDC", title: "POL/USDC", canvasId: "canvasPol", color: "#8247e5" },
        { symbol: "AVAXUSDC", title: "AVAX/USDC", canvasId: "canvasAvax", color: "#e84142" },
        { symbol: "LINKUSDC", title: "LINK/USDC", canvasId: "canvasLink", color: "#2a5ada" }
    ];

    return Controller.extend("cryptodash.controller.App", {
        onInit: function () {
            this._refreshInterval = null;
            this._chartInstances = {};
            this._latestData = {};

            var oErrors = {};
            var oPrices = {};
            var oChanges = {};
            var oChangeStates = {};
            CHARTS.forEach(function (oChart) {
                oErrors[oChart.symbol] = "";
                oPrices[oChart.symbol] = "-";
                oChanges[oChart.symbol] = "-";
                oChangeStates[oChart.symbol] = "None";
            });

            var oCryptoModel = new JSONModel({
                errors: oErrors,
                prices: oPrices,
                changes: oChanges,
                changeStates: oChangeStates,
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

                var oCanvas = document.getElementById(oChart.canvasId);

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
            var sKlineUrl = "https://api.binance.com/api/v3/klines?symbol=" + encodeURIComponent(sSymbol) + "&interval=1m&limit=30";
            var sTickerUrl = "https://api.binance.com/api/v3/ticker/24hr?symbol=" + encodeURIComponent(sSymbol);

            var pKlines = jQuery.ajax({
                url: sKlineUrl,
                method: "GET",
                dataType: "json"
            });

            var pTicker = jQuery.ajax({
                url: sTickerUrl,
                method: "GET",
                dataType: "json"
            });

            return Promise.all([pKlines, pTicker])
                .then(function (aResult) {
                    var aKlines = aResult[0];
                    var oTicker = aResult[1];

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
                    this._setChange(sSymbol, oTicker && oTicker.priceChangePercent);
                    this._applyChartData(sSymbol, aSeries);
                }.bind(this))
                .catch(function (oError) {
                    this._latestData[sSymbol] = [];
                    this._setPrice(sSymbol, "-");
                    this._setChange(sSymbol, null);
                    this._setError(sSymbol, "Unable to load " + sSymbol + " (" + (oError.statusText || oError.message || "Request failed") + ")");
                    this._applyChartData(sSymbol, []);
                }.bind(this));
        },

        _setChange: function (sSymbol, vPercent) {
            var fPercent = Number(vPercent);
            var sText = "-";
            var sState = "None";

            if (isFinite(fPercent)) {
                sText = (fPercent > 0 ? "+" : "") + fPercent.toFixed(2) + "%";

                if (fPercent > 0) {
                    sState = "Success";
                } else if (fPercent < 0) {
                    sState = "Error";
                }
            }

            this.getView().getModel("crypto").setProperty("/changes/" + sSymbol, sText);
            this.getView().getModel("crypto").setProperty("/changeStates/" + sSymbol, sState);
        },

        _setError: function (sSymbol, sError) {
            this.getView().getModel("crypto").setProperty("/errors/" + sSymbol, sError);
        },

        _setPrice: function (sSymbol, vPrice) {
            this.getView().getModel("crypto").setProperty("/prices/" + sSymbol, this._formatPrice(vPrice));
        },

        _formatPrice: function (vPrice) {
            var fValue = Number(vPrice);
            if (!isFinite(fValue)) {
                return "-";
            }

            return new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            }).format(fValue);
        },

        _applyChartData: function (sSymbol, aData) {
            var oChart = this._chartInstances[sSymbol];
            if (!oChart) {
                return;
            }

            var sLineColor = "#9e9e9e";
            var sFillColor = "rgba(158, 158, 158, 0.2)";

            if (aData.length >= 2) {
                var fFirst = aData[0].price;
                var fLast = aData[aData.length - 1].price;

                if (fLast > fFirst) {
                    sLineColor = "#2e7d32";
                    sFillColor = "rgba(46, 125, 50, 0.2)";
                } else if (fLast < fFirst) {
                    sLineColor = "#c62828";
                    sFillColor = "rgba(198, 40, 40, 0.2)";
                }
            }

            oChart.data.labels = aData.map(function (oPoint) {
                return oPoint.time;
            });
            oChart.data.datasets[0].data = aData.map(function (oPoint) {
                return oPoint.price;
            });
            oChart.data.datasets[0].borderColor = sLineColor;
            oChart.data.datasets[0].backgroundColor = sFillColor;
            oChart.update("none");
        }
    });
});
