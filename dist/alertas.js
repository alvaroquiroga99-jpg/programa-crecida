/* Programa CRECIDA — "Alertas del día": tablero de recepción por evento, con drill-down.
   29/10: compara jurisdicciones sin mayúsculas/tildes, marca los simulacros como PRUEBA,
   oculta los simulacros viejos (ACP-SMN-TUC-ROJO*) y ofrece WhatsApp a quien no confirmó. */
(function () {
  "use strict";

  let alertas = [];
  let confs = [];
  let dests = [];
  const expandidas = new Set();

  function slug(s) {
    return (s || "").toString().toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtHora(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function hora(ts) {
    if (!ts) return "";
    const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " h";
  }
  function color(k) {
    return k === "red" ? "#dc2626" : k === "orange" ? "#f59e0b" : k === "yellow" ? "#eab308" : "#0e6e8c";
  }
  function waPhone(p) {
    const d = String(p || "").replace(/\D/g, "");
    if (!d) return "";
    return d.startsWith("54") ? d : "549" + d;
  }
  // No se muestran en el tablero: simulacros anteriores al 29/10 (texto con "Fuente: SMN")
  // y el envío accidental "Sin alerta" (id "—") del 27/10. Los datos NO se borran.
  function esLegado(a) {
    const id = String(a.id || "");
    return /^ACP-SMN-TUC-ROJO/.test(id) || id === "—" || a.nivel === "Sin alerta";
  }

  function confirmo(a, d, confA) {
    return confA.some((c) => (c.destId && d.id && c.destId === d.id) || (!c.destId && (c.destSlug || slug(c.dest)) === slug(d.name)));
  }

  function linkWhatsApp(a, d) {
    const tel = waPhone(d.phone);
    if (!tel) return "";
    const base = location.origin;
    const link = `${base}/confirmar.html?a=${encodeURIComponent(a.id || "")}&d=${encodeURIComponent(d.name || "")}` +
      `&j=${encodeURIComponent(d.jurisdiction || "")}` + (d.id ? `&u=${encodeURIComponent(d.id)}` : "");
    const txt = `PROGRAMA CRECIDA — ${a.nivel || "Alerta"}: ${a.titulo || a.id}\n` +
      `Zona: ${(a.departamentos || []).join(", ")}.\nTe enviamos la alerta por correo y aún no figura tu confirmación.\n` +
      `✅ Confirmá la recepción acá: ${link}`;
    return `<a class="al-wa" href="https://wa.me/${tel}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener" ` +
      `style="margin-left:8px;font-size:12px;font-weight:600;color:#15803d;text-decoration:none">WhatsApp ↗</a>`;
  }

  function detalle(a) {
    const confA = confs.filter((c) => c.alerta === a.id);
    const confRows = confA
      .map((c) => `<li><span class="nm">${esc(c.dest || "(s/n)")}</span><span class="mt">${esc(c.jurisdiction || "")}${c.ts ? " · " + hora(c.ts) : ""}</span></li>`)
      .join("") || '<li class="vacio">Nadie confirmó todavía.</li>';

    if (a.prueba) {
      return `
      <div class="al-detalle">
        <div class="al-col">
          <h4>✅ Confirmaron (${confA.length})</h4>
          <ul>${confRows}</ul>
        </div>
        <div class="al-col">
          <h4>🧪 Prueba de funcionamiento</h4>
          <ul><li class="vacio">Enviada solo a la casilla del operador. Ningún miembro del padrón la recibió.</li></ul>
        </div>
      </div>`;
    }

    const sinEnviar = (a.fallidos || []).length
      ? `<div class="al-col" style="grid-column:1/-1"><h4>⚠️ Correos que no salieron (${a.fallidos.length}) — avisales por WhatsApp</h4><ul>` +
        a.fallidos.map((f) => `<li><span class="nm">${esc(f.name || "(s/n)")}</span><span class="mt">${esc(f.motivo || "")}</span></li>`).join("") + "</ul></div>"
      : "";
    // Objetivo = usuarios activos del padrón en los departamentos de la alerta (sin distinguir mayúsculas/tildes)
    const zonas = new Set((a.departamentos || []).map(norm));
    const objetivo = dests.filter((d) => (d.estadoAlta || "Activo") !== "Pendiente" && zonas.has(norm(d.jurisdiction)));
    const faltan = objetivo.filter((d) => !confirmo(a, d, confA));
    const faltanRows = faltan
      .map((d) => `<li><span class="nm">${esc(d.name)}${linkWhatsApp(a, d)}</span><span class="mt">${esc(d.jurisdiction || "")}</span></li>`)
      .join("") || '<li class="vacio">✅ Todos confirmaron.</li>';
    return `
      <div class="al-detalle">
        <div class="al-col">
          <h4>✅ Confirmaron (${confA.length})</h4>
          <ul>${confRows}</ul>
        </div>
        <div class="al-col">
          <h4>⏳ Faltan (${faltan.length})</h4>
          <ul>${faltanRows}</ul>
        </div>
        ${sinEnviar}
      </div>`;
  }

  function pintar() {
    const cont = document.getElementById("alertasBoard");
    if (!cont) return;
    // Solo los últimos 7 días (las pruebas de octubre no ensucian el tablero; los datos no se borran).
    // Una alerta recién emitida todavía no tiene hora del servidor: cuenta como "ahora".
    const desde = Date.now() - 7 * 24 * 3600 * 1000;
    const ms = (ts) => (!ts ? Date.now() : (ts.toDate ? ts.toDate() : new Date(ts)).getTime());
    const visibles = alertas.filter((a) => !esLegado(a) && ms(a.emitidaEn) >= desde);
    if (!visibles.length) {
      cont.innerHTML = '<p style="color:var(--muted);padding:12px 0">No hay alertas enviadas en los últimos 7 días. Cuando envíes una, aparece acá con sus confirmaciones en vivo.</p>';
      return;
    }
    const porAlerta = {};
    confs.forEach((c) => { porAlerta[c.alerta] = (porAlerta[c.alerta] || 0) + 1; });

    cont.innerHTML = visibles.map((a) => {
      const conf = porAlerta[a.id] || 0;
      const obj = a.objetivo || 0;
      const pct = obj ? Math.min(100, Math.round((conf / obj) * 100)) : 0;
      const abierta = expandidas.has(a.id);
      const tagPrueba = a.prueba
        ? '<span class="al-nivel" style="background:#92400e;margin-left:6px">PRUEBA</span>' : "";
      return `
        <div class="al-card" id="al-${esc(a.id)}" style="border-left:5px solid ${color(a.levelKey)}">
          <div class="al-head al-toggle" data-alerta="${esc(a.id)}" role="button" tabindex="0">
            <div class="al-title">
              <span class="al-nivel" style="background:${color(a.levelKey)}">${esc(a.nivel || "Alerta")}</span>${tagPrueba}
              <strong>${esc(a.titulo || a.id)}</strong>
              <div class="al-sub">${fmtHora(a.emitidaEn)} · ${esc((a.departamentos || []).join(", ") || "—")}${a.conError ? ` · <span style="color:#b45309;font-weight:600">⚠️ ${a.conError} sin enviar</span>` : ""}</div>
            </div>
            <div class="al-metric"><strong>${conf}/${obj}</strong><span>${pct}% · ${abierta ? "ocultar ▲" : "ver detalle ▼"}</span></div>
          </div>
          <div class="al-bar"><div class="al-fill" style="width:${pct}%;background:${color(a.levelKey)}"></div></div>
          ${abierta ? detalle(a) : ""}
        </div>`;
    }).join("");
  }

  // Usado por el botón "Ver quién no confirmó": abre el detalle de esa alerta.
  window.CRECIDA_verFaltantes = function (id) {
    if (id) expandidas.add(id);
    pintar();
    const el = id && document.getElementById("al-" + id);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function init() {
    const cont = document.getElementById("alertasBoard");
    if (cont) {
      cont.addEventListener("click", (e) => {
        if (e.target.closest(".al-wa")) return; // el link de WhatsApp no colapsa la tarjeta
        const t = e.target.closest(".al-toggle");
        if (!t) return;
        const id = t.dataset.alerta;
        if (expandidas.has(id)) expandidas.delete(id); else expandidas.add(id);
        pintar();
      });
    }
    try {
      const db = window.firebase.firestore();
      db.collection("alertas").orderBy("emitidaEn", "desc").limit(50)
        .onSnapshot((s) => { alertas = s.docs.map((d) => d.data()); pintar(); }, () => {});
      db.collection("confirmaciones")
        .onSnapshot((s) => { confs = s.docs.map((d) => d.data()); pintar(); }, () => {});
      db.collection("destinatarios")
        .onSnapshot((s) => { dests = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintar(); }, () => {});
    } catch (e) {}
    pintar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
