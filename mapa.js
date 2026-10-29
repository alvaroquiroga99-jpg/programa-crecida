/* =====================================================================
 * Programa CRECIDA — Mapa operativo (Leaflet)
 * Base Esri Topográfico + departamentos coloreados por riesgo (CRECIDA)
 * + límite provincial + marcadores de capas (animados). Identidad propia.
 * Reemplaza al SVG. Expone window.CRECIDA_MAPA.
 * ===================================================================== */
(function () {
  "use strict";

  const COLOR_RIESGO = { red: "#dc2626", orange: "#f59e0b", yellow: "#eab308", green: "#16a34a" };
  const BASE_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  let map = null;
  let depLayer = null;
  let limLayer = null;
  const depCenters = {};
  const capasGroups = {};   // id -> L.layerGroup
  let areasLayer = null, areasData = null, areaFiltro = "todas", areasVisible = false;
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
  let riesgoVisible = false; // el coloreo por riesgo INA arranca APAGADO (filtro opcional)
  function estiloDep(feature) {
    const nombre = appName(feature);
    const sel = (window.CRECIDA_selectedName && window.CRECIDA_selectedName()) === nombre;
    if (!riesgoVisible) {
      // mapa limpio: departamentos neutros, solo contorno
      return {
        color: sel ? "#0b1220" : "#64748b",
        weight: sel ? 2.5 : 1,
        fillColor: "#94a3b8",
        fillOpacity: sel ? 0.16 : 0.05,
      };
    }
    const risk = riesgoDe(nombre);
    return {
      color: sel ? "#0b1220" : "#ffffff",
      weight: sel ? 2.5 : 1,
      fillColor: COLOR_RIESGO[risk] || COLOR_RIESGO.green,
      fillOpacity: risk === "green" ? 0.12 : 0.5,
    };
  }
  function toggleRiesgo(on) { riesgoVisible = !!on; recolorear(); return riesgoVisible; }

  // ── Áreas Programáticas SIPROSA (capa de polígonos con filtro) ──────
  function estiloArea(feature) {
    const p = feature.properties || {};
    const activa = areaFiltro === "todas" || areaFiltro === p.area_id;
    if (!activa) return { stroke: false, fill: false, opacity: 0, fillOpacity: 0 };
    const puntual = areaFiltro === p.area_id && areaFiltro !== "todas";
    return {
      stroke: true,
      fill: true,
      color: p.area_color || "#475569",
      weight: puntual ? 2.5 : 1.5,
      fillColor: p.area_color || "#94a3b8",
      fillOpacity: puntual ? 0.4 : 0.24,
      opacity: 0.9,
    };
  }
  function dibujarAreas() {
    if (!map || !areasData) return;
    if (!areasLayer) {
      areasLayer = L.geoJSON(areasData, {
        style: estiloArea,
        onEachFeature: (f, layer) => {
          const p = f.properties || {};
          layer.bindTooltip((p.area_nombre || "") + " · " + (p.departamento || ""), { sticky: true });
        },
      });
    } else {
      areasLayer.setStyle(estiloArea);
    }
  }
  function toggleAreas(on) {
    areasVisible = !!on;
    if (areasVisible) {
      const add = () => { dibujarAreas(); if (areasLayer && !map.hasLayer(areasLayer)) areasLayer.addTo(map); };
      if (areasData) add();
      else fetch("data/areas-programaticas.geojson").then((r) => r.json()).then((d) => { areasData = d; add(); }).catch(() => {});
    } else {
      if (areasLayer && map.hasLayer(areasLayer)) map.removeLayer(areasLayer);
    }
    return areasVisible;
  }
  function setAreaFiltro(id) {
    areaFiltro = id || "todas";
    if (areasVisible && areasLayer) areasLayer.setStyle(estiloArea);
    if (areasVisible && areasLayer && areaFiltro !== "todas") {
      try {
        const sel = [];
        areasLayer.eachLayer((l) => { if (l.feature && l.feature.properties.area_id === areaFiltro) sel.push(l); });
        if (sel.length) map.fitBounds(L.featureGroup(sel).getBounds(), { padding: [24, 24] });
      } catch (e) {}
    } else if (areasVisible && areaFiltro === "todas" && depLayer) {
      try { map.fitBounds(depLayer.getBounds(), { padding: [10, 10] }); } catch (e) {}
    }
    return areaFiltro;
  }


  // ── Ríos (hidrografía) ligados al INA ──────────────────────────────
  let riosLayer = null, riosData = null, riosMarkers = null, riosVisible = false;
  const RIO_COL = { evacua: "#dc2626", alerta: "#f59e0b", normal: "#2563eb" };
  function normRio(s) {
    return (s || "").toString().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\bRIO\b/g, " ").replace(/\bARROYO\b/g, " ").replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function estadoAforo(a) {
    const n = (a.nivel_alerta || a.estado || "").toString();
    if (/evacu/i.test(n)) return "evacua";
    if (/alerta/i.test(n)) return "alerta";
    return "normal";
  }
  function rankEstado(e) { return e === "evacua" ? 3 : (e === "alerta" ? 2 : 1); }

  async function indexarINArios() {
    let data = [];
    try { if (window.CRECIDA_fetchINA) data = await window.CRECIDA_fetchINA(); } catch (e) {}
    const porRio = {};
    (data || []).forEach((a) => {
      const key = normRio(a.rio);
      if (!key) return;
      const est = estadoAforo(a), crece = /crece/i.test(a.tendencia || "");
      const score = rankEstado(est) * 10 + (crece ? 1 : 0);
      if (!porRio[key] || score > porRio[key].score) porRio[key] = { estado: est, crece: crece, aforo: a, score: score };
    });
    return { porRio: porRio, lista: data || [] };
  }

  function estiloRio(f) {
    const h = f.properties && f.properties._hit;
    if (h) return { color: RIO_COL[h.estado] || "#2563eb", weight: h.crece ? 4 : 3, opacity: 0.95, lineCap: "round" };
    const esRio = (f.properties && f.properties.tipo) === "river";
    return { color: "#60a5fa", weight: esRio ? 1.6 : 0.9, opacity: esRio ? 0.6 : 0.4, lineCap: "round" };
  }

  async function dibujarRios() {
    if (!map || !riosData) return;
    const idx = await indexarINArios();
    riosData.features.forEach((f) => { f.properties._hit = null; });
    // índice por nombre normalizado
    const porNombre = {};
    riosData.features.forEach((f) => { const k = normRio(f.properties.nombre); if (k) (porNombre[k] = porNombre[k] || []).push(f); });
    const nombresRio = Object.keys(porNombre);
    const aforosAsignados = new Set();
    // 1) match por nombre (exacto o contiene)
    Object.keys(idx.porRio).forEach((k) => {
      let targets = porNombre[k];
      if (!targets) {
        const kk = nombresRio.find((n) => n.length > 2 && (n.indexOf(k) >= 0 || k.indexOf(n) >= 0));
        if (kk) targets = porNombre[kk];
      }
      if (targets) { targets.forEach((f) => { f.properties._hit = idx.porRio[k]; }); aforosAsignados.add(idx.porRio[k].aforo); }
    });
    // 2) aforos sin match por nombre -> río más cercano (~5 km)
    (idx.lista || []).forEach((a) => {
      if (aforosAsignados.has(a)) return;
      const la = +a.lat, lo = +a.lon; if (!isFinite(la) || !isFinite(lo)) return;
      let best = null, bd = Infinity;
      riosData.features.forEach((f) => {
        const c = f.geometry.coordinates;
        for (let i = 0; i < c.length; i += 2) { const dx = c[i][0] - lo, dy = c[i][1] - la; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = f; } }
      });
      if (best && bd < 0.0025) {
        const est = estadoAforo(a), crece = /crece/i.test(a.tendencia || "");
        const score = rankEstado(est) * 10 + (crece ? 1 : 0);
        if (!best.properties._hit || score > best.properties._hit.score) best.properties._hit = { estado: est, crece: crece, aforo: a, score: score };
      }
    });
    // (re)dibujar líneas
    if (riosLayer) { map.removeLayer(riosLayer); riosLayer = null; }
    riosLayer = L.geoJSON(riosData, {
      style: estiloRio,
      onEachFeature: (f, l) => {
        const h = f.properties._hit, base = f.properties.nombre || "Curso de agua";
        const estTxt = h ? (h.estado === "normal" ? (h.crece ? "creciendo" : "normal") : h.estado) : "";
        l.bindTooltip(h ? (base + " · " + estTxt + " (" + h.aforo.altura_m + " m)") : base, { sticky: true });
      },
    });
    // marcadores de crecida/alerta sobre el cauce
    if (riosMarkers) { map.removeLayer(riosMarkers); riosMarkers = null; }
    const marks = [];
    (idx.lista || []).forEach((a) => {
      const est = estadoAforo(a), crece = /crece/i.test(a.tendencia || "");
      if (est === "normal" && !crece) return;
      const la = +a.lat, lo = +a.lon; if (!isFinite(la) || !isFinite(lo)) return;
      const col = est === "evacua" ? "#dc2626" : (est === "alerta" ? "#f59e0b" : "#0ea5e9");
      const icon = L.divIcon({ className: "rio-pin", html: '<span class="rio-crecida" style="--rc:' + col + '"></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
      const m = L.marker([la, lo], { icon: icon });
      m.bindTooltip((a.rio || "Río") + " · " + (est === "normal" ? "creciendo" : est) + " — " + a.altura_m + " m" + (crece ? " ▲" : ""), { direction: "top" });
      marks.push(m);
    });
    riosMarkers = L.layerGroup(marks);
    if (riosVisible) { riosLayer.addTo(map); riosMarkers.addTo(map); }
  }
  function toggleRios(on) {
    riosVisible = !!on;
    if (riosVisible) {
      if (riosData) dibujarRios();
      else fetch("data/rios-tucuman.geojson").then((r) => r.json()).then((d) => { riosData = d; dibujarRios(); }).catch(() => {});
    } else {
      if (riosLayer && map.hasLayer(riosLayer)) map.removeLayer(riosLayer);
      if (riosMarkers && map.hasLayer(riosMarkers)) map.removeLayer(riosMarkers);
    }
    return riosVisible;
  }


  function init() {
    const cont = document.getElementById("provinceMap");
    if (!cont || !window.L) { return setTimeout(init, 80); }
    NOMBRES = tablaNombres();

    map = L.map(cont, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    map.setView([-26.95, -65.3], 8);
    L.tileLayer(BASE_OSM, { maxZoom: 19, minZoom: 5, attribution: "© OpenStreetMap" }).addTo(map);
    setInterval(() => { if (riosVisible) dibujarRios(); }, 90 * 1000);

    fetch("data/limite_provincial.geojson").then((r) => r.json()).then((lim) => {
      limLayer = L.geoJSON(lim, { style: { color: "#0b3a53", weight: 2.5, fill: false, opacity: 0.8 } }).addTo(map);
    }).catch(() => {});

    fetch("data/departamentos.geojson").then((r) => r.json()).then((dep) => {
      depLayer = L.geoJSON(dep, {
        style: estiloDep,
        onEachFeature: (f, layer) => {
          const nombre = appName(f);
          try {
            const center = layer.getBounds().getCenter();
            depCenters[nombre] = { lat: center.lat, lon: center.lng };
          } catch (e) {}
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
      const customHtml = typeof cfg.html === "function" ? cfg.html(p) : "";
      const html = customHtml || pinHTML(p.color || cfg.color || "#0e6e8c", icono, pocos);
      const size = cfg.size || (pocos ? 30 : 14);
      const icon = L.divIcon({ className: "crecida-pin", html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const m = L.marker([p.lat, p.lon], { icon: icon });
      m.bindTooltip((p.nombre || "") + (p.sub ? " · " + p.sub : ""));
      if (typeof cfg.popup === "function") {
        m.bindPopup(cfg.popup(p), { closeButton: false, className: "crecida-pop", maxWidth: 280, minWidth: 180, autoPanPadding: [24, 24] });
      } else if (typeof cfg.onClick === "function") {
        m.on("click", () => cfg.onClick(p));
      }
      grupo.addLayer(m);
    });
    grupo.addTo(map);
    capasGroups[id] = grupo;
  }
  function clearCapa(id) {
    if (capasGroups[id]) { map.removeLayer(capasGroups[id]); delete capasGroups[id]; }
  }

  function centerOf(nombre) {
    return depCenters[nombre] || null;
  }

  // ── Radar de lluvia (RainViewer, gratis, sin clave) ────────────────
  let radarLayer = null;
  async function toggleRadar(on) {
    if (!map) return false;
    if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
    if (on === false) return false;
    try {
      const data = await fetch("https://api.rainviewer.com/public/weather-maps.json").then((r) => r.json());
      const frames = (data.radar && data.radar.past) || [];
      if (!frames.length) return false;
      const last = frames[frames.length - 1];
      const host = data.host || "https://tilecache.rainviewer.com";
      radarLayer = L.tileLayer(host + last.path + "/256/{z}/{x}/{y}/2/1_1.png", { opacity: 0.6, zIndex: 350, maxNativeZoom: 7, maxZoom: 19 });
      radarLayer.addTo(map);
      return true;
    } catch (e) { return false; }
  }

  // ── Vista regional (aleja el zoom para ver radar/contexto de provincias vecinas) ─
  function vistaRegional(on) {
    if (!map) return false;
    if (on) { map.setView([-27.15, -64.95], 6); }
    else {
      try { if (depLayer) map.fitBounds(depLayer.getBounds(), { padding: [10, 10] }); else map.setView([-26.95, -65.3], 8); } catch (e) {}
    }
    return !!on;
  }

  window.CRECIDA_MAPA = { recolorear: recolorear, setCapa: setCapa, clearCapa: clearCapa, toggleRadar: toggleRadar, vistaRegional: vistaRegional, toggleRiesgo: toggleRiesgo, toggleAreas: toggleAreas, setAreaFiltro: setAreaFiltro, toggleRios: toggleRios, refrescarRios: () => { if (riosVisible) dibujarRios(); }, map: () => map, centerOf: centerOf, get listo() { return listo; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
