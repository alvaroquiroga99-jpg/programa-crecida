/* Pronóstico de lluvia — Open-Meteo (gratuito, sin registro, sin clave).
   No toca ninguna capa ni dato existente: sólo llena #pronosticoBox. */
(function () {
  "use strict";
  var TZ = "America/Argentina/Cordoba";
  var DEF = { lat: -26.83, lon: -65.22, nombre: "San Miguel de Tucumán" };

  function el(id) { return document.getElementById(id); }

  function fmtHora(iso) {
    // iso tipo "2026-10-05T14:00"
    var h = iso.slice(11, 13);
    return h + "h";
  }

  function nivel(mm) {
    if (mm >= 10) return "lluvia-fuerte";
    if (mm >= 2) return "lluvia-media";
    if (mm >= 0.2) return "lluvia-leve";
    return "lluvia-nula";
  }

  async function refrescar(lat, lon, nombre) {
    var box = el("pronosticoBox");
    if (!box) return;
    lat = (lat == null ? DEF.lat : lat);
    lon = (lon == null ? DEF.lon : lon);
    nombre = nombre || DEF.nombre;
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
      "&longitude=" + lon +
      "&hourly=precipitation,precipitation_probability&forecast_days=2&timezone=" +
      encodeURIComponent(TZ);
    try {
      var data = await fetch(url).then(function (r) { return r.json(); });
      var H = data && data.hourly;
      if (!H || !H.time || !H.time.length) { box.hidden = true; return; }
      var ahora = Date.now();
      // índice de la primera hora >= ahora
      var start = 0;
      for (var i = 0; i < H.time.length; i++) {
        if (new Date(H.time[i]).getTime() >= ahora - 3600000) { start = i; break; }
      }
      var horas = [], total = 0, probMax = 0;
      for (var j = start; j < Math.min(start + 24, H.time.length); j++) {
        var mm = H.precipitation[j] || 0;
        var pp = H.precipitation_probability ? (H.precipitation_probability[j] || 0) : 0;
        total += mm;
        if (pp > probMax) probMax = pp;
        horas.push({ t: H.time[j], mm: mm, pp: pp });
      }
      // mostrar cada 3 horas para que entre prolijo
      var cont = el("pronosticoHoras");
      cont.innerHTML = "";
      for (var k = 0; k < horas.length; k += 3) {
        var g = horas.slice(k, k + 3);
        var mmSum = g.reduce(function (a, b) { return a + b.mm; }, 0);
        var ppG = Math.max.apply(null, g.map(function (x) { return x.pp; }));
        var cell = document.createElement("div");
        cell.className = "pron-cell " + nivel(mmSum);
        cell.innerHTML = "<span class='pron-h'>" + fmtHora(g[0].t) + "</span>" +
          "<span class='pron-mm'>" + (mmSum >= 0.1 ? mmSum.toFixed(1) : "0") + "<small>mm</small></span>" +
          "<span class='pron-pp'>" + Math.round(ppG) + "%</span>";
        cont.appendChild(cell);
      }
      var tit = el("pronosticoTitulo");
      if (tit) tit.textContent = nombre + " · próximas 24 h";
      var tot = el("pronosticoTotal");
      if (tot) {
        tot.textContent = total >= 0.1 ? (total.toFixed(1) + " mm · " + Math.round(probMax) + "% prob.") : "Sin lluvia prevista";
        tot.className = "pronostico-total " + nivel(total);
      }
      box.hidden = false;
    } catch (e) {
      box.hidden = true;
    }
  }

  window.CRECIDA_pronostico = { refrescar: refrescar };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { refrescar(); });
  } else {
    refrescar();
  }
  // refrescar cada 30 min
  setInterval(function () { refrescar(); }, 30 * 60 * 1000);
})();
