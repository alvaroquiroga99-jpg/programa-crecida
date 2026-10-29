/* =====================================================================
 * Programa CRECIDA — Motor de alerta sugerida (módulo aditivo)
 * ---------------------------------------------------------------------
 * Cruza la hidrometría del INA con las reglas de cuenca (reglas.js) y
 * propone alertas por departamento. NO dispara nada solo: arma
 * sugerencias y ofrece un botón "Cargar en alerta" que completa el
 * formulario manual existente para que una persona confirme y emita.
 *
 * Depende de: reglas.js (window.CRECIDA_REGLAS). Se carga después.
 * No modifica la lógica de app.js.
 * ===================================================================== */

(function () {
  "use strict";

  // Fuente de hidrometría: adaptador window.CRECIDA_fetchINA() (ver ina.js) — INA SIyAH.

  // Mismos límites que usa app.js para quedarse solo con Tucumán.
  const BOUNDS = { minLat: -28.05, maxLat: -26.05, minLon: -66.05, maxLon: -64.35 };

  function dentroDeTucuman(lat, lon) {
    return (
      Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat &&
      lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon
    );
  }

  // Nivel sugerido SOLO con los umbrales oficiales del INA (alerta / evacuación).
  // 29/10: antes un río en estado "Normal" que subía un par de centímetros se marcaba
  // NARANJA; eso no es una alerta oficial y daba falsas alarmas. Ahora, sin umbral superado,
  // no hay sugerencia (la subida se sigue viendo en el mapa y en "Contexto hídrico").
  function nivelSugerido(nivel, tend) {
    const n = (nivel || "").toLowerCase();
    const t = (tend || "").toLowerCase();
    if (n.includes("evacua")) return "red";
    if (n.includes("alerta crecida")) return t === "crece" ? "red" : "orange";
    return null;
  }

  function buscarRegla(nombreAforo) {
    const reglas = window.CRECIDA_REGLAS || [];
    const nom = (nombreAforo || "").toLowerCase();
    return reglas.find((r) => nom.includes(r.match.toLowerCase())) || null;
  }

  const LABEL = { red: "ROJO", orange: "NARANJA", yellow: "AMARILLO" };
  const COLOR = { red: "#dc2626", orange: "#f59e0b", yellow: "#eab308" };

  let sugerencias = [];
  let smnAcp = null;
  let smnAlertas = null;
  let vigiaInfo = null;

  // === Monitoreo unificado: SMN (meteo) + INA (hidro) -> jurisdicciones ===
  // Tabla BORRADOR área SMN -> departamentos (calculada por point-in-polygon de centroides).
  // 3373 = llanura (la provincia); 3375/3380/3388 = Tafí del Valle (valles/cumbres/puna).
  const AREA_DEPS = {
    3373: ["Capital", "Burruyacú", "Famaillá", "Cruz Alta", "Lules", "Yerba Buena", "Tafí Viejo", "Trancas", "La Cocha", "Graneros", "Juan Bautista Alberdi", "Río Chico", "Simoca", "Chicligasta", "Monteros", "Leales"],
    3375: ["Tafí del Valle"],
    3380: ["Tafí del Valle"],
    3388: ["Tafí del Valle"],
  };
  const COLOR_KEY = { amarillo: "yellow", naranja: "orange", rojo: "red" };
  const PESO_KEY = { yellow: 1, orange: 2, red: 3 };

  function tipoMeteo(a) {
    const m = /afectad[oa]s? por (?:el |la |los |las )?([a-zA-Z\u00e0-\u00ff ]{3,28}?)(?: con| del| de | y |,|\.|$)/i.exec(a && a.titulo || "");
    const t = m ? m[1].trim() : "";
    return t || "alerta meteorológica";
  }

  function construirMonitoreo(smnAl, sugs) {
    const jur = {};
    const get = (d) => (jur[d] || (jur[d] = { meteo: [], hidro: [] }));
    (smnAl || []).forEach((a) => {
      const deps = AREA_DEPS[a.area_id] || [];
      const tipo = tipoMeteo(a);
      const color = String(a.color || "amarillo").toLowerCase();
      const key = COLOR_KEY[color] || "yellow";
      deps.forEach((d) => get(d).meteo.push({ tipo, color, key }));
    });
    (sugs || []).forEach((s) => {
      (s.departamentos || []).forEach((d) => get(d).hidro.push({ rio: s.rio || "río", key: s.levelKey || "yellow" }));
    });
    const nombres = Object.keys(jur);
    let nivelKey = "green", peso = 0;
    nombres.forEach((d) => {
      jur[d].meteo.concat(jur[d].hidro).forEach((c) => { const pp = PESO_KEY[c.key] || 0; if (pp > peso) { peso = pp; nivelKey = c.key; } });
    });
    const tiposMeteo = {}; (smnAl || []).forEach((a) => { tiposMeteo[tipoMeteo(a)] = 1; });
    const rios = {}; (sugs || []).forEach((s) => { if (s.rio) rios[s.rio] = 1; });
    const partes = [];
    const tm = Object.keys(tiposMeteo);
    if (tm.length) partes.push(tm.join(", ") + " (SMN)");
    const nr = Object.keys(rios).length;
    if (nr) partes.push(nr + (nr === 1 ? " crecida de río" : " crecidas de ríos") + " (INA)");
    const titulo = partes.length ? ("Vigilancia · " + partes.join(" · ")) : "";
    const lista = nombres.map((d) => {
      let mx = 0; jur[d].meteo.concat(jur[d].hidro).forEach((c) => { mx = Math.max(mx, PESO_KEY[c.key] || 0); });
      return { nombre: d, meteo: jur[d].meteo, hidro: jur[d].hidro, peso: mx };
    }).sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre, "es"));
    return { nivelKey, titulo, jurisdicciones: lista, cantidad: lista.length, hayAlgo: lista.length > 0 };
  }

  async function leerFuentes() {
    if (!(window.firebase && window.firebase.firestore)) return;
    const db = window.firebase.firestore();
    try { const a = await db.collection("smn").doc("acp").get(); smnAcp = a.exists ? a.data() : null; } catch (e) {}
    try { const al = await db.collection("smn").doc("alertas").get(); smnAlertas = al.exists ? al.data() : null; } catch (e) {}
    try { const v = await db.collection("sistema").doc("vigia").get(); vigiaInfo = v.exists ? v.data() : null; } catch (e) {}
  }

  async function calcular() {
    let data;
    try {
      data = await window.CRECIDA_fetchINA(); // fuente oficial INA (SIyAH)
    } catch (e) {
      sugerencias = [];
      render(`No se pudo consultar el INA (${e.message}).`);
      return;
    }

    sugerencias = (Array.isArray(data) ? data : [])
      .filter((a) => dentroDeTucuman(Number(a.lat), Number(a.lon)))
      .map((a) => {
        // Toda estación de Tucumán queda mapeada: con su regla de cuenca, o como mínimo
        // con el departamento donde está ubicada (dato geográfico, no estimado).
        const regla = buscarRegla(a.nombre) ||
          (a.departamento ? { rio: a.rio, departamentos: [a.departamento], tt_horas: null, sinRegla: true } : null);
        if (!regla) return null;
        const levelKey = nivelSugerido(a.nivel_alerta, a.tendencia);
        if (!levelKey) return null;
        return {
          aforo: a.nombre,
          rio: regla.rio || a.rio,
          altura: Number(a.altura_m),
          tend: a.tendencia,
          nivel: a.nivel_alerta,
          levelKey,
          departamentos: regla.departamentos,
          tt_horas: regla.tt_horas,
        };
      })
      .filter(Boolean)
      // Rojo primero, luego por altura
      .sort((x, y) => {
        const rank = { red: 2, orange: 1, yellow: 0 };
        return (rank[y.levelKey] - rank[x.levelKey]) || (y.altura - x.altura);
      });

    // Riesgo automático por departamento (pinta el mapa en vivo)
    const riesgo = {};
    const rank = { orange: 1, red: 2 };
    sugerencias.forEach((s) => {
      s.departamentos.forEach((dep) => {
        if (!riesgo[dep] || rank[s.levelKey] > rank[riesgo[dep].levelKey]) {
          riesgo[dep] = { levelKey: s.levelKey, motivo: `${s.rio} (${s.aforo})` };
        }
      });
    });
    window.CRECIDA_RIESGO = riesgo;
    window.CRECIDA_LASTSYNC =
      new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " h";

    await leerFuentes();
    render();
    if (typeof window.render === "function") window.render();
  }

  // Precarga la sugerencia en el formulario manual existente (NO la emite).
  function cargarEnFormulario(s) {
    const level = document.getElementById("manualAlertLevel");
    const title = document.getElementById("manualAlertTitle");
    const validUntil = document.getElementById("manualAlertValidUntil");
    const directive = document.getElementById("manualAlertDirective");
    const zonas = document.getElementById("manualAlertZones");
    if (!level || !zonas) return;

    level.value = s.levelKey;
    if (title) title.value = `Crecida ${s.rio}`;
    if (validUntil) validUntil.value = s.tt_horas ? `Próximas ${s.tt_horas} h` : "Por confirmar";
    if (directive) {
      directive.value =
        `Aforo ${s.aforo}: ${s.nivel}, tendencia ${s.tend}` +
        (Number.isFinite(s.altura) ? ` (${s.altura.toFixed(2)} m).` : ".") +
        " Confirmar recepción y verificar disponibilidad operativa.";
    }

    // Marca los departamentos sugeridos en el checklist.
    zonas.querySelectorAll('input[name="zones"]').forEach((input) => {
      input.checked = s.departamentos.includes(input.value);
    });

    if (window.addAudit) {
      window.addAudit(
        "Sugerencia cargada",
        `${LABEL[s.levelKey]} por ${s.rio} → ${s.departamentos.join(", ")}. Pendiente de confirmación.`,
        "Motor de alerta",
      );
    }

    // Abre el modal de alerta ya completado (si existe); si no, hace scroll.
    if (typeof window.openAlertModal === "function") {
      window.openAlertModal();
    } else {
      const form = document.getElementById("alertForm");
      if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function render(errorMsg) {
    let panel = document.getElementById("sugerenciasPanel");
    if (!panel) {
      // Panel de sugerencias INA al panel IZQUIERDO, debajo de la alerta del SMN (antes iba al derecho)
      const cont = document.querySelector(".incident-panel") || document.querySelector(".jurisdiction-panel") || document.getElementById("operationView");
      if (!cont) return;
      panel = document.createElement("section");
      panel.id = "sugerenciasPanel";
      panel.className = "panel-section";
      cont.appendChild(panel);
    }

    const rojas = sugerencias.filter((s) => s.levelKey === "red").length;
    const naranjas = sugerencias.filter((s) => s.levelKey === "orange").length;
    const smnTuc = (smnAcp && Array.isArray(smnAcp.tucuman)) ? smnAcp.tucuman : [];
    const smnBlock = smnTuc.length
      ? `<div class="sp-smn"><strong>⚠️ Avisos oficiales SMN (${smnTuc.length})</strong>` +
        smnTuc.map((av) => `<div class="sp-smn-item">${av.title || av.titulo || av.name || "Aviso SMN vigente"}</div>`).join("") +
        `</div>`
      : "";
    const smnAl = (smnAlertas && Array.isArray(smnAlertas.tucuman)) ? smnAlertas.tucuman : [];
    try { window.CRECIDA_MONITOREO = construirMonitoreo(smnAl, sugerencias); } catch (e) {}
    // Alertas vigentes para precargar "Nueva alerta manual" (prellenado.js).
    try {
      window.CRECIDA_VIGENTES = {
        sugerencias: sugerencias.slice(),
        smn: smnAl.map((a) => Object.assign({}, a, { departamentos: AREA_DEPS[a.area_id] || [], tipo: tipoMeteo(a) })),
      };
    } catch (e) {}
    const COLOR_NIVEL = { amarillo: "#eab308", naranja: "#f59e0b", rojo: "#dc2626" };
    const alertasBlock = smnAl.length
      ? `<div class="sp-smn sp-smn-color"><strong>🛑 Alertas SMN por color (${smnAl.length})</strong>` +
        smnAl.map((a) => `<div class="sp-smn-item"><span class="sp-dot" style="background:${COLOR_NIVEL[String(a.color || "").toLowerCase()] || "#f59e0b"}"></span><strong>${String(a.color || "").toUpperCase()}</strong> · ${a.zona} — ${a.titulo || "Alerta vigente"}</div>`).join("") +
        `</div>`
      : "";
    // Banner compacto del SMN en la tarjeta principal (visible arriba del fold)
    (function () {
      const b = document.getElementById("smnBanner");
      if (!b) return;
      if (!smnAl.length) { b.hidden = true; b.innerHTML = ""; b.className = "smn-banner"; return; }
      const peso = { rojo: 3, naranja: 2, amarillo: 1 };
      const ord = smnAl.slice().sort((a, c) => (peso[c.color] || 0) - (peso[a.color] || 0));
      const peor = ord[0];
      const zonas = ord.map((a) => a.zona).slice(0, 3).join(", ") + (ord.length > 3 ? "…" : "");
      const tm = /afectad[oa]s? por (?:el |la |los |las )?([a-zA-Z\u00e0-\u00ff ]{3,28}?)(?: con| del| de | y |,|\.|$)/i.exec(peor.titulo || "");
      const tipo = tm ? tm[1].trim() : "";
      b.className = "smn-banner smn-" + (peor.color || "amarillo");
      b.hidden = false;
      b.innerHTML = '<span class="smn-b-ico">\u26a0\ufe0f</span><span class="smn-b-txt"><strong>SMN \u00b7 ' + smnAl.length +
        ' alerta(s) ' + String(peor.color || "").toUpperCase() + '</strong>' + (tipo ? " \u00b7 " + tipo : "") + ' \u2014 ' + zonas + '</span>';
    })();

    const _ina = window.CRECIDA_LASTSYNC || "—";
    const _smn = smnAcp ? (smnTuc.length ? smnTuc.length + " aviso(s)" : "sin avisos") : "—";
    const _vig = (vigiaInfo && vigiaInfo.ts) ? new Date(vigiaInfo.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—";

    let filas;
    if (errorMsg) {
      filas = `<p class="sp-empty">${errorMsg}</p>`;
    } else if (!sugerencias.length) {
      filas = `<p class="sp-empty">Sin aforos en crecida dentro de las reglas cargadas. Monitoreo normal.</p>`;
    } else {
      filas = sugerencias
        .map((s, i) => {
          const tt = s.tt_horas ? `~${s.tt_horas} h de anticipación` : "tiempo de tránsito por validar";
          return `
            <div class="sp-row">
              <p class="sp-line"><span class="sp-dot" style="background:${COLOR[s.levelKey]}"></span><strong>${LABEL[s.levelKey]} · ${s.rio}</strong> — ${s.aforo}, ${s.nivel}, ${s.tend}${Number.isFinite(s.altura) ? ` (${s.altura.toFixed(2)} m)` : ""} <span class="sp-deptos">→ ${s.departamentos.join(", ")} · ${tt}</span></p>
              <button type="button" class="sp-load" data-idx="${i}">Cargar en alerta</button>
            </div>`;
        })
        .join("");
    }

    panel.innerHTML = `
      <div class="sp-head">
        <div>
          <p class="sp-eyebrow">Alerta temprana · monitoreo INA</p>
          <h2>Sugerencias de alerta ${rojas || naranjas ? `<span class="sp-count">${rojas} rojas · ${naranjas} naranjas</span>` : ""}</h2>
        </div>
        <button type="button" id="spRefresh">Actualizar</button>
      </div>
      ${smnBlock}
      ${alertasBlock}
      <div class="sp-body">${filas}</div>
      <p class="sp-foot">Fuentes en vivo · INA ${_ina} · SMN avisos: ${_smn} · Alertas color: ${smnAl.length} · Focos: ${vigiaInfo && vigiaInfo.focos ? vigiaInfo.focos : "—"} · vigía ${_vig}</p>
    `;

    panel.querySelectorAll(".sp-load").forEach((btn) => {
      btn.addEventListener("click", () => cargarEnFormulario(sugerencias[Number(btn.dataset.idx)]));
    });
    const refresh = document.getElementById("spRefresh");
    if (refresh) refresh.addEventListener("click", calcular);
  }

  function inyectarEstilos() {
    return; // estilos centralizados en styles.css (coherencia visual)
    if (document.getElementById("motorEstilos")) return;
    const s = document.createElement("style");
    s.id = "motorEstilos";
    s.textContent = `
      #sugerenciasPanel{background:#fff;border:1px solid rgba(148,163,184,.25);border-radius:16px;
        padding:16px 18px;margin-bottom:16px;box-shadow:0 6px 24px rgba(2,6,23,.06);
        font:400 14px/1.4 system-ui,sans-serif;color:#0f172a}
      #sugerenciasPanel .sp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
      #sugerenciasPanel .sp-eyebrow{margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
      #sugerenciasPanel h2{margin:2px 0 0;font-size:17px;display:flex;align-items:center;gap:10px}
      #sugerenciasPanel .sp-count{font-size:12px;font-weight:600;color:#64748b}
      #sugerenciasPanel #spRefresh{border:1px solid rgba(148,163,184,.5);background:transparent;border-radius:999px;
        padding:6px 12px;font-size:12px;cursor:pointer;color:inherit}
      #sugerenciasPanel .sp-row{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:10px 0;border-top:1px solid #f1f5f9}
      #sugerenciasPanel .sp-line{margin:0;font-size:12.5px;line-height:1.45;color:#475569}
      #sugerenciasPanel .sp-line strong{color:#0f172a;font-weight:700}
      #sugerenciasPanel .sp-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
      #sugerenciasPanel .sp-deptos{color:#0f172a !important;font-weight:500}
      #sugerenciasPanel .sp-load{border:none;background:#0f172a;color:#fff;border-radius:7px;
        padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;align-self:flex-start}
      #sugerenciasPanel .sp-load:hover{background:#1e293b}
      #sugerenciasPanel .sp-empty{color:#64748b;padding:8px 0;margin:0}
      #sugerenciasPanel .sp-foot{margin:10px 0 0;font-size:11.5px;color:#94a3b8}
      @media (prefers-color-scheme:dark){
        #sugerenciasPanel{background:#0f172a;color:#e2e8f0;border-color:rgba(148,163,184,.2)}
        #sugerenciasPanel .sp-row{border-color:rgba(148,163,184,.15)}
        #sugerenciasPanel .sp-line{color:#94a3b8}
        #sugerenciasPanel .sp-line strong{color:#e2e8f0}
        #sugerenciasPanel .sp-deptos{color:#e2e8f0 !important}
      }
    `;
    document.head.appendChild(s);
  }

  function init() {
    inyectarEstilos();
    calcular();
    // Auto-refresco en vivo cada 7 minutos
    setInterval(() => {
      calcular();
      if (typeof window.syncHidroData === "function") window.syncHidroData({ silent: true });
    }, 7 * 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
