/* Programa CRECIDA — Envío de alertas (email vía Apps Script) con enlace de confirmación */
(function () {
  "use strict";
  const MAIL_URL = window.CRECIDA_MAIL_URL || "";
  const MAIL_CLAVE = window.CRECIDA_MAIL_CLAVE || "crecida2026";

  function linkConfirmacion(alert, r) {
    const base = window.CRECIDA_CONFIRM_BASE || location.origin;
    const qs = `a=${encodeURIComponent(alert.id || "")}&d=${encodeURIComponent(r.name || "")}&j=${encodeURIComponent(r.jurisdiction || "")}`;
    return `${base}/confirmar.html?${qs}`;
  }

  async function enviarUno(email, asunto, cuerpo) {
    if (!MAIL_URL) return { ok: false, motivo: "sin_url" };
    try {
      await fetch(MAIL_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ clave: MAIL_CLAVE, destinatarios: [email], asunto, cuerpo }),
      });
      return { ok: true };
    } catch (e) { return { ok: false, motivo: e.message }; }
  }

  function afectados() {
    const est = window.CRECIDA_estado ? window.CRECIDA_estado() : null;
    if (!est || !est.alert) return { alert: null, lista: [] };
    const af = est.alert.affected || [];
    const lista = est.destinatarios || [];
    const enZona = lista.filter((r) => af.includes(r.jurisdiction));
    return { alert: est.alert, lista: enZona.length ? enZona : lista };
  }

  const btn = document.getElementById("distributeButton");
  if (btn) {
    btn.addEventListener("click", async () => {
      const { alert, lista } = afectados();
      if (!alert) return;
      const conEmail = lista.filter((r) => r.email);
      if (!conEmail.length) {
        if (window.addAudit) window.addAudit("Envío de email", "No hay destinatarios con email cargados.", "Programa CRECIDA");
        return;
      }
      let ok = 0, fail = 0, motivo = "";
      for (const r of conEmail) {
        const cuerpo = `${alert.message}\n\n— — —\n✅ Para confirmar la recepción, abrí este enlace:\n${linkConfirmacion(alert, r)}`;
        const res = await enviarUno(r.email, `[CRECIDA] ${alert.level} — ${alert.title}`, cuerpo);
        if (res.ok) ok++; else { fail++; motivo = res.motivo; }
      }
      const msg = fail
        ? (motivo === "sin_url" ? "Email no configurado todavía (falta la URL de envío)." : `Se enviaron ${ok}, fallaron ${fail} (${motivo}).`)
        : `📧 Email enviado a ${ok} destinatario(s), con enlace de confirmación.`;
      if (window.addAudit) window.addAudit("Envío de email", msg, "Programa CRECIDA");
      if (window.showToast) window.showToast(msg);
    });
  }
})();
