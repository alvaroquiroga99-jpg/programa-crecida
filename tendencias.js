/* Programa CRECIDA — Aforos INA sobre el mapa (pastillas).
 * Muestra cada estación con su nivel (m) y tendencia; anillo que pulsa SOLO al crecer.
 * Se muestra únicamente cuando el filtro "Riesgo hídrico (INA)" está activo
 * (window.CRECIDA_inaVisible). Diseño propio (no copia de otros geovisores). */
(function () {
  "use strict";
  const CAPA_ID = "ina-trends";
  const REFRESH_MS = 90 * 1000;
  let running = false, lastSig = "";

  function esc(v) { return (v || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function shortDT(v) {
    if (!v) return "";
    const d = new Date(v); if (isNaN(d.getTime())) return ("" + v).slice(0, 16);
    const p = (n) => ("" + n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function colorEstado(estado) {
    if (/evacu/i.test(estado)) return "#dc2626";
    if (/alerta/i.test(estado)) return "#f59e0b";
    return "#0e6e8c";
  }
  function arrow(t) { return t === "crece" ? "▲" : (t === "baja" ? "▼" : "—"); }

  function toSignal(s) {
    const lat = Number(s.lat), lon = Number(s.lon);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    const h = Number(s.altura_m);
    const val = isFinite(h) ? h.toFixed(2) + " m" : "s/d";
    const t = (s.tendencia || "").toLowerCase();
    return {
      lat: lat, lon: lon, nombre: s.nombre, rio: s.rio, value: val, trend: t,
      estado: s.nivel_alerta || "Normal", color: colorEstado(s.nivel_alerta),
      when: shortDT(s.fecha), sub: `${s.rio || ""} · ${val}${s.nivel_alerta ? " · " + s.nivel_alerta : ""}`,
      detalle: [
        ["Nivel", val],
        ["Tendencia", s.tendencia || "s/d"],
        ["Estado", s.nivel_alerta || "Normal"],
        ["Medición", shortDT(s.fecha) || "s/d"],
      ].filter(([, v]) => v),
    };
  }

  function markerHtml(it) {
    const crece = it.trend === "crece";
    const pulse = crece ? " afo-pulse" : "";
    // Nube informativa automática: sólo en estaciones que crecen. Sube, se muestra y se esfuma en bucle.
    const nube = crece
      ? `<span class="afo-nube"><b>${esc(it.nombre || "")}</b><span>${esc(it.rio || "")} · ${esc(it.value)} \u25B2</span></span>`
      : "";
    return `<div class="afo-marker${pulse}" style="--afo:${it.color};--dy:${it.dy || 0}px">
      <span class="afo-ring"></span>
      ${nube}
      <span class="afo-pill"><b>${esc(it.value)}</b> <i>${arrow(it.trend)}</i></span>
    </div>`;
  }

  // separa verticalmente las estaciones que caen muy cerca para que no se tapen
  function declutter(items) {
    const buckets = {};
    items.forEach((it) => { const k = it.lat.toFixed(1) + "," + it.lon.toFixed(1); (buckets[k] = buckets[k] || []).push(it); });
    Object.keys(buckets).forEach((k) => {
      const grp = buckets[k];
      if (grp.length < 2) return;
      grp.sort((a, b) => b.lat - a.lat);
      const step = 30, start = -((grp.length - 1) / 2) * step;
      grp.forEach((it, i) => { it.dy = Math.round(start + i * step); });
    });
    return items;
  }

  async function render() {
    if (running || !window.CRECIDA_MAPA || !window.CRECIDA_fetchINA) return;
    if (!window.CRECIDA_inaVisible) { window.CRECIDA_MAPA.clearCapa(CAPA_ID); lastSig = ""; return; }
    running = true;
    try {
      const data = await window.CRECIDA_fetchINA();
      const items = declutter((Array.isArray(data) ? data : []).map(toSignal).filter(Boolean));
      const sig = items.map((i) => i.nombre + "|" + i.value + "|" + i.trend + "|" + (i.dy || 0)).join(";");
      if (sig === lastSig) { running = false; return; }
      lastSig = sig;
      if (!items.length) { window.CRECIDA_MAPA.clearCapa(CAPA_ID); running = false; return; }
      window.CRECIDA_MAPA.setCapa(CAPA_ID, items, {
        size: 60,
        html: markerHtml,
        popup: (p) => `<div class="cp-card" style="--cp:${p.color}"><p class="cp-eyebrow">Aforo INA · SIyAH</p><h3 class="cp-nombre">${esc(p.nombre || "")}</h3>` +
          (p.detalle || []).map(([k, v]) => `<div class="cp-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("") + `</div>`,
      });
    } catch (e) {
      try { window.CRECIDA_MAPA.clearCapa(CAPA_ID); } catch (_) {}
    } finally { running = false; }
  }

  window.CRECIDA_renderTrendSignals = render;

  function init() {
    [600, 2000, 5000].forEach((d) => setTimeout(render, d));
    setInterval(render, REFRESH_MS);
    const sync = document.getElementById("syncHidroButton");
    if (sync) sync.addEventListener("click", () => setTimeout(render, 1200));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
