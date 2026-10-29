/* Programa CRECIDA — Calidad del padrón (29/10).
   Panel en la pestaña "Usuarios" que muestra problemas de datos y permite corregir
   las jurisdicciones mal escritas ("SIMOCA" -> "Simoca") con un clic y confirmación.
   Los emails y nombres repetidos solo se informan: decidir cuál corregir es tarea humana. */
(function () {
  "use strict";

  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function oficiales() {
    const sel = document.getElementById("recipientJurisdiction");
    return sel ? Array.from(sel.options).map((o) => (o.value || o.textContent).trim()).filter(Boolean) : [];
  }
  function padron() {
    const est = window.CRECIDA_estado ? window.CRECIDA_estado() : null;
    return (est && est.destinatarios) || [];
  }

  function analizar() {
    const lista = padron();
    const ofi = oficiales();
    const porNorm = {};
    ofi.forEach((o) => { porNorm[norm(o)] = o; });

    const aCorregir = [];   // { id, antes, despues }
    const sinJurisdiccion = [];
    lista.forEach((r) => {
      const j = String(r.jurisdiction || "");
      const oficial = porNorm[norm(j)];
      if (!oficial) sinJurisdiccion.push(r);
      else if (oficial !== j && r.firebaseId) aCorregir.push({ id: r.firebaseId, antes: j, despues: oficial });
    });

    const agrupar = (clave) => {
      const g = {};
      lista.forEach((r) => { const k = clave(r); if (k) (g[k] = g[k] || []).push(r); });
      return Object.entries(g).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
    };
    const emailsRep = agrupar((r) => String(r.email || "").trim().toLowerCase());
    const nombresRep = agrupar((r) => norm(r.name));
    const sinEmail = lista.filter((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email || "").trim()));
    return { total: lista.length, aCorregir, sinJurisdiccion, emailsRep, nombresRep, sinEmail };
  }

  let abierto = false;
  let corrigiendo = false;

  function pintar() {
    const cont = document.getElementById("padronCalidad");
    if (!cont) return;
    const a = analizar();
    if (!a.total) { cont.innerHTML = ""; return; }
    const problemas = a.aCorregir.length + a.sinJurisdiccion.length + a.emailsRep.length + a.nombresRep.length + a.sinEmail.length;

    const resumenAC = a.aCorregir.reduce((m, c) => { const k = `${c.antes} → ${c.despues}`; m[k] = (m[k] || 0) + 1; return m; }, {});
    const grupo = (titulo, grupos, fila) => grupos.length
      ? `<details style="margin:8px 0"><summary style="cursor:pointer;font-weight:600">${titulo} (${grupos.length})</summary>
           <ul style="margin:6px 0 0 18px;line-height:1.5">${grupos.map(fila).join("")}</ul></details>` : "";

    cont.innerHTML = `
      <div style="border:1px solid var(--line, #e2e8f0);border-radius:12px;padding:12px 14px;margin:0 0 14px;background:var(--panel, #fff)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <strong>🧹 Calidad del padrón · ${problemas ? `${problemas} punto(s) a revisar` : "sin problemas detectados"}</strong>
          <button type="button" class="secondary-button compact-button" id="padronToggle">${abierto ? "Ocultar" : "Ver detalle"}</button>
        </div>
        ${abierto ? `
        <div style="margin-top:10px;font-size:14px">
          ${a.aCorregir.length ? `
            <div style="padding:10px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;margin-bottom:8px">
              <strong>Jurisdicciones mal escritas: ${a.aCorregir.length}</strong>
              <div style="margin:4px 0 8px;color:#78350f">${Object.entries(resumenAC).map(([k, n]) => `${esc(k)} (${n})`).join(" · ")}</div>
              <button type="button" class="primary-button compact-button" id="padronCorregir" ${corrigiendo ? "disabled" : ""}>
                ${corrigiendo ? "Corrigiendo…" : `Corregir ${a.aCorregir.length} jurisdicciones`}</button>
            </div>` : `<div style="color:#166534;margin-bottom:6px">✓ Todas las jurisdicciones están bien escritas.</div>`}
          ${a.sinJurisdiccion.length ? `<div style="color:#b91c1c;margin-bottom:6px">⚠️ ${a.sinJurisdiccion.length} miembro(s) con jurisdicción que no existe en la lista: ${a.sinJurisdiccion.slice(0, 8).map((r) => `${esc(r.name)} (“${esc(r.jurisdiction)}”)`).join(", ")}. Corregilos con “Editar”.</div>` : ""}
          ${grupo("📧 Emails cargados en más de un miembro — a estas personas les llega un solo correo", a.emailsRep,
              ([email, rs]) => `<li><strong>${esc(email)}</strong> — ${rs.length} miembros: ${rs.map((r) => `${esc(r.name)} (${esc(r.jurisdiction)})`).join(", ")}</li>`)}
          ${grupo("👥 Nombres repetidos — puede ser la misma persona cargada dos veces", a.nombresRep,
              ([, rs]) => `<li>${rs.map((r) => `${esc(r.name)} · ${esc(r.jurisdiction)} · ${esc(r.email || r.phone || "")}`).join("  |  ")}</li>`)}
          ${a.sinEmail.length ? grupo("✉️ Miembros sin email — solo se los puede avisar por WhatsApp", [["", a.sinEmail]],
              ([, rs]) => `<li>${rs.map((r) => `${esc(r.name)} (${esc(r.jurisdiction)})`).join(", ")}</li>`) : ""}
        </div>` : ""}
      </div>`;
  }

  async function corregir() {
    const a = analizar();
    if (!a.aCorregir.length || corrigiendo) return;
    const lista = Object.entries(a.aCorregir.reduce((m, c) => { const k = `${c.antes} → ${c.despues}`; m[k] = (m[k] || 0) + 1; return m; }, {}))
      .map(([k, n]) => `  ${k}: ${n}`).join("\n");
    if (typeof window.confirm === "function" &&
        !window.confirm(`Se van a corregir ${a.aCorregir.length} jurisdicciones:\n\n${lista}\n\nSolo cambia cómo está escrito el departamento; el resto de los datos no se toca. ¿Continuar?`)) return;
    corrigiendo = true; pintar();
    let ok = 0, fallas = 0;
    try {
      const db = window.firebase.firestore();
      for (let i = 0; i < a.aCorregir.length; i += 400) {
        const lote = db.batch();
        a.aCorregir.slice(i, i + 400).forEach((c) => lote.update(db.collection("destinatarios").doc(c.id), { jurisdiction: c.despues }));
        try { await lote.commit(); ok += Math.min(400, a.aCorregir.length - i); } catch (e) { fallas += Math.min(400, a.aCorregir.length - i); }
      }
    } catch (e) { fallas = a.aCorregir.length - ok; }
    corrigiendo = false;
    const msg = fallas
      ? `Se corrigieron ${ok} jurisdicciones; ${fallas} no se pudieron guardar (revisá la conexión o la sesión).`
      : `Se corrigieron ${ok} jurisdicciones del padrón.`;
    if (window.addAudit) window.addAudit("Padrón corregido", msg, "Calidad de datos");
    if (window.showToast) window.showToast(msg);
    pintar();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#padronToggle")) { abierto = !abierto; pintar(); }
    else if (e.target.closest("#padronCorregir")) { corregir(); }
  });

  // Repintar cada vez que app.js vuelve a dibujar (por ejemplo, cuando llegan cambios del padrón).
  const _render = window.render;
  window.render = function () { if (_render) _render.apply(this, arguments); pintar(); };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pintar);
  else pintar();
})();
