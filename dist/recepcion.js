/* Programa CRECIDA — Panel de Recepción en vivo (confirmaciones reales desde Firestore) */
(function () {
  "use strict";
  function slug(s) {
    return (s || "").toString().toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  let confs = []; // cache de confirmaciones

  function pintar() {
    const ackList = document.getElementById("ackList");
    if (!ackList || !window.CRECIDA_estado) return;
    const estado = window.CRECIDA_estado();
    const alert = estado && estado.alert;
    const todos = ((estado && estado.destinatarios) || []).filter((r) => r.estadoAlta !== "Pendiente");
    const sum = document.getElementById("ackSummary");
    const prog = document.getElementById("ackProgress");
    const id = alert && alert.id;
    // ¿Hay una alerta activa? (emitida o simulada). En reposo id === "—" y level === "Sin alerta".
    const activa = !!(id && id !== "—" && alert.level && alert.level !== "Sin alerta");

    ackList.innerHTML = "";
    // Sin alerta activa: NO listar destinatarios. Aparecen recién al emitir o simular una alerta.
    if (!activa) {
      ackList.innerHTML = '<li class="ack-empty" style="color:var(--muted);padding:12px 2px;list-style:none;line-height:1.4">Sin alerta activa. Los destinatarios aparecen acá al <strong>emitir</strong> o <strong>simular</strong> una alerta.</li>';
      if (sum) sum.textContent = "0/0";
      if (prog) prog.style.width = "0%";
      return;
    }

    // Alerta activa: solo los destinatarios de las jurisdicciones afectadas
    const nz = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const af = new Set(((alert && alert.affected) || []).map(nz));
    const dests = todos.filter((r) => af.has(nz(r.jurisdiction)));

    const porSlug = {};
    confs.filter((c) => c.alerta === id).forEach((c) => { porSlug[c.destSlug] = c; });

    if (!dests.length) {
      ackList.innerHTML = '<li style="color:var(--muted);padding:8px 0;list-style:none">Sin destinatarios cargados todavía.</li>';
      if (sum) sum.textContent = "0/0";
      if (prog) prog.style.width = "0%";
      return;
    }

    let conf = 0;
    dests.forEach((r) => {
      const c = porSlug[slug(r.name)];
      if (c) conf++;
      const hora = c && c.ts ? new Date(c.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="list-main"><strong>${r.name || "(s/n)"}</strong>` +
        `<span>${r.jurisdiction || ""}${hora ? " · " + hora + " h" : ""}</span></span>` +
        `<span class="status-token state-${c ? "ok" : "escalate"}">${c ? "Confirmó" : "Pendiente"}</span>`;
      ackList.appendChild(li);
    });

    if (sum) sum.textContent = `${conf}/${dests.length}`;
    if (prog) prog.style.width = Math.round((conf / dests.length) * 100) + "%";
  }

  // Repintar después del render de app.js (que arma el panel con datos demo)
  const _render = window.render;
  window.render = function () { if (_render) _render.apply(this, arguments); pintar(); };

  function init() {
    try {
      if (window.firebase && window.firebase.firestore) {
        window.firebase.firestore().collection("confirmaciones").onSnapshot(
          (snap) => { confs = snap.docs.map((d) => d.data()); pintar(); },
          () => {}
        );
      }
    } catch (e) {}
    pintar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
