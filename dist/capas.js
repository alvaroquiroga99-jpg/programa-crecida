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
        detalle: cfg.detalle(d).filter(([, v]) => v),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  }

  // ── Dibujar las capas activas sobre el SVG que ya armó render() ─────
  function dibujarCapas() {
    const cont = document.getElementById("provinceMap");
    if (!cont) return;
    const svg = cont.querySelector("svg");
    if (!svg) return;

    const grupo = window.makeSvgElement("g", { class: "capas-overlay" });

    Object.keys(CAPAS).forEach((id) => {
      const st = estado[id];
      if (!st.activa || !st.items) return;

      st.items.forEach((p) => {
        const [x, y] = window.latLonToSvg(p.lat, p.lon);
        const m = window.makeSvgElement("g", {
          class: "capa-marker",
          transform: `translate(${x} ${y})`,
          tabindex: "0",
          role: "button",
        });
        m.appendChild(
          window.makeSvgElement("circle", {
            r: "6",
            fill: p.color,
            stroke: "#0b1220",
            "stroke-width": "1.5",
            "fill-opacity": "0.9",
          }),
        );
        const title = window.makeSvgElement("title");
        title.textContent = `${p.nombre}${p.sub ? " · " + p.sub : ""}`;
        m.appendChild(title);
        m.addEventListener("click", () => abrirInspector(id, p));
        grupo.appendChild(m);
      });
    });

    svg.appendChild(grupo);
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
    if (window.render) window.render();
    renderLeyendaEfectores();
  }

  function construirBarra() {
    if (document.getElementById("capasPanel")) return;
    const panel = document.querySelector(".jurisdiction-panel");
    if (!panel) return;

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
      chip.textContent = CAPAS[id].chip;
      chip.addEventListener("click", () => alternarCapa(id, chip));
      barra.appendChild(chip);
    });
    card.appendChild(barra);

    const leg = document.createElement("div");
    leg.id = "capasLegend";
    card.appendChild(leg);

    const ref = panel.querySelector(".selected-header");
    if (ref) panel.insertBefore(card, ref); else panel.appendChild(card);
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
