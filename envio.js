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

  function htmlEmail(alert, link) {
    const msg = String(alert.message || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">` +
      `<div style="background:#0e6e8c;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;font-weight:700;letter-spacing:.02em">PROGRAMA CRECIDA · Alerta</div>` +
      `<div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:18px">` +
      `<div style="line-height:1.5;font-size:14px">${msg}</div>` +
      `<p style="text-align:center;margin:22px 0 10px">` +
      `<a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;font-size:15px">✅ Confirmar recepción</a>` +
      `</p>` +
      `<p style="font-size:12px;color:#64748b;margin-top:14px">Si el botón no abre, copiá y pegá este enlace:<br>` +
      `<a href="${link}" style="color:#0e6e8c">${link}</a></p>` +
      `<p style="font-size:11px;color:#94a3b8;border-top:1px solid #eef2f7;padding-top:10px;margin-top:14px">Sistema operativo de alerta temprana · DGIME-SIPROSA</p>` +
      `</div></div>`;
  }

  async function enviarUno(email, asunto, cuerpo, html) {
    if (!MAIL_URL) return { ok: false, motivo: "sin_url" };
    try {
      await fetch(MAIL_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ clave: MAIL_CLAVE, destinatarios: [email], asunto, cuerpo, html }),
      });
      return { ok: true };
    } catch (e) { return { ok: false, motivo: e.message }; }
  }

  function afectados() {
    const est = window.CRECIDA_estado ? window.CRECIDA_estado() : null;
    if (!est || !est.alert) return { alert: null, lista: [] };
    const af = est.alert.affected || [];
    const activos = (est.destinatarios || []).filter((r) => r.estadoAlta !== "Pendiente");
    const enZona = activos.filter((r) => af.includes(r.jurisdiction));
    return { alert: est.alert, lista: enZona.length ? enZona : activos };
  }

  async function registrarAlerta(alert, objetivo) {
    try {
      if (!(window.firebase && window.firebase.firestore) || !alert.id) return;
      await window.firebase.firestore().collection("alertas").doc(alert.id).set({
        id: alert.id,
        nivel: alert.level || "",
        levelKey: alert.levelKey || "",
        titulo: alert.title || alert.id,
        departamentos: alert.affected || [],
        objetivo: objetivo,
        canal: "email + whatsapp",
        emitidaEn: window.firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {}
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
      registrarAlerta(alert, lista.length);
      let ok = 0, fail = 0, motivo = "";
      for (const r of conEmail) {
        const link = linkConfirmacion(alert, r);
        const cuerpo = `${alert.message}\n\n— — —\n✅ Para confirmar la recepción, abrí este enlace:\n${link}`;
        const res = await enviarUno(r.email, `[CRECIDA] ${alert.level} — ${alert.title}`, cuerpo, htmlEmail(alert, link));
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
