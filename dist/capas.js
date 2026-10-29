/* =====================================================================
 * Programa CRECIDA — Capas de monitoreo (módulo aditivo)
 * ---------------------------------------------------------------------
 * Suma capas de contexto sobre el mapa operativo (rutas críticas,
 * defensa civil, bomberos, focos de incendio, inundaciones) leyendo
 * directo del api.php de DGIME. No modifica la lógica existente: envuelve
 * render() y dibuja una capa extra encima del SVG que ya arma app.js.
 *
 * Requisitos que ya existen en app.js (se usan tal cual):
 *   - función global latLonToSvg(lat, lon)
 *   - función global makeSvgElement(tag, attrs)
 *   - función global render()
 *   - elemento #provinceMap
 *
 * Este archivo se carga DESPUÉS de app.js en index.html.
 * ===================================================================== */

(function () {
  "use strict";

  const API = "https://www.dgime.site/Mapas/api.php?action=";

  // Configuración de cada capa: cómo traerla, cómo leer coordenadas,
  // qué mostrar y con qué color. Los accesores respetan los nombres de
  // campo reales de cada endpoint (varían entre capas).
  // Colores de los efectores de salud según su tipo (para la capa del mapa).
  const COLORES_EFECTOR = {
    "Hospital": "#dc2626",
    "CAPS": "#16a34a",
    "CIC": "#2563eb",
    "Policlínico": "#7c3aed",
    "Maternidad": "#db2777",
    "Área Programática": "#f59e0b",
    "SAMEP": "#0ea5e9",
    "Efector": "#64748b",
  };

  const CAPAS = {
    bomberos: {
      titulo: "Bomberos (OpenStreetMap)",
      chip: "🚒 Bomberos",
      color: "#ef4444",
      lat: (d) => d.lat,
      lon: (d) => d.lon,
      nombre: (d) => d.nombre,
      sub: (d) => d.localidad || "",
      detalle: (d) => [
        ["Dirección", d.direccion],
        ["Localidad", d.localidad],
        ["Teléfono", d.telefono],
        ["Fuente", "OpenStreetMap"],
      ],
    },
    policia: {
      titulo: "Policía / Comisarías (OpenStreetMap)",
      chip: "🚓 Policía",
      color: "#1d4ed8",
      lat: (d) => d.lat,
      lon: (d) => d.lon,
      nombre: (d) => d.nombre,
      sub: (d) => d.localidad || "",
      detalle: (d) => [
        ["Dirección", d.direccion],
        ["Localidad", d.localidad],
        ["Teléfono", d.telefono],
        ["Fuente", "OpenStreetMap"],
      ],
    },
    focos: {
      titulo: "Focos de incendio (FIRMS)",
      chip: "🔥 Focos",
      color: "#dc2626",
      action: "get_focos_incendio",
      lat: (d) => d.latitude,
      lon: (d) => d.longitude,
      nombre: (d) => `Foco ${d.departamento || ""}`.trim(),
      sub: (d) => `${d.confidence || ""} · ${d.frp_mw != null ? d.frp_mw + " MW" : ""}`,
      detalle: (d) => [
        ["Detección", `${d.detection_date || ""} ${d.detection_time || ""}`.trim()],
        ["Satélite", d.satellite],
        ["Sensor", d.sensor],
        ["Confianza", d.confidence_pct != null ? `${d.confidence_pct}%` : d.confidence],
        ["Nota", d.warning_disclaimer],
      ],
    },
    efectores: {
      titulo: "Efectores de salud (SIPROSA)",
      chip: "🏥 Efectores",
      color: "#16a34a",
      colorItem: (d) => COLORES_EFECTOR[d.tipo] || COLORES_EFECTOR["Efector"],
      action: "",
      lat: (d) => d.lat,
      lon: (d) => d.lon,
      nombre: (d) => d.nombre,
      sub: (d) => `${d.tipo || ""} · ${d.localidad || ""}`.trim(),
      detalle: (d) => [
        ["Tipo", d.tipo],
        ["Dirección", d.direccion],
        ["Localidad", d.localidad],
        ["Departamento", d.departamento],
        ["Cód. SRT", d.srt],
      ],
    },
  };

  // Estado de cada capa: si está activa y sus items ya traídos.
  const estado = {};
  Object.keys(CAPAS).forEach((id) => (estado[id] = { activa: false, items: null, cargando: false }));

  // ── Traer una capa (con cache en memoria) ──────────────────────────
  async function traerCapa(id) {
    const cfg = CAPAS[id];
    let arr = null;
    if (id === "efectores") { arr = window.CRECIDA_EFECTORES || []; }
    const DOC = { focos: "focos", bomberos: "osm_bomberos", policia: "osm_policia" };
    if (arr === null && DOC[id] && window.firebase && window.firebase.firestore) {
      try {
        const snap = await window.firebase.firestore().collection("capas").doc(DOC[id]).get();
        arr = snap.exists ? (snap.data().items || []) : [];
      } catch (e) { arr = []; }
    }
    if (arr === null && cfg.action) {
      const res = await fetch(API + cfg.action, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      arr = Array.isArray(json) ? json : json.items || json.estaciones || [];
    }
    if (arr === null) arr = [];
    return arr
      .map((d) => ({
        lat: Number(cfg.lat(d)),
        lon: Number(cfg.lon(d)),
        nombre: cfg.nombre(d) || cfg.titulo,
        sub: (cfg.sub(d) || "").trim(),
        color: (cfg.colorItem && cfg.colorItem(d)) || cfg.color,
        dep: (d.departamento || ""),
        detalle: cfg.detalle(d).filter(([, v]) => v),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  }

  // ── Dibujar las capas activas sobre el SVG que ya armó render() ─────
  function dibujarCapas() {
    return; // el mapa ahora es Leaflet (ver mapa.js); los marcadores se dibujan en alternarCapa
    const cont = document.getElementById("provinceMap");
    if (!cont) return;
    const svg = cont.querySelector("svg");
    if (!svg) return;

    const grupo = window.makeSvgElement("g", { class: "capas-overlay" });

    Object.keys(CAPAS).forEach((id) => {
      const st = estado[id];
      if (!st.activa || !st.items) return;

      const icono = ((CAPAS[id].chip || "").trim().split(/\s+/)[0]) || "";
      const pocos = st.items.length <= 150; // capas con pocos puntos -> ícono grande + pulso
      st.items.forEach((p) => {
        const [x, y] = window.latLonToSvg(p.lat, p.lon);
        const m = window.makeSvgElement("g", {
          class: "capa-marker" + (pocos ? " es-icono" : ""),
          transform: `translate(${x} ${y})`,
          tabindex: "0",
          role: "button",
        });
        if (pocos) {
          m.appendChild(window.makeSvgElement("circle", { class: "capa-halo", r: "11", fill: p.color }));
          m.appendChild(window.makeSvgElement("circle", { class: "capa-dot", r: "12", fill: p.color, stroke: "#ffffff", "stroke-width": "2.5" }));
          if (icono) {
            const t = window.makeSvgElement("text", { class: "capa-ic", x: "0", y: "0.5", "text-anchor": "middle", "dominant-baseline": "central" });
            t.textContent = icono;
            m.appendChild(t);
          }
        } else {
          m.appendChild(window.makeSvgElement("circle", { class: "capa-halo capa-halo-soft", r: "5", fill: p.color }));
          m.appendChild(window.makeSvgElement("circle", { class: "capa-dot", r: "6", fill: p.color, stroke: "#ffffff", "stroke-width": "1.5" }));
        }
        const title = window.makeSvgElement("title");
        title.textContent = `${p.nombre}${p.sub ? " · " + p.sub : ""}`;
        m.appendChild(title);
        m.addEventListener("click", () => abrirInspector(id, p));
        grupo.appendChild(m);
      });
    });

    svg.appendChild(grupo);
  }

  // ── Contenido del globo (popup) al hacer clic en un punto ──────────
  function popupHTML(id, p) {
    const filas = (p.detalle || [])
      .map(([k, v]) => `<div class="cp-row"><span>${k}</span><strong>${v}</strong></div>`)
      .join("");
    return `<div class="cp-card" style="--cp:${p.color || "#0e6e8c"}">
        <p class="cp-eyebrow">${CAPAS[id].titulo}</p>
        <h3 class="cp-nombre">${p.nombre || ""}</h3>
        ${filas || '<p class="cp-empty">Sin datos adicionales.</p>'}
      </div>`;
  }

  // ── Inspector flotante al hacer clic en un punto ───────────────────
  function abrirInspector(id, p) {
    let box = document.getElementById("capasInspector");
    if (!box) {
      box = document.createElement("div");
      box.id = "capasInspector";
      document.body.appendChild(box);
    }
    const filas = p.detalle
      .map(([k, v]) => `<div class="ci-row"><span>${k}</span><strong>${v}</strong></div>`)
      .join("");
    box.innerHTML = `
      <div class="ci-head" style="border-color:${p.color}">
        <div>
          <p class="ci-eyebrow">${CAPAS[id].titulo}</p>
          <h3>${p.nombre}</h3>
        </div>
        <button type="button" id="ciClose" aria-label="Cerrar">✕</button>
      </div>
      ${filas || '<p class="ci-empty">Sin datos adicionales.</p>'}
    `;
    box.style.display = "block";
    document.getElementById("ciClose").addEventListener("click", () => (box.style.display = "none"));
  }

  // ── Leyenda de colores de Efectores (solo visible con esa capa activa) ─
  function renderLeyendaEfectores() {
    const cont = document.getElementById("capasLegend");
    if (!cont) return;
    const activa = estado.efectores && estado.efectores.activa;
    if (!activa) { cont.innerHTML = ""; cont.style.display = "none"; return; }
    const orden = ["Hospital", "CAPS", "CIC", "Policlínico", "Maternidad", "Área Programática", "SAMEP", "Efector"];
    const tipos = [...new Set((window.CRECIDA_EFECTORES || []).map((e) => e.tipo))]
      .sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
    const filas = tipos.map((t) =>
      `<div class="cl-row"><span class="cl-dot" style="background:${COLORES_EFECTOR[t] || COLORES_EFECTOR["Efector"]}"></span>${t}</div>`
    ).join("");
    cont.innerHTML = `<p class="cl-title">Referencia · Efectores</p>${filas}`;
    cont.style.display = "block";
  }

  // ── Chips para activar/desactivar cada capa ────────────────────────
  async function alternarCapa(id, chipEl) {
    const st = estado[id];
    st.activa = !st.activa;
    chipEl.classList.toggle("activo", st.activa);

    if (st.activa && !st.items && !st.cargando) {
      st.cargando = true;
      chipEl.classList.add("cargando");
      try {
        st.items = await traerCapa(id);
        if (window.addAudit) {
          window.addAudit(
            `Capa ${CAPAS[id].titulo}`,
            `Se cargaron ${st.items.length} puntos.`,
            "Capas de monitoreo",
          );
        }
      } catch (e) {
        st.items = [];
        st.activa = false;
        chipEl.classList.remove("activo");
        if (window.addAudit) {
          window.addAudit(`Capa ${CAPAS[id].titulo}`, "No se pudo cargar la capa.", "Capas de monitoreo");
        }
      } finally {
        st.cargando = false;
        chipEl.classList.remove("cargando");
      }
    }
    if (window.CRECIDA_MAPA) {
      if (st.activa && st.items) {
        const icono = ((CAPAS[id].chip || "").trim().split(/\s+/)[0]) || "";
        const pocos = st.items.length <= 150;
        window.CRECIDA_MAPA.setCapa(id, st.items, { color: CAPAS[id].color, icono: icono, pocos: pocos, popup: (p) => popupHTML(id, p) });
      } else {
        window.CRECIDA_MAPA.clearCapa(id);
      }
    }
    if (window.render) window.render();
    renderLeyendaEfectores();
  }

  // ── Efectores por Área Programática (se dibujan desde el chip de Áreas) ──
  const DEP_AREA = {
    "lules":"oeste","famailla":"oeste","yerba buena":"oeste","tafi viejo":"oeste","tafi del valle":"oeste","trancas":"oeste",
    "monteros":"sur","simoca":"sur","chicligasta":"sur","rio chico":"sur","juan bautista alberdi":"sur","graneros":"sur","la cocha":"sur",
    "leales":"este","burruyacu":"este","cruz alta":"este",
    "capital":"centro"
  };
  function normDep(x) { return (x || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }

  async function dibujarEfectoresArea(areaId) {
    const st = estado.efectores;
    if (!st.items && !st.cargando) {
      st.cargando = true;
      try { st.items = await traerCapa("efectores"); } catch (e) { st.items = []; }
      st.cargando = false;
    }
    const items = (st.items || []).filter((p) => areaId === "todas" ? true : DEP_AREA[normDep(p.dep)] === areaId);
    st.activa = true;
    const pocos = items.length <= 150;
    if (window.CRECIDA_MAPA) {
      window.CRECIDA_MAPA.setCapa("efectores", items, { color: CAPAS.efectores.color, icono: "🏥", pocos: pocos, popup: (p) => popupHTML("efectores", p) });
    }
    const chip = document.getElementById("capa_efectores"); if (chip) chip.classList.add("activo");
    renderLeyendaEfectores();
  }
  function apagarEfectoresArea() {
    estado.efectores.activa = false;
    if (window.CRECIDA_MAPA) window.CRECIDA_MAPA.clearCapa("efectores");
    const chip = document.getElementById("capa_efectores"); if (chip) chip.classList.remove("activo");
    renderLeyendaEfectores();
  }

  function construirBarra() {
    if (document.getElementById("capasPanel")) return;
    const mapSurface = document.querySelector(".map-surface");
    const mapBody = mapSurface && mapSurface.querySelector(".map-body");
    if (!mapSurface || !mapBody) return;

    const card = document.createElement("section");
    card.id = "capasPanel";
    card.className = "capas-panel";

    const h = document.createElement("h3");
    h.textContent = "Capas del mapa";
    card.appendChild(h);

    const barra = document.createElement("div");
    barra.id = "capasBar";
    barra.setAttribute("aria-label", "Capas de monitoreo");
    Object.keys(CAPAS).forEach((id) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "capa-chip";
      chip.id = "capa_" + id;
      chip.textContent = CAPAS[id].chip;
      chip.addEventListener("click", () => alternarCapa(id, chip));
      barra.appendChild(chip);
    });
    // chip de vista regional (radar/contexto de provincias vecinas)
    const regChip = document.createElement("button");
    regChip.type = "button";
    regChip.className = "capa-chip";
    regChip.id = "capaRegional";
    regChip.textContent = "🛰️ Vista regional";
    regChip.addEventListener("click", async () => {
      if (!window.CRECIDA_MAPA || !window.CRECIDA_MAPA.vistaRegional) return;
      const activar = !regChip.classList.contains("activo");
      window.CRECIDA_MAPA.vistaRegional(activar);
      regChip.classList.toggle("activo", activar);
      regChip.textContent = activar ? "🛰️ Volver a Tucumán" : "🛰️ Vista regional";
    });
    barra.appendChild(regChip);

    // chip de viento (capa animada, Open-Meteo)
    const vientoChip = document.createElement("button");
    vientoChip.type = "button";
    vientoChip.className = "capa-chip";
    vientoChip.id = "capaViento";
    vientoChip.textContent = "💨 Viento";
    vientoChip.addEventListener("click", async () => {
      if (!window.CRECIDA_viento) return;
      const enc = !vientoChip.classList.contains("activo");
      vientoChip.classList.add("cargando");
      const ok = await window.CRECIDA_viento.toggle(enc);
      vientoChip.classList.remove("cargando");
      vientoChip.classList.toggle("activo", enc && ok);
    });
    barra.appendChild(vientoChip);

    // chip de Precipitación (Open-Meteo, cubre Tucumán donde el radar no llega)
    const precipChip = document.createElement("button");
    precipChip.type = "button";
    precipChip.className = "capa-chip";
    precipChip.id = "capaPrecip";
    precipChip.textContent = "🌦️ Precipitación";
    const precipLeg = document.createElement("div");
    precipLeg.id = "precipLeg";
    precipLeg.className = "precip-leg";
    precipLeg.hidden = true;
    precipLeg.innerHTML =
      '<span class="pl-t">Lluvia · modelo Open-Meteo (mm/h)</span>' +
      '<span class="pl-i"><i style="background:#93c5fd"></i>llovizna</span>' +
      '<span class="pl-i"><i style="background:#3b82f6"></i>leve</span>' +
      '<span class="pl-i"><i style="background:#1d4ed8"></i>moderada</span>' +
      '<span class="pl-i"><i style="background:#f59e0b"></i>intensa</span>' +
      '<span class="pl-i"><i style="background:#dc2626"></i>muy intensa</span>' +
      '<small class="pl-note" id="precipNote"></small>';
    precipChip.addEventListener("click", async () => {
      if (!window.CRECIDA_precip) return;
      const enc = !precipChip.classList.contains("activo");
      precipChip.classList.add("cargando");
      const ok = await window.CRECIDA_precip.toggle(enc);
      precipChip.classList.remove("cargando");
      precipChip.classList.toggle("activo", enc && ok);
      precipLeg.hidden = !(enc && ok);
      const note = document.getElementById("precipNote");
      if (note) note.textContent = (enc && ok && !window.CRECIDA_precipHay) ? "Sin lluvia en la región en este momento." : "";
    });
    window.CRECIDA_onPrecip = function (hay) {
      const note = document.getElementById("precipNote");
      if (note) note.textContent = hay ? "" : "Sin lluvia en la región en este momento.";
    };
    barra.appendChild(precipChip);

    // chip de Temperatura (Open-Meteo) — para golpe de calor del Niño
    const tempChip = document.createElement("button");
    tempChip.type = "button";
    tempChip.className = "capa-chip";
    tempChip.id = "capaTemp";
    tempChip.textContent = "🌡️ Temperatura";
    const tempLeg = document.createElement("div");
    tempLeg.id = "tempLeg";
    tempLeg.className = "precip-leg";
    tempLeg.hidden = true;
    tempLeg.innerHTML =
      '<span class="pl-t">Temperatura · modelo Open-Meteo (°C)</span>' +
      '<span class="pl-i"><i style="background:#2563eb"></i>frío</span>' +
      '<span class="pl-i"><i style="background:#22d3ee"></i>templado</span>' +
      '<span class="pl-i"><i style="background:#fde047"></i>cálido</span>' +
      '<span class="pl-i"><i style="background:#f59e0b"></i>calor</span>' +
      '<span class="pl-i"><i style="background:#dc2626"></i>extremo</span>';
    tempChip.addEventListener("click", async () => {
      if (!window.CRECIDA_temp) return;
      const enc = !tempChip.classList.contains("activo");
      tempChip.classList.add("cargando");
      const ok = await window.CRECIDA_temp.toggle(enc);
      tempChip.classList.remove("cargando");
      tempChip.classList.toggle("activo", enc && ok);
      tempLeg.hidden = !(enc && ok);
    });
    barra.appendChild(tempChip);

    // chip de riesgo hídrico INA (coloreo de departamentos, apagado por defecto)
    const riesgoChip = document.createElement("button");
    riesgoChip.type = "button";
    riesgoChip.className = "capa-chip";
    riesgoChip.id = "capaRiesgo";
    riesgoChip.textContent = "🎨 Riesgo hídrico (INA)";
    riesgoChip.addEventListener("click", () => {
      if (!window.CRECIDA_MAPA || !window.CRECIDA_MAPA.toggleRiesgo) return;
      const on = !riesgoChip.classList.contains("activo");
      window.CRECIDA_MAPA.toggleRiesgo(on);
      riesgoChip.classList.toggle("activo", on);
      // mostrar/ocultar las pastillas de aforos INA junto con el coloreo
      window.CRECIDA_inaVisible = on;
      if (window.CRECIDA_renderTrendSignals) window.CRECIDA_renderTrendSignals();
      const leg = document.getElementById("mapLegend");
      if (leg) leg.hidden = !on;
      const sub = document.getElementById("mapSubtitle");
      if (sub) sub.textContent = on
        ? "El color refleja riesgo hidrológico en vivo (aforos INA)."
        : "Activá “Riesgo hídrico (INA)” en Capas para colorear por aforos.";
    });
    barra.appendChild(riesgoChip);

    // chip de Áreas Programáticas SIPROSA (polígonos por área + selector)
    const AREA_OPTS = [
      { id: "todas",  label: "Todas",  color: "#64748b" },
      { id: "oeste",  label: "Oeste",  color: "#4f46e5" },
      { id: "sur",    label: "Sur",    color: "#c026d3" },
      { id: "este",   label: "Este",   color: "#0891b2" },
      { id: "centro", label: "Centro", color: "#475569" },
    ];
    const areasChip = document.createElement("button");
    areasChip.type = "button";
    areasChip.className = "capa-chip";
    areasChip.id = "capaAreas";
    areasChip.textContent = "🗂️ Áreas programáticas";

    let areaSel = "todas";
    const areasOpts = document.createElement("div");
    areasOpts.id = "areasOpts";
    areasOpts.className = "area-opts";
    areasOpts.hidden = true;
    AREA_OPTS.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "area-opt" + (o.id === "todas" ? " activo" : "");
      b.dataset.area = o.id;
      b.innerHTML = (o.id === "todas" ? "" : '<i style="background:' + o.color + '"></i>') + o.label;
      b.addEventListener("click", () => {
        if (!window.CRECIDA_MAPA || !window.CRECIDA_MAPA.setAreaFiltro) return;
        window.CRECIDA_MAPA.setAreaFiltro(o.id);
        areaSel = o.id;
        areasOpts.querySelectorAll(".area-opt").forEach((x) => x.classList.toggle("activo", x === b));
        if (areasChip.classList.contains("activo")) dibujarEfectoresArea(o.id);
      });
      areasOpts.appendChild(b);
    });

    areasChip.addEventListener("click", () => {
      if (!window.CRECIDA_MAPA || !window.CRECIDA_MAPA.toggleAreas) return;
      const on = !areasChip.classList.contains("activo");
      window.CRECIDA_MAPA.toggleAreas(on);
      areasChip.classList.toggle("activo", on);
      areasOpts.hidden = !on;
      // Efectores dentro de Áreas: al prender, salen los efectores del área elegida; al apagar, se van.
      if (on) dibujarEfectoresArea(areaSel);
      else apagarEfectoresArea();
    });
    barra.appendChild(areasChip);

    // chip de Ríos (hidrografía ligada al INA)
    const riosChip = document.createElement("button");
    riosChip.type = "button";
    riosChip.className = "capa-chip";
    riosChip.id = "capaRios";
    riosChip.textContent = "🌊 Ríos (INA)";
    const riosLeg = document.createElement("div");
    riosLeg.id = "riosLeg";
    riosLeg.className = "rios-leg";
    riosLeg.hidden = true;
    riosLeg.innerHTML =
      '<span class="rl-t">Ríos · estado INA</span>' +
      '<span class="rl-i"><i style="background:#60a5fa"></i>cauce</span>' +
      '<span class="rl-i"><i style="background:#2563eb"></i>con aforo</span>' +
      '<span class="rl-i"><i style="background:#f59e0b"></i>alerta</span>' +
      '<span class="rl-i"><i style="background:#dc2626"></i>evacuación</span>' +
      '<span class="rl-i"><b style="color:#0ea5e9">\u25C9</b> crecida</span>';
    riosChip.addEventListener("click", () => {
      if (!window.CRECIDA_MAPA || !window.CRECIDA_MAPA.toggleRios) return;
      const on = !riosChip.classList.contains("activo");
      window.CRECIDA_MAPA.toggleRios(on);
      riosChip.classList.toggle("activo", on);
      riosLeg.hidden = !on;
    });
    barra.appendChild(riosChip);

    card.appendChild(barra);
    card.appendChild(areasOpts);
    card.appendChild(riosLeg);

    const leg = document.createElement("div");
    leg.id = "capasLegend";
    card.appendChild(leg);

    card.appendChild(precipLeg);
    card.appendChild(tempLeg);

    // Barra de capas ARRIBA del mapa, debajo del título (antes del cuerpo del mapa)
    function ubicar() {
      if (card.parentNode !== mapSurface || card.nextElementSibling !== mapBody) {
        mapSurface.insertBefore(card, mapBody);
      }
    }
    ubicar();
    [200, 800, 2000].forEach((d) => setTimeout(ubicar, d));
  }

  // ── Estilos mínimos propios (no dependen de styles.css) ────────────
  function inyectarEstilos() {
    return; // estilos centralizados en styles.css (coherencia visual)
    if (document.getElementById("capasEstilos")) return;
    const s = document.createElement("style");
    s.id = "capasEstilos";
    s.textContent = `
      #capasBar{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;width:100%}
      .capa-chip{font:500 12px/1 system-ui,sans-serif;padding:6px 10px;border-radius:999px;
        border:1px solid rgba(148,163,184,.4);background:rgba(15,23,42,.04);color:inherit;cursor:pointer;
        transition:all .15s}
      .capa-chip:hover{border-color:rgba(148,163,184,.8)}
      .capa-chip.activo{background:#0f172a;color:#fff;border-color:#0f172a}
      .capa-chip.cargando{opacity:.55;pointer-events:none}
      .capa-marker{cursor:pointer}
      .capa-marker:hover circle{fill-opacity:1;r:7}
      #capasInspector{position:fixed;right:20px;bottom:20px;width:300px;max-width:calc(100vw - 40px);
        background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 18px 50px rgba(2,6,23,.28);
        padding:14px 16px;z-index:9999;display:none;font:400 13px/1.4 system-ui,sans-serif}
      #capasInspector .ci-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;
        border-left:4px solid;padding-left:10px;margin-bottom:10px}
      #capasInspector .ci-eyebrow{margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
      #capasInspector h3{margin:2px 0 0;font-size:15px}
      #capasInspector #ciClose{border:none;background:transparent;font-size:16px;cursor:pointer;color:#64748b}
      #capasInspector .ci-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-top:1px solid #f1f5f9}
      #capasInspector .ci-row span{color:#64748b}
      #capasInspector .ci-row strong{text-align:right;font-weight:600}
      @media (prefers-color-scheme:dark){
        #capasInspector{background:#0f172a;color:#e2e8f0}
        #capasInspector .ci-row{border-color:rgba(148,163,184,.15)}
      }
    `;
    document.head.appendChild(s);
  }

  // ── Envolver render() para que también dibuje las capas ─────────────
  function engancharRender() {
    if (typeof window.render !== "function" || window.__capasEnganchado) return;
    const original = window.render;
    window.render = function () {
      original.apply(this, arguments);
      dibujarCapas();
    };
    window.__capasEnganchado = true;
  }

  function init() {
    inyectarEstilos();
    construirBarra();
    engancharRender();
    dibujarCapas(); // primer pintado sobre el SVG ya existente
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
