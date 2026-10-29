/* Programa CRECIDA — Envío de alertas por correo (Apps Script) con enlace de confirmación.
   Reglas de seguridad (29/10):
   - Solo se envía a usuarios ACTIVOS de los departamentos de la alerta. Si no hay nadie, NO se envía
     (antes caía a "todos los usuarios", lo que podía mandar una alerta local a toda la provincia).
   - La jurisdicción se compara sin mayúsculas ni tildes ("SIMOCA" = "Simoca").
   - Siempre se muestra un resumen y se pide confirmación antes de enviar.
   - Modo prueba (Simulacro): el correo va SOLO a la casilla del operador, marcado como
     PRUEBA DE FUNCIONAMIENTO. Nadie del padrón lo recibe.
   - Si el envío supera el cupo diario de Gmail, no se envía (evita envíos a medias). */
(function () {
  "use strict";
  const MAIL_URL = window.CRECIDA_MAIL_URL || "";
  const MAIL_CLAVE = window.CRECIDA_MAIL_CLAVE || "";

  // --- Utilidades -----------------------------------------------------------
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }
  window.CRECIDA_norm = norm;

  function esEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim()); }

  function alertaActiva(a) {
    return !!(a && a.id && a.id !== "—" && a.level && a.level !== "Sin alerta");
  }

  // Casillas que reciben los simulacros: CRECIDA_TEST_EMAILS (firebase-config.js) o el usuario logueado.
  function emailsPrueba() {
    const cfg = window.CRECIDA_TEST_EMAILS;
    if (Array.isArray(cfg) && cfg.filter(esEmail).length) return cfg.filter(esEmail);
    let u = "";
    try { u = sessionStorage.getItem("crecida_user") || ""; } catch (e) {}
    return esEmail(u) ? [u] : [];
  }

  // Destinatarios reales de una alerta: activos + jurisdicción dentro de los departamentos afectados.
  function destinatariosDe(alert) {
    const est = window.CRECIDA_estado ? window.CRECIDA_estado() : null;
    const zonas = new Set(((alert && alert.affected) || []).map(norm));
    const activos = ((est && est.destinatarios) || []).filter((r) => (r.estadoAlta || "Activo") !== "Pendiente");
    return activos.filter((r) => zonas.has(norm(r.jurisdiction)));
  }
  window.CRECIDA_destinatariosDe = destinatariosDe;

  // Un correo por casilla (hay usuarios cargados dos veces con el mismo email).
  function sinDuplicados(lista) {
    const vistos = new Set();
    return lista.filter((r) => {
      const k = String(r.email || "").trim().toLowerCase();
      if (!esEmail(k) || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }
  // Cantidad real de correos que saldrían para una alerta (lo usa el botón de app.js).
  window.CRECIDA_destinatariosConEmail = (alert) => sinDuplicados(destinatariosDe(alert));

  function nivelTexto(alert) {
    return { red: "roja", orange: "naranja", yellow: "amarilla" }[alert.levelKey] || String(alert.level || "").toLowerCase();
  }

  // --- Aviso visible (antes se llamaba a window.showToast, que no existía) ----
  function toast(texto, tipo) {
    let el = document.getElementById("crecidaToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "crecidaToast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;" +
        "max-width:min(560px,92vw);padding:14px 18px;border-radius:12px;font:500 14px/1.45 system-ui,sans-serif;" +
        "box-shadow:0 12px 32px rgba(2,6,23,.25);color:#fff;transition:opacity .3s";
      document.body.appendChild(el);
    }
    el.style.background = tipo === "warn" ? "#b45309" : tipo === "error" ? "#b91c1c" : "#166534";
    el.textContent = texto;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = "0"; }, 9000);
  }
  if (!window.showToast) window.showToast = (t) => toast(t);

  // --- Correo -----------------------------------------------------------------
  function linkConfirmacion(alert, r) {
    const base = window.CRECIDA_CONFIRM_BASE || location.origin;
    const qs = `a=${encodeURIComponent(alert.id || "")}&d=${encodeURIComponent(r.name || "")}` +
      `&j=${encodeURIComponent(r.jurisdiction || "")}` + (r.firebaseId ? `&u=${encodeURIComponent(r.firebaseId)}` : "");
    return `${base}/confirmar.html?${qs}`;
  }
  window.CRECIDA_linkConfirmacion = linkConfirmacion;

  function htmlEmail(alert, link) {
    const msg = String(alert.message || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    const banner = alert.esPrueba
      ? `<div style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:10px 14px;border-radius:10px;font-weight:700;margin-bottom:14px">🧪 ESTO ES UNA PRUEBA DE FUNCIONAMIENTO — no requiere ninguna acción.</div>`
      : "";
    return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">` +
      `<div style="background:#0e6e8c;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;font-weight:700;letter-spacing:.02em">PROGRAMA CRECIDA · ${alert.esPrueba ? "Prueba de funcionamiento" : "Alerta"}</div>` +
      `<div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:18px">` + banner +
      `<div style="line-height:1.5;font-size:14px">${msg}</div>` +
      `<p style="text-align:center;margin:22px 0 10px">` +
      `<a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;font-size:15px">✅ Confirmar recepción</a>` +
      `</p>` +
      `<p style="font-size:12px;color:#64748b;margin-top:14px">Si el botón no abre, copiá y pegá este enlace:<br>` +
      `<a href="${link}" style="color:#0e6e8c">${link}</a></p>` +
      `<p style="font-size:11px;color:#94a3b8;border-top:1px solid #eef2f7;padding-top:10px;margin-top:14px">Sistema operativo de alerta temprana · DGIME-SIPROSA</p>` +
      `</div></div>`;
  }

  // Apps Script responde sin CORS: la app sólo puede saber que el pedido salió, no si Gmail lo entregó.
  // Token de la sesión de Firebase: el Apps Script lo valida para saber que el pedido es de un operador.
  async function tokenSesion() {
    try {
      const u = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
      return u ? await u.getIdToken() : "";
    } catch (e) { return ""; }
  }

  // Lee la respuesta real del Apps Script: { ok, error, cupoRestante }.
  // estado: "ok" (Gmail lo aceptó) · "error" (el script lo rechazó) · "desconocido" (sin respuesta legible).
  const MOTIVOS = {
    no_autorizado: "sesión no válida: volvé a ingresar",
    sin_cupo: "se agotó el cupo diario de Gmail",
    sin_destinatarios: "email inválido",
    demasiados_destinatarios: "demasiados destinatarios en un pedido",
    sin_url: "correo no configurado",
  };
  function motivoLegible(e) { return MOTIVOS[e] || String(e || "error desconocido"); }

  async function enviarUno(email, asunto, cuerpo, html) {
    if (!MAIL_URL) return { estado: "error", error: "sin_url" };
    let r;
    try {
      const idToken = await tokenSesion();
      r = await fetch(MAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ idToken, clave: MAIL_CLAVE, destinatarios: [email], asunto, cuerpo, html }),
      });
    } catch (e) {
      // El pedido pudo haber llegado igual: no se reintenta para no duplicar el correo.
      return { estado: "desconocido", error: "sin respuesta (" + (e && e.message ? e.message : "red") + ")" };
    }
    try {
      const d = await r.json();
      if (d && d.ok) return { estado: "ok", cupoRestante: d.cupoRestante };
      return { estado: "error", error: (d && d.error) || "respuesta inválida" };
    } catch (e) {
      return { estado: "desconocido", error: "respuesta ilegible (HTTP " + r.status + ")" };
    }
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
        prueba: !!alert.esPrueba,
        canal: "email",
        emitidaEn: window.firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {}
  }

  function audit(t, d) { if (window.addAudit) window.addAudit(t, d, "Programa CRECIDA"); }

  // --- Botón "Enviar" -----------------------------------------------------------
  const btn = document.getElementById("distributeButton");
  let enCurso = false;
  if (btn) {
    btn.addEventListener("click", async () => {
      if (enCurso) return;
      const est = window.CRECIDA_estado ? window.CRECIDA_estado() : null;
      const alert = est && est.alert;
      if (!alertaActiva(alert)) {
        toast("No hay alerta cargada. Primero creá una con “＋ Nueva alerta manual” o desde una sugerencia.", "warn");
        return;
      }
      if (est.enviada) {
        toast("Esta alerta ya fue enviada. Para un aviso nuevo, cerrala y cargá otra.", "warn");
        return;
      }

      const prueba = !!alert.esPrueba;
      let lista;
      if (prueba) {
        lista = emailsPrueba().map((e) => ({ name: "Prueba de funcionamiento", email: e, jurisdiction: "PRUEBA" }));
        if (!lista.length) {
          toast("Simulacro: no hay una casilla de prueba configurada. No se envió nada.", "warn");
          return;
        }
      } else {
        lista = destinatariosDe(alert);
      }
      const conEmail = sinDuplicados(lista);
      const zonas = (alert.affected || []).join(", ");

      if (!conEmail.length) {
        const m = `No hay usuarios activos con email en ${zonas || "los departamentos elegidos"}. No se envió nada.`;
        audit("Envío no realizado", m);
        toast(m, "warn");
        return;
      }

      const q = window.CRECIDA_cuota ? window.CRECIDA_cuota.estado() : null;
      if (q && conEmail.length > q.restantes) {
        const m = `Este envío son ${conEmail.length} correos y hoy quedan ${q.restantes} de ${q.limite} (tope diario de Gmail). ` +
          `No se envió nada para evitar un envío a medias. Achicá la zona o avisá por WhatsApp desde “Usuarios”.`;
        audit("Envío bloqueado por cupo", m);
        toast(m, "warn");
        return;
      }

      const sinMail = prueba ? 0 : lista.filter((r) => !esEmail(r.email)).length;
      const resumen = prueba
        ? `🧪 PRUEBA DE FUNCIONAMIENTO\n\nSe enviará SOLO a: ${conEmail.map((r) => r.email).join(", ")}\n` +
          `Ningún usuario del padrón recibe este correo.\n\n¿Enviar la prueba?`
        : `Vas a enviar una ALERTA REAL por correo.\n\n` +
          `Nivel: ${alert.level} — ${alert.title}\nDepartamentos: ${zonas}\n` +
          `Destinatarios: ${conEmail.length} usuario(s) activos con email` +
          (sinMail ? `\n(${sinMail} sin email: avisales por WhatsApp desde “Usuarios”)` : "") +
          (q ? `\nCupo de hoy luego del envío: ${q.restantes - conEmail.length} de ${q.limite}` : "") +
          `\n\n¿Confirmás el envío?`;
      if (typeof window.confirm === "function" && !window.confirm(resumen)) {
        toast("Envío cancelado. No se envió nada.", "warn");
        return;
      }

      enCurso = true;
      btn.disabled = true;
      btn.dataset.enviando = "1";
      await registrarAlerta(alert, conEmail.length);

      const asunto = prueba
        ? `[PRUEBA DE FUNCIONAMIENTO] CRECIDA — ${alert.title}`
        : `[CRECIDA] Alerta ${nivelTexto(alert)} — ${alert.title}`;
      let ok = 0, dudosos = 0, cupoGmail = null;
      const fallidos = [];       // { name, email, motivo }
      for (let i = 0; i < conEmail.length; i++) {
        const r = conEmail[i];
        btn.textContent = `Enviando… ${i + 1}/${conEmail.length}`;
        const link = linkConfirmacion(alert, r);
        const cuerpo = `${alert.message}\n\n— — —\n✅ Para confirmar la recepción, abrí este enlace:\n${link}`;
        const res = await enviarUno(r.email, asunto, cuerpo, htmlEmail(alert, link));
        if (res.estado === "ok") { ok++; if (res.cupoRestante != null) cupoGmail = res.cupoRestante; }
        else if (res.estado === "desconocido") { dudosos++; }
        else {
          fallidos.push({ name: r.name || "", email: r.email, motivo: motivoLegible(res.error) });
          // Sin sesión o sin cupo, el resto también va a fallar: se corta y se informa a quiénes no les llegó.
          if (res.error === "no_autorizado" || res.error === "sin_cupo" || res.error === "sin_url") {
            conEmail.slice(i + 1).forEach((x) => fallidos.push({ name: x.name || "", email: x.email, motivo: "no se intentó (" + motivoLegible(res.error) + ")" }));
            break;
          }
        }
      }
      try { if (window.CRECIDA_cuota) await window.CRECIDA_cuota.sumar(ok + dudosos); } catch (e) {}
      try {
        if (window.firebase && window.firebase.firestore && alert.id) {
          await window.firebase.firestore().collection("alertas").doc(alert.id).set({
            enviados: ok, dudosos: dudosos, conError: fallidos.length,
            fallidos: fallidos.slice(0, 200).map((f) => ({ name: f.name, motivo: f.motivo })),
          }, { merge: true });
        }
      } catch (e) {}

      enCurso = false;
      delete btn.dataset.enviando;
      const detalleFallas = fallidos.length
        ? " Sin enviar: " + fallidos.slice(0, 5).map((f) => (f.name || f.email) + " (" + f.motivo + ")").join("; ") +
          (fallidos.length > 5 ? ` y ${fallidos.length - 5} más.` : ".")
        : "";
      if (ok === 0 && dudosos === 0) {
        const msg = `No salió ningún correo. ${fallidos.length ? "Motivo: " + fallidos[0].motivo + "." : ""} La alerta sigue cargada: podés reintentar.`;
        audit("Envío fallido", msg + detalleFallas);
        btn.disabled = false;
        if (window.render) window.render();
        toast(msg, "error");
        return;
      }
      const resumenEnvio = (prueba ? `🧪 Prueba: ` : `📧 `) +
        `${ok} correo(s) enviados` +
        (dudosos ? `, ${dudosos} sin respuesta del servidor (pueden haber salido o no: si no confirman en unos minutos, avisales por WhatsApp)` : "") +
        (fallidos.length ? `, ${fallidos.length} sin enviar` : "") + "." +
        (cupoGmail != null ? ` Cupo de Gmail restante hoy: ${cupoGmail}.` : "");
      if (window.CRECIDA_marcarDistribuida) window.CRECIDA_marcarDistribuida(resumenEnvio + detalleFallas);
      else audit("Alerta distribuida", resumenEnvio + detalleFallas);
      toast(resumenEnvio + (fallidos.length ? " Detalle en “Trazabilidad”." : " Las confirmaciones aparecen en “Confirmaciones”."),
        fallidos.length || dudosos ? "warn" : "ok");
    });
  }
})();
