/* Programa CRECIDA — Envío de alertas (email vía Apps Script) */
(function () {
  "use strict";
  const MAIL_URL = window.CRECIDA_MAIL_URL || "";
  const MAIL_CLAVE = window.CRECIDA_MAIL_CLAVE || "crecida2026";

  async function enviarEmails(destinatarios, asunto, cuerpo) {
    if (!MAIL_URL) return { ok: false, motivo: "sin_url" };
    try {
      await fetch(MAIL_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ clave: MAIL_CLAVE, destinatarios, asunto, cuerpo }),
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, motivo: e.message };
    }
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
      const emails = lista.map((r) => r.email).filter(Boolean);
      if (!emails.length) {
        if (window.addAudit) window.addAudit("Envío de email", "No hay destinatarios con email cargados.", "Programa CRECIDA");
        return;
      }
      const r = await enviarEmails(emails, `[CRECIDA] ${alert.level} — ${alert.title}`, alert.message);
      const msg = r.ok
        ? `📧 Email enviado a ${emails.length} destinatario(s).`
        : r.motivo === "sin_url"
          ? "Email no configurado todavía (falta la URL de envío)."
          : "No se pudo enviar email: " + r.motivo;
      if (window.addAudit) window.addAudit("Envío de email", msg, "Programa CRECIDA");
      if (window.showToast) window.showToast(msg);
    });
  }
})();
