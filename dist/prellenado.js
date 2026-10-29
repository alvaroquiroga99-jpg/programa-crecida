/* Programa CRECIDA — Precarga de "Nueva alerta manual" con las alertas vigentes (29/10).
   Al abrir el formulario se completan nivel, fenómeno, departamentos, vigencia y acción
   con los datos oficiales vigentes (aforos del INA y alertas por color del SMN), para no
   copiar ni tipear a mano. El operador puede elegir otra fuente o "En blanco", y siempre
   revisa antes de crear la alerta: nada se envía solo. */
(function () {
  "use strict";
  const LABEL = { red: "Roja", orange: "Naranja", yellow: "Amarilla" };
  const PESO = { yellow: 1, orange: 2, red: 3 };
  const COLOR_KEY = { amarillo: "yellow", naranja: "orange", rojo: "red" };
  const PUNTO = { red: "#dc2626", orange: "#f59e0b", yellow: "#eab308" };

  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function hora(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function fechaCorta(s) {
    const d = new Date(String(s).length <= 10 ? s + "T12:00:00" : s);
    return isNaN(d) ? String(s) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

  // --- Fuentes vigentes ------------------------------------------------------------
  function fuentes() {
    const v = window.CRECIDA_VIGENTES || { sugerencias: [], smn: [] };
    const lista = [];
    (v.sugerencias || []).forEach((s) => {
      const alt = Number.isFinite(s.altura) ? ` (${s.altura.toFixed(2)} m)` : "";
      lista.push({
        tipo: "INA",
        etiqueta: `🌊 ${LABEL[s.levelKey] || ""} · ${s.rio} — aforo ${s.aforo}`,
        levelKey: s.levelKey,
        titulo: `Crecida ${s.rio}`,
        zonas: s.departamentos || [],
        vigencia: s.tt_horas ? `Próximas ${s.tt_horas} h` : "Hasta nuevo aviso",
        accion: `Aforo INA ${s.aforo}: nivel ${String(s.nivel || "").toLowerCase()}, tendencia ${s.tend}${alt}.`,
        fuente: `INA (SIyAH) · aforo ${s.aforo}`,
      });
    });
    (v.smn || []).forEach((a) => {
      const color = String(a.color || "amarillo").toLowerCase();
      const dias = (a.dias || []).filter((d) => (d.nivel || 0) >= 3).map((d) => fechaCorta(d.fecha));
      const rep = (a.reportes || []).find((r) => r.instruccion) || {};
      lista.push({
        tipo: "SMN",
        etiqueta: `🌧️ ${cap(color)} · ${a.tipo || "alerta"} — ${a.zona}`,
        levelKey: COLOR_KEY[color] || "yellow",
        titulo: `${cap(a.tipo || "alerta meteorológica")} (SMN)`,
        zonas: a.departamentos || [],
        vigencia: dias.length ? `Según SMN: ${dias.join(", ")}` : "Según SMN",
        accion: `Alerta ${color} del SMN para ${a.zona}: ${a.titulo || ""}.` + (rep.instruccion ? ` Indicación SMN: ${rep.instruccion}` : ""),
        fuente: `SMN · alerta ${color} ${a.zona}`,
      });
    });
    if (lista.length > 1) {
      const nivel = lista.reduce((k, f) => (PESO[f.levelKey] > PESO[k] ? f.levelKey : k), "yellow");
      const zonas = [...new Set(lista.flatMap((f) => f.zonas))];
      lista.unshift({
        tipo: "TODAS",
        etiqueta: `⚡ Todas las vigentes (${lista.length})`,
        levelKey: nivel,
        titulo: [...new Set(lista.map((f) => f.titulo))].join(" + "),
        zonas,
        vigencia: lista.find((f) => f.tipo === "INA") ? "Hasta nuevo aviso" : lista[0].vigencia,
        accion: lista.map((f) => "• " + f.accion).join("\n"),
        fuente: lista.map((f) => f.fuente).join(" + "),
      });
    }
    return lista;
  }

  // --- Llenado del formulario -------------------------------------------------------
  function llenar(f) {
    const form = document.getElementById("alertForm");
    if (!form) return;
    const el = form.elements;
    if (!f) {
      form.reset();
      el.title.value = "";
      el.validUntil.value = "Próximas 3 h";
      el.directive.value = "Confirmar recepción y verificar disponibilidad operativa.";
      form.querySelectorAll('input[name="zones"]').forEach((i) => { i.checked = false; });
      form.dataset.fuente = "";
      return;
    }
    el.level.value = f.levelKey;
    el.title.value = f.titulo;
    el.validUntil.value = f.vigencia;
    el.directive.value = `${f.accion}\nConfirmar recepción y verificar disponibilidad operativa.`;
    const zonas = new Set(f.zonas.map(norm));
    form.querySelectorAll('input[name="zones"]').forEach((i) => { i.checked = zonas.has(norm(i.value)); });
    form.dataset.fuente = f.fuente;
  }

  let elegida = 0;
  function pintar() {
    const cont = document.getElementById("prellenadoFuentes");
    if (!cont) return;
    const fs = fuentes();
    if (!fs.length) {
      cont.innerHTML = `<div style="padding:10px 12px;border-radius:10px;background:#f1f5f9;margin-bottom:12px;font-size:14px">
        Sin alertas vigentes del SMN ni del INA en este momento. Completá los datos a mano.</div>`;
      llenar(null);
      return;
    }
    if (elegida > fs.length) elegida = 0;
    const btn = (f, i) => `<button type="button" data-prellenado="${i}" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px 10px;margin:4px 0;border-radius:10px;cursor:pointer;font:inherit;font-size:14px;` +
      `border:2px solid ${i === elegida ? "#0e6e8c" : "#e2e8f0"};background:${i === elegida ? "#ecfeff" : "#fff"};color:#0f172a">` +
      (f ? `<span style="width:10px;height:10px;border-radius:50%;flex:none;background:${PUNTO[f.levelKey] || "#94a3b8"}"></span>${esc(f.etiqueta)}` : "✏️ En blanco (cargar a mano)") + `</button>`;
    cont.innerHTML = `<div style="margin-bottom:12px">
      <p style="margin:0 0 4px;font-size:13px;color:#475569"><strong>Tomar datos de la alerta vigente:</strong> el formulario se completa solo. Revisalo antes de crear.</p>
      ${fs.map((f, i) => btn(f, i)).join("")}${btn(null, fs.length)}</div>`;
    llenar(elegida < fs.length ? fs[elegida] : null);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-prellenado]");
    if (b) { elegida = Number(b.dataset.prellenado); pintar(); return; }
    if (e.target.closest("#openAlertModal")) { elegida = 0; pintar(); }
  });

  // "Cargar en alerta" (una sugerencia puntual del motor) abre el formulario con
  // window.openAlertModal: se respeta esa carga, se oculta el selector y se registra la fuente.
  function envolverApertura() {
    const abrir = window.openAlertModal;
    if (typeof abrir !== "function" || abrir.__prellenado) return;
    const envuelta = function () {
      const cont = document.getElementById("prellenadoFuentes");
      if (cont) cont.innerHTML = "";
      const form = document.getElementById("alertForm");
      if (form) {
        const t = (form.elements.title.value || "").replace(/^Crecida\s+/, "");
        const s = ((window.CRECIDA_VIGENTES || {}).sugerencias || []).find((x) => x.rio === t);
        form.dataset.fuente = s ? `INA (SIyAH) · aforo ${s.aforo}` : "";
      }
      return abrir.apply(this, arguments);
    };
    envuelta.__prellenado = true;
    window.openAlertModal = envuelta;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", envolverApertura);
  else envolverApertura();
})();
