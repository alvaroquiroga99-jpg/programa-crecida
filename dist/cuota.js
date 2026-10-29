/* Programa CRECIDA — Contador de cuota diaria de email.
   El envío usa Apps Script, que manda con Gmail. En cuenta @gmail el tope es
   ~100 destinatarios por día. Este módulo lleva la cuenta (en Firestore, así
   se comparte entre dispositivos) de cuántos correos se pidieron enviar hoy,
   y avisa en el panel cuando te acercás al límite. Es un estimado del lado de
   la app: cuenta lo que la app le pidió a Apps Script despachar. */
(function () {
  "use strict";
  var LIMITE = 100;       // tope diario de la cuenta @gmail
  var CERCA = 80;         // a partir de acá, aviso amarillo
  var COL = "cuota";
  var cache = { key: null, enviados: 0 };
  var unsub = null;

  function db() {
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length && window.firebase.firestore) {
        return window.firebase.firestore();
      }
    } catch (e) {}
    return null;
  }

  // Fecha local de Argentina (YYYY-MM-DD), para que el "día" coincida con el reloj local.
  function hoyKey() {
    var ymd;
    try { ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); }
    catch (e) { ymd = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }
    return "email_" + ymd;
  }

  function ref() {
    var d = db(); if (!d) return null;
    return d.collection(COL).doc(hoyKey());
  }

  function estado() {
    return { enviados: cache.enviados | 0, limite: LIMITE, restantes: Math.max(0, LIMITE - (cache.enviados | 0)), key: cache.key };
  }

  function render() {
    var badge = document.getElementById("cuotaBadge");
    if (!badge) return;
    var n = cache.enviados | 0;
    var numEl = document.getElementById("cuotaNum");
    var noteEl = document.getElementById("cuotaNote");
    if (numEl) numEl.textContent = String(n);
    badge.classList.remove("is-warn", "is-full");
    var nota = "";
    if (n >= LIMITE) { badge.classList.add("is-full"); nota = "Límite diario alcanzado — pueden no enviarse"; }
    else if (n >= CERCA) { badge.classList.add("is-warn"); var lib = LIMITE - n; nota = "Cerca del tope diario (" + lib + (lib === 1 ? " libre)" : " libres)"); }
    else { nota = (LIMITE - n) + " disponibles hoy"; }
    if (noteEl) noteEl.textContent = nota;
    badge.setAttribute("title", "Correos enviados hoy: " + n + " de " + LIMITE +
      " (cuenta @gmail vía Apps Script). " + nota + ".");
  }

  function suscribir() {
    var r = ref();
    cache.key = hoyKey();
    if (!r) { render(); return false; }
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    try {
      unsub = r.onSnapshot(function (snap) {
        var d = snap && snap.exists ? snap.data() : null;
        cache.enviados = (d && typeof d.enviados === "number") ? d.enviados : 0;
        cache.key = hoyKey();
        render();
      }, function () { render(); });
      return true;
    } catch (e) { render(); return false; }
  }

  // Suma n correos al contador del día. Devuelve el total estimado luego de sumar.
  async function sumar(n) {
    n = Math.max(0, n | 0);
    cache.enviados = (cache.enviados | 0) + n; // optimista
    render();
    if (!n) return estado();
    var r = ref();
    if (!r || !window.firebase || !window.firebase.firestore) return estado();
    try {
      await r.set({
        enviados: window.firebase.firestore.FieldValue.increment(n),
        fecha: hoyKey(),
        actualizado: window.firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {}
    return estado();
  }

  // Esperar a que Firebase esté listo y arrancar la suscripción. Reintenta por si
  // app.js todavía no inicializó la app al cargar este script.
  function arrancar(intentos) {
    intentos = intentos == null ? 20 : intentos;
    if (db()) { suscribir(); return; }
    if (intentos <= 0) { render(); return; }
    setTimeout(function () { arrancar(intentos - 1); }, 300);
  }

  // Si cambia el día con la pestaña abierta, re-suscribir al nuevo bucket.
  setInterval(function () { if (cache.key !== hoyKey()) suscribir(); }, 60 * 1000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { arrancar(); });
  } else { arrancar(); }

  window.CRECIDA_cuota = {
    LIMITE: LIMITE,
    estado: estado,
    sumar: sumar,
    faltan: function () { return estado().restantes; },
    hoyKey: hoyKey,
  };
})();
