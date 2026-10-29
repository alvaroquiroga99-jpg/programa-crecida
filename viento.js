/* Capa de viento animada (leaflet-velocity + Open-Meteo, gratis, sin clave).
   Partículas estilo Windy sobre Tucumán + provincias vecinas. */
(function () {
  "use strict";
  var REGION = { la1: -25.5, la2: -28.5, lo1: -67.0, lo2: -63.5, nx: 13, ny: 13 };
  var layer = null, timer = null;

  async function buildData() {
    var R = REGION, dx = (R.lo2 - R.lo1) / (R.nx - 1), dy = (R.la1 - R.la2) / (R.ny - 1);
    var lats = [], lons = [];
    for (var r = 0; r < R.ny; r++) for (var c = 0; c < R.nx; c++) {
      lats.push(+(R.la1 - r * dy).toFixed(3)); lons.push(+(R.lo1 + c * dx).toFixed(3));
    }
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats.join(",") +
      "&longitude=" + lons.join(",") + "&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms";
    var arr = await fetch(url).then(function (x) { return x.json(); });
    var list = Array.isArray(arr) ? arr : [arr];
    var U = [], V = [];
    list.forEach(function (o) {
      var s = (o.current && o.current.wind_speed_10m) || 0;
      var d = (o.current && o.current.wind_direction_10m) || 0;
      var rad = d * Math.PI / 180;
      U.push(-s * Math.sin(rad)); V.push(-s * Math.cos(rad));
    });
    function h(n, nm) {
      return { parameterUnit: "m.s-1", parameterNumber: n, parameterNumberName: nm, parameterCategory: 2,
        nx: R.nx, ny: R.ny, lo1: R.lo1, la1: R.la1, dx: dx, dy: dy, refTime: new Date().toISOString(), forecastTime: 0 };
    }
    return [{ header: h(2, "U"), data: U }, { header: h(3, "V"), data: V }];
  }

  function mapa() { return window.CRECIDA_MAPA && window.CRECIDA_MAPA.map && window.CRECIDA_MAPA.map(); }

  async function encender() {
    var map = mapa();
    if (!map || !window.L || !L.velocityLayer) return false;
    var data = await buildData();
    if (layer) { try { map.removeLayer(layer); } catch (e) {} layer = null; }
    layer = L.velocityLayer({
      displayValues: true,
      displayOptions: { velocityType: "Viento", position: "bottomleft", emptyString: "Pasá el mouse por el mapa", speedUnit: "m/s", angleConvention: "bearingCW" },
      data: data, maxVelocity: 14, velocityScale: 0.018, lineWidth: 2, particleAge: 90, particleMultiplier: 0.015,
      colorScale: ["#1e3a8a", "#2563eb", "#0ea5e9", "#22c55e", "#eab308", "#f97316", "#dc2626"]
    });
    layer.addTo(map);
    if (timer) clearInterval(timer);
    timer = setInterval(async function () { try { if (layer) { var d = await buildData(); layer.setData(d); } } catch (e) {} }, 30 * 60 * 1000);
    return true;
  }
  function apagar() {
    var map = mapa();
    if (layer && map) { try { map.removeLayer(layer); } catch (e) {} }
    layer = null;
    if (timer) { clearInterval(timer); timer = null; }
  }
  async function toggle(on) { if (on) return await encender(); apagar(); return false; }

  window.CRECIDA_viento = { toggle: toggle, encendido: function () { return !!layer; } };
})();
