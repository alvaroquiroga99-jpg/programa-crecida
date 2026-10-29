/* Capas de clima (Open-Meteo, gratis, sin clave) — cubren Tucumán donde el radar no llega.
   Render estilo "campo interpolado" (bilinear sobre grilla) como imageOverlay de Leaflet.
   - Precipitación: se desvanece donde no llueve (alpha por intensidad).
   - Temperatura: campo continuo recortado al límite provincial.
   Expone window.CRECIDA_precip y window.CRECIDA_temp. */
(function () {
  "use strict";
  var REGION = { la1: -25.5, la2: -28.5, lo1: -67.0, lo2: -63.5, nx: 16, ny: 16 };
  var BOUNDS = [[REGION.la2, REGION.lo1], [REGION.la1, REGION.lo2]];
  var CW = 360, CH = Math.round(CW * (REGION.la1 - REGION.la2) / (REGION.lo2 - REGION.lo1));

  var RAIN_STOPS = [[0, [147,197,253]], [0.5, [59,130,246]], [2, [29,78,216]], [5, [245,158,11]], [12, [220,38,38]]];
  var TEMP_STOPS = [[8, [30,58,138]], [14, [37,99,235]], [20, [34,211,238]], [26, [253,224,71]], [32, [245,158,11]], [40, [220,38,38]]];

  var cacheGrid = null, cacheTs = 0;        // {precip:[][], temp:[][]}
  var provRings = null, provTried = false;  // anillos del límite provincial (lon/lat)
  var layers = { precip: null, temp: null };
  var timers = { precip: null, temp: null };

  function mapa() { return window.CRECIDA_MAPA && window.CRECIDA_MAPA.map && window.CRECIDA_MAPA.map(); }

  function ramp(stops, v) {
    if (v <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        var a = stops[i-1], b = stops[i], f = (v - a[0]) / (b[0] - a[0]);
        return [Math.round(a[1][0]+(b[1][0]-a[1][0])*f), Math.round(a[1][1]+(b[1][1]-a[1][1])*f), Math.round(a[1][2]+(b[1][2]-a[1][2])*f)];
      }
    }
    return stops[stops.length-1][1];
  }

  async function traerGrid() {
    if (cacheGrid && (Date.now() - cacheTs) < 120000) return cacheGrid;
    var R = REGION, dx = (R.lo2 - R.lo1) / (R.nx - 1), dy = (R.la1 - R.la2) / (R.ny - 1);
    var lats = [], lons = [];
    for (var r = 0; r < R.ny; r++) for (var c = 0; c < R.nx; c++) { lats.push(+(R.la1 - r*dy).toFixed(3)); lons.push(+(R.lo1 + c*dx).toFixed(3)); }
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats.join(",") + "&longitude=" + lons.join(",") + "&current=precipitation,temperature_2m";
    var arr = await fetch(url).then(function (x) { return x.json(); });
    var list = Array.isArray(arr) ? arr : [arr];
    var P = [], T = [], hay = false;
    for (var rr = 0; rr < R.ny; rr++) { P.push([]); T.push([]); for (var cc = 0; cc < R.nx; cc++) {
      var o = list[rr*R.nx + cc] || {}, cur = o.current || {};
      var mm = typeof cur.precipitation === "number" ? cur.precipitation : 0;
      var tc = typeof cur.temperature_2m === "number" ? cur.temperature_2m : null;
      if (mm >= 0.1) hay = true;
      P[rr].push(mm); T[rr].push(tc);
    } }
    cacheGrid = { precip: P, temp: T, hayLluvia: hay }; cacheTs = Date.now();
    return cacheGrid;
  }

  function bilinear(vals, lon, lat) {
    var dx = (REGION.lo2 - REGION.lo1) / (REGION.nx - 1), dy = (REGION.la1 - REGION.la2) / (REGION.ny - 1);
    var gx = (lon - REGION.lo1) / dx, gy = (REGION.la1 - lat) / dy;
    gx = Math.max(0, Math.min(REGION.nx - 1, gx)); gy = Math.max(0, Math.min(REGION.ny - 1, gy));
    var x0 = Math.floor(gx), x1 = Math.min(REGION.nx - 1, x0 + 1), fx = gx - x0;
    var y0 = Math.floor(gy), y1 = Math.min(REGION.ny - 1, y0 + 1), fy = gy - y0;
    var v00 = vals[y0][x0], v10 = vals[y0][x1], v01 = vals[y1][x0], v11 = vals[y1][x1];
    if (v00 == null || v10 == null || v01 == null || v11 == null) return null;
    return (v00*(1-fx) + v10*fx) * (1-fy) + (v01*(1-fx) + v11*fx) * fy;
  }

  async function cargarProvincia() {
    if (provTried) return provRings;
    provTried = true;
    try {
      var gj = await fetch("data/limite_provincial.geojson").then(function (x) { return x.json(); });
      var rings = [];
      (gj.features || []).forEach(function (f) {
        var g = f.geometry; if (!g) return;
        if (g.type === "Polygon") g.coordinates.forEach(function (r) { rings.push(r); });
        else if (g.type === "MultiPolygon") g.coordinates.forEach(function (p) { p.forEach(function (r) { rings.push(r); }); });
      });
      provRings = rings;
    } catch (e) { provRings = null; }
    return provRings;
  }

  function campoCanvas(vals, stops, alphaFn, clipRings) {
    // 1) campo a imageData (sin clip)
    var tmp = document.createElement("canvas"); tmp.width = CW; tmp.height = CH;
    var tctx = tmp.getContext("2d");
    var img = tctx.createImageData(CW, CH), d = img.data;
    for (var py = 0; py < CH; py++) {
      var lat = REGION.la1 - (py / (CH - 1)) * (REGION.la1 - REGION.la2);
      for (var px = 0; px < CW; px++) {
        var lon = REGION.lo1 + (px / (CW - 1)) * (REGION.lo2 - REGION.lo1);
        var v = bilinear(vals, lon, lat); if (v == null) continue;
        var a = alphaFn(v); if (a <= 0) continue;
        var rgb = ramp(stops, v), idx = (py * CW + px) * 4;
        d[idx] = rgb[0]; d[idx+1] = rgb[1]; d[idx+2] = rgb[2]; d[idx+3] = Math.round(a * 255);
      }
    }
    tctx.putImageData(img, 0, 0);
    if (!clipRings || !clipRings.length) return tmp;
    // 2) recortar al límite provincial (drawImage respeta clip; putImageData no)
    var out = document.createElement("canvas"); out.width = CW; out.height = CH;
    var octx = out.getContext("2d");
    octx.beginPath();
    clipRings.forEach(function (ring) {
      ring.forEach(function (pt, i) {
        var x = (pt[0] - REGION.lo1) / (REGION.lo2 - REGION.lo1) * (CW - 1);
        var y = (REGION.la1 - pt[1]) / (REGION.la1 - REGION.la2) * (CH - 1);
        if (i === 0) octx.moveTo(x, y); else octx.lineTo(x, y);
      });
      octx.closePath();
    });
    octx.clip();
    octx.drawImage(tmp, 0, 0);
    return out;
  }

  function quitar(tipo) {
    var m = mapa();
    if (layers[tipo] && m) { try { m.removeLayer(layers[tipo]); } catch (e) {} }
    layers[tipo] = null;
    if (timers[tipo]) { clearInterval(timers[tipo]); timers[tipo] = null; }
    if (!layers.precip && !layers.temp) unbindHover();
  }

  async function pintar(tipo) {
    var m = mapa(); if (!m) return false;
    var g = await traerGrid();
    var cv;
    if (tipo === "precip") {
      cv = campoCanvas(g.precip, RAIN_STOPS, function (mm) { return mm < 0.12 ? 0 : Math.min(0.8, 0.15 + mm * 0.08); }, null);
      try { window.CRECIDA_precipHay = !!g.hayLluvia; if (window.CRECIDA_onPrecip) window.CRECIDA_onPrecip(!!g.hayLluvia); } catch (e) {}
    } else {
      var rings = await cargarProvincia();
      cv = campoCanvas(g.temp, TEMP_STOPS, function () { return 0.62; }, rings);
    }
    var nueva = L.imageOverlay(cv.toDataURL(), BOUNDS, { opacity: 1, interactive: false, className: "clima-overlay" });
    if (layers[tipo]) { try { m.removeLayer(layers[tipo]); } catch (e) {} }
    layers[tipo] = nueva; nueva.addTo(m);
    return true;
  }

  function encender(tipo) {
    return pintar(tipo).then(function (ok) {
      if (!ok) return false;
      if (timers[tipo]) clearInterval(timers[tipo]);
      timers[tipo] = setInterval(function () { if (layers[tipo]) { cacheTs = 0; pintar(tipo); } }, 15 * 60 * 1000);
      bindHover();
      return true;
    }).catch(function () { return false; });
  }

  async function toggle(tipo, on) { if (on) return await encender(tipo); quitar(tipo); return false; }

  // ── Lectura al pasar el puntero (mm / °C del punto bajo el cursor) ──
  var readoutEl = null, hoverBound = false;
  function ensureReadout(m) {
    if (readoutEl) return readoutEl;
    readoutEl = document.createElement("div");
    readoutEl.className = "clima-readout";
    readoutEl.style.display = "none";
    m.getContainer().appendChild(readoutEl);
    return readoutEl;
  }
  function onHoverMove(e) {
    var m = mapa(); if (!m || !cacheGrid) return;
    var lat = e.latlng.lat, lon = e.latlng.lng;
    if (lat > REGION.la1 || lat < REGION.la2 || lon < REGION.lo1 || lon > REGION.lo2) { if (readoutEl) readoutEl.style.display = "none"; return; }
    var parts = [];
    if (layers.precip) { var mm = bilinear(cacheGrid.precip, lon, lat); if (mm != null) parts.push("\uD83C\uDF26\uFE0F " + (mm < 0.05 ? "0" : mm.toFixed(1)) + " mm/h"); }
    if (layers.temp) { var t = bilinear(cacheGrid.temp, lon, lat); if (t != null) parts.push("\uD83C\uDF21\uFE0F " + t.toFixed(1) + " \u00B0C"); }
    if (!parts.length) { if (readoutEl) readoutEl.style.display = "none"; return; }
    var el = ensureReadout(m);
    el.innerHTML = parts.join("<br>");
    var pt = e.containerPoint;
    el.style.left = (pt.x + 14) + "px";
    el.style.top = (pt.y + 14) + "px";
    el.style.display = "block";
  }
  function onHoverOut() { if (readoutEl) readoutEl.style.display = "none"; }
  function bindHover() {
    var m = mapa(); if (!m || hoverBound) return;
    m.on("mousemove", onHoverMove); m.on("mouseout", onHoverOut);
    hoverBound = true;
  }
  function unbindHover() {
    var m = mapa();
    if (m && hoverBound) { m.off("mousemove", onHoverMove); m.off("mouseout", onHoverOut); }
    hoverBound = false;
    if (readoutEl) readoutEl.style.display = "none";
  }

  window.CRECIDA_precip = { toggle: function (on) { return toggle("precip", on); }, encendido: function () { return !!layers.precip; } };
  window.CRECIDA_temp = { toggle: function (on) { return toggle("temp", on); }, encendido: function () { return !!layers.temp; } };
})();
