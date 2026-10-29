/* Caudal de ríos — pronóstico GloFAS vía Open-Meteo Flood API (gratis, sin clave).
   Complementa los aforos observados del INA con un pronóstico de caudal (modelado).
   Prioriza sur y este de Tucumán (zonas de alerta El Niño/ENOS) e incluye el aporte
   aguas arriba de Catamarca sobre la cuenca del Marapa. */
(function () {
  "use strict";
  var GRUPOS = [
    { g: "Sur y este · prioridad", puntos: [
      { n: "Marapa · La Madrid", lat: -27.52, lon: -65.32 },
      { n: "Salí–Dulce · Río Hondo (SE)", lat: -27.52, lon: -64.92 },
      { n: "Río Salí · centro-este", lat: -27.02, lon: -65.32 },
      { n: "Río Gastona · Concepción", lat: -27.35, lon: -65.60 }
    ]},
    { g: "Aguas arriba · vecinas", puntos: [
      { n: "Catamarca · pie de sierra → Marapa", lat: -27.42, lon: -65.68 },
      { n: "Salta · alto Salí (R. de la Frontera)", lat: -25.78, lon: -64.83 }
    ]},
    { g: "Norte · referencia", puntos: [
      { n: "Salí · El Cadillal (capta alto Salí + Salta)", lat: -26.62, lon: -65.22 }
    ]}
  ];
  var PLANOS = [];
  GRUPOS.forEach(function (gr) { gr.puntos.forEach(function (p) { p._g = gr.g; PLANOS.push(p); }); });

  function el(id) { return document.getElementById(id); }
  function nivel(pct) {
    if (pct >= 50) return "rio-sube-fuerte";
    if (pct >= 10) return "rio-sube";
    if (pct <= -10) return "rio-baja";
    return "rio-estable";
  }
  async function refrescar() {
    var box = el("riosBox");
    if (!box) return;
    var lats = PLANOS.map(function (r) { return r.lat; }).join(",");
    var lons = PLANOS.map(function (r) { return r.lon; }).join(",");
    var u = "https://flood-api.open-meteo.com/v1/flood?latitude=" + lats +
      "&longitude=" + lons + "&daily=river_discharge&forecast_days=8&past_days=2";
    try {
      var data = await fetch(u).then(function (r) { return r.json(); });
      var arr = Array.isArray(data) ? data : [data];
      var cont = el("riosLista");
      cont.innerHTML = "";
      var algo = false, suben = 0, grupoActual = null;
      arr.forEach(function (o, i) {
        var punto = PLANOS[i];
        if (!punto) return;
        var serie = (o.daily && o.daily.river_discharge) || [];
        if (!serie.length) return;
        var hoy = serie[2] != null ? serie[2] : serie[0];
        var fut = serie.slice(3);
        var pico = Math.max.apply(null, fut.concat([hoy]));
        var pct = hoy > 0 ? Math.round((pico - hoy) / hoy * 100) : 0;
        algo = true;
        if (pct >= 10) suben++;
        if (punto._g !== grupoActual) {
          grupoActual = punto._g;
          var h = document.createElement("div");
          h.className = "rio-grupo";
          h.textContent = grupoActual;
          cont.appendChild(h);
        }
        var cls = nivel(pct);
        var flecha = pct >= 10 ? "↑" : (pct <= -10 ? "↓" : "→");
        var txt = pct >= 10 ? ("+" + pct + "% en 7 d") : (pct <= -10 ? (pct + "% en 7 d") : "estable");
        var row = document.createElement("div");
        row.className = "rio-row " + cls;
        row.innerHTML = "<div class='rio-n'>" + punto.n + "</div>" +
          "<div class='rio-hoy'>" + Math.round(hoy) + " <small>m³/s</small></div>" +
          "<div class='rio-tend'>" + flecha + " " + txt + "</div>";
        cont.appendChild(row);
      });
      var tot = el("riosResumen");
      if (tot) { tot.textContent = suben ? (suben + " en crecida prevista") : "Sin crecidas previstas"; tot.className = "rios-total " + (suben ? "rio-sube" : "rio-estable"); }
      box.hidden = !algo;
    } catch (e) { box.hidden = true; }
  }
  window.CRECIDA_rios = { refrescar: refrescar };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refrescar);
  else refrescar();
  setInterval(refrescar, 60 * 60 * 1000);
})();
