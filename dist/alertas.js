/* Programa CRECIDA — "Alertas del día": tablero de recepción por evento, con drill-down */
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

  function detalle(a) {
    const confA = confs.filter((c) => c.alerta === a.id);
    const confSet = new Set(confA.map((c) => c.destSlug || slug(c.dest)));
    // Objetivo = usuarios activos del padrón en los departamentos de la alerta
    const objetivo = dests.filter(
      (d) => (d.estadoAlta || "Activo") !== "Pendiente" && (a.departamentos || []).includes(d.jurisdiction),
    );
    const faltan = objetivo.filter((d) => !confSet.has(slug(d.name)));
    const confRows = confA
      .map((c) => `<li><span class="nm">${c.dest || "(s/n)"}</span><span class="mt">${c.jurisdiction || ""}${c.ts ? " · " + hora(c.ts) : ""}</span></li>`)
      .join("") || '<li class="vacio">Nadie confirmó todavía.</li>';
    const faltanRows = faltan
      .map((d) => `<li><span class="nm">${d.name}</span><span class="mt">${d.jurisdiction || ""}</span></li>`)
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
      </div>`;
  }

  function pintar() {
    const cont = document.getElementById("alertasBoard");
    if (!cont) return;
    if (!alertas.length) {
      cont.innerHTML = '<p style="color:var(--muted);padding:12px 0">Todavía no se emitió ninguna alerta. Cuando distribuyas una, aparece acá con su tablero de recepción en vivo.</p>';
      return;
    }
    const porAlerta = {};
    confs.forEach((c) => { porAlerta[c.alerta] = (porAlerta[c.alerta] || 0) + 1; });

    cont.innerHTML = alertas.map((a) => {
      const conf = porAlerta[a.id] || 0;
      const obj = a.objetivo || 0;
      const pct = obj ? Math.round((conf / obj) * 100) : 0;
      const abierta = expandidas.has(a.id);
      return `
        <div class="al-card" style="border-left:5px solid ${color(a.levelKey)}">
          <div class="al-head al-toggle" data-alerta="${a.id}" role="button" tabindex="0">
            <div class="al-title">
              <span class="al-nivel" style="background:${color(a.levelKey)}">${a.nivel || "Alerta"}</span>
              <strong>${a.titulo || a.id}</strong>
              <div class="al-sub">${fmtHora(a.emitidaEn)} · ${(a.departamentos || []).join(", ") || "—"}</div>
            </div>
            <div class="al-metric"><strong>${conf}/${obj}</strong><span>${pct}% · ${abierta ? "ocultar ▲" : "ver detalle ▼"}</span></div>
          </div>
          <div class="al-bar"><div class="al-fill" style="width:${pct}%;background:${color(a.levelKey)}"></div></div>
          ${abierta ? detalle(a) : ""}
        </div>`;
    }).join("");
  }

  function init() {
    const cont = document.getElementById("alertasBoard");
    if (cont) {
      cont.addEventListener("click", (e) => {
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
        .onSnapshot((s) => { dests = s.docs.map((d) => d.data()); pintar(); }, () => {});
    } catch (e) {}
    pintar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
