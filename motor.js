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

  // Nivel sugerido a partir de campos REALES del INA (nivel_alerta + tendencia).
  // No usamos cotas absolutas inventadas: nos apoyamos en lo que informa la fuente.
  function nivelSugerido(nivel, tend) {
    const n = (nivel || "").toLowerCase();
    const t = (tend || "").toLowerCase();
    const esCrecida = n.includes("alerta crecida") || n.includes("evacua");
    const enAlza = n.includes("alza") || t === "crece";
    if (esCrecida && t === "crece") return "red";
    if (esCrecida) return "orange";
    if (enAlza) return "orange";
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
  let vigiaInfo = null;

  async function leerFuentes() {
    if (!(window.firebase && window.firebase.firestore)) return;
    const db = window.firebase.firestore();
    try { const a = await db.collection("smn").doc("acp").get(); smnAcp = a.exists ? a.data() : null; } catch (e) {}
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
        const regla = buscarRegla(a.nombre);
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
      const cont = document.querySelector(".jurisdiction-panel") || document.getElementById("operationView");
      if (!cont) return;
      panel = document.createElement("section");
      panel.id = "sugerenciasPanel";
      cont.insertBefore(panel, cont.firstChild);
    }

    const rojas = sugerencias.filter((s) => s.levelKey === "red").length;
    const naranjas = sugerencias.filter((s) => s.levelKey === "orange").length;
    const smnTuc = (smnAcp && Array.isArray(smnAcp.tucuman)) ? smnAcp.tucuman : [];
    const smnBlock = smnTuc.length
      ? `<div class="sp-smn"><strong>⚠️ Avisos oficiales SMN (${smnTuc.length})</strong>` +
        smnTuc.map((av) => `<div class="sp-smn-item">${av.title || av.titulo || av.name || "Aviso SMN vigente"}</div>`).join("") +
        `</div>`
      : "";
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
              <span class="sp-dot" style="background:${COLOR[s.levelKey]}"></span>
              <div class="sp-info">
                <strong>${LABEL[s.levelKey]} · ${s.rio}</strong>
                <span>${s.aforo} — ${s.nivel}, ${s.tend}${Number.isFinite(s.altura) ? ` (${s.altura.toFixed(2)} m)` : ""}</span>
                <span class="sp-deptos">→ ${s.departamentos.join(", ")} · ${tt}</span>
              </div>
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
      <div class="sp-body">${filas}</div>
      <p class="sp-foot">Fuentes en vivo · INA ${_ina} · SMN: ${_smn} · Focos: ${vigiaInfo && vigiaInfo.focos ? vigiaInfo.focos : "—"} · vigía ${_vig}</p>
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
      #sugerenciasPanel .sp-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #f1f5f9}
      #sugerenciasPanel .sp-dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto}
      #sugerenciasPanel .sp-info{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
      #sugerenciasPanel .sp-info span{color:#475569;font-size:12.5px}
      #sugerenciasPanel .sp-deptos{color:#0f172a !important;font-weight:500}
      #sugerenciasPanel .sp-load{border:none;background:#0f172a;color:#fff;border-radius:8px;
        padding:8px 12px;font-size:12.5px;font-weight:600;cursor:pointer;flex:0 0 auto}
      #sugerenciasPanel .sp-load:hover{background:#1e293b}
      #sugerenciasPanel .sp-empty{color:#64748b;padding:8px 0;margin:0}
      #sugerenciasPanel .sp-foot{margin:10px 0 0;font-size:11.5px;color:#94a3b8}
      @media (prefers-color-scheme:dark){
        #sugerenciasPanel{background:#0f172a;color:#e2e8f0;border-color:rgba(148,163,184,.2)}
        #sugerenciasPanel .sp-row{border-color:rgba(148,163,184,.15)}
        #sugerenciasPanel .sp-info span{color:#94a3b8}
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
