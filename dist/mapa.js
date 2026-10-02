/* =====================================================================
 * Programa CRECIDA — Mapa operativo (Leaflet)
 * Base Esri Topográfico + departamentos coloreados por riesgo (CRECIDA)
 * + límite provincial + marcadores de capas (animados). Identidad propia.
 * Reemplaza al SVG. Expone window.CRECIDA_MAPA.
 * ===================================================================== */
(function () {
  "use strict";

  const COLOR_RIESGO = { red: "#dc2626", orange: "#f59e0b", yellow: "#eab308", green: "#16a34a" };
  const ESRI_TOPO = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";

  let map = null;
  let depLayer = null;
  let limLayer = null;
  const capasGroups = {};   // id -> L.layerGroup
  let listo = false;

  function norm(s) {
    return (s || "").toString().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }
  // normalizado(GeoJSON) -> nombre canónico de la app
  function tablaNombres() {
    const t = {};
    (window.TUCUMAN_DEPARTMENTS || []).forEach((d) => { t[norm(d.name)] = d.name; });
    return t;
  }
  let NOMBRES = {};

  function appName(feature) {
    const g = (feature.properties && (feature.properties.departamento || feature.properties.nombre)) || "";
    return NOMBRES[norm(g)] || g;
  }
  function riesgoDe(nombre) {
    try {
      if (typeof window.getJurisdiction === "function") {
        const j = window.getJurisdiction(nombre);
        return (j && j.risk) || "green";
      }
    } catch (e) {}
    return "green";
  }
  function estiloDep(feature) {
    const nombre = appName(feature);
    const sel = (window.CRECIDA_selectedName && window.CRECIDA_selectedName()) === nombre;
    const risk = riesgoDe(nombre);
    return {
      color: sel ? "#0b1220" : "#ffffff",
      weight: sel ? 2.5 : 1,
      fillColor: COLOR_RIESGO[risk] || COLOR_RIESGO.green,
      fillOpacity: risk === "green" ? 0.12 : 0.5,
    };
  }

  function init() {
    const cont = document.getElementById("provinceMap");
    if (!cont || !window.L) { return setTimeout(init, 80); }
    NOMBRES = tablaNombres();

    map = L.map(cont, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    map.setView([-26.95, -65.3], 8);
    L.tileLayer(ESRI_TOPO, { maxZoom: 18, attribution: "Mapa base © Esri" }).addTo(map);

    fetch("data/limite_provincial.geojson").then((r) => r.json()).then((lim) => {
      limLayer = L.geoJSON(lim, { style: { color: "#0b3a53", weight: 2.5, fill: false, opacity: 0.8 } }).addTo(map);
    }).catch(() => {});

    fetch("data/departamentos.geojson").then((r) => r.json()).then((dep) => {
      depLayer = L.geoJSON(dep, {
        style: estiloDep,
        onEachFeature: (f, layer) => {
          const nombre = appName(f);
          layer.bindTooltip(nombre, { sticky: true });
          layer.on("click", () => { if (typeof window.selectJurisdiction === "function") window.selectJurisdiction(nombre); });
        },
      }).addTo(map);
      try { map.fitBounds(depLayer.getBounds(), { padding: [10, 10] }); } catch (e) {}
      listo = true;
      recolorear();
    }).catch(() => {});
  }

  function recolorear() {
    if (depLayer) depLayer.setStyle(estiloDep);
    if (map) setTimeout(() => map.invalidateSize(), 0);
  }

  // ── API de capas (marcadores) ──────────────────────────────────────
  function pinHTML(color, icono, pocos) {
    if (pocos && icono) {
      return '<div class="lpin" style="--c:' + color + '"><span class="lpulse"></span><span class="ldot">' + icono + '</span></div>';
    }
    return '<div class="ldotmini" style="background:' + color + '"></div>';
  }
  function setCapa(id, items, cfg) {
    if (!map) return;
    clearCapa(id);
    const grupo = L.layerGroup();
    const pocos = !!cfg.pocos, icono = cfg.icono || "";
    (items || []).forEach((p) => {
      if (!isFinite(p.lat) || !isFinite(p.lon)) return;
      const html = pinHTML(p.color || cfg.color || "#0e6e8c", icono, pocos);
      const size = pocos ? 30 : 14;
      const icon = L.divIcon({ className: "crecida-pin", html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const m = L.marker([p.lat, p.lon], { icon: icon });
      m.bindTooltip((p.nombre || "") + (p.sub ? " · " + p.sub : ""));
      if (typeof cfg.onClick === "function") m.on("click", () => cfg.onClick(p));
      grupo.addLayer(m);
    });
    grupo.addTo(map);
    capasGroups[id] = grupo;
  }
  function clearCapa(id) {
    if (capasGroups[id]) { map.removeLayer(capasGroups[id]); delete capasGroups[id]; }
  }

  window.CRECIDA_MAPA = { recolorear: recolorear, setCapa: setCapa, clearCapa: clearCapa, get listo() { return listo; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
