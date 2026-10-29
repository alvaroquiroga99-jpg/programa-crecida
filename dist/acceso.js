/* Flujo de acceso: DGIME (fondo azul oscuro) → login → logo CRECIDA → app.
   29/10: login REAL con Firebase Authentication (email + contraseña).
   - Las cuentas se crean en la consola de Firebase (Authentication → Usuarios). No hay contraseñas en el código.
   - Tras ingresar se recarga la página para que todos los datos se lean ya autenticados
     (necesario cuando las reglas de Firestore exigen login).
   - "Salir" cierra la sesión de Firebase. */
(function () {
  "use strict";

  function auth() {
    try { return window.firebase && window.firebase.auth ? window.firebase.auth() : null; } catch (e) { return null; }
  }

  function guardarSesion(email) {
    try {
      sessionStorage.setItem("crecida_in", "1");
      sessionStorage.setItem("crecida_user", email || "");
      sessionStorage.setItem("crecida_rol", "admin");
    } catch (e) {}
  }
  function borrarSesion() {
    try {
      sessionStorage.removeItem("crecida_in");
      sessionStorage.removeItem("crecida_rol");
      sessionStorage.removeItem("crecida_user");
    } catch (e) {}
  }

  // Botón "Salir" del header (se cablea siempre).
  function wireLogout() {
    var btn = document.getElementById("logoutButton");
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener("click", function () {
      borrarSesion();
      var a = auth();
      var fin = function () { location.reload(); };
      if (a) a.signOut().then(fin, fin); else fin();
    });
  }
  wireLogout();
  document.addEventListener("DOMContentLoaded", wireLogout);

  var ac = document.getElementById("acceso");
  if (!ac) return;
  var dg = document.getElementById("accDgime");
  var lg = document.getElementById("accLogin");
  var cr = document.getElementById("accCrecida");

  function show(el) {
    [dg, lg, cr].forEach(function (x) { if (x) x.classList.remove("on"); });
    if (el) el.classList.add("on");
  }
  function finish(rapido) {
    ac.classList.add("hide");
    setTimeout(function () { if (ac && ac.parentNode) ac.parentNode.removeChild(ac); }, rapido ? 50 : 650);
  }
  function mostrarLogin() {
    show(dg);
    setTimeout(function () {
      show(lg);
      var u = document.getElementById("accUser");
      if (u) { try { u.focus(); } catch (e) {} }
    }, 1600);
  }

  var a = auth();
  if (!a) {
    // Sin Firebase Auth no se puede ingresar: se informa en vez de dejar pasar.
    show(lg);
    var e0 = document.getElementById("accError");
    if (e0) e0.textContent = "No se pudo cargar el sistema de acceso. Revisá la conexión y recargá la página.";
    return;
  }

  // ¿Ya hay sesión de Firebase guardada en este navegador?
  var primera = true;
  a.onAuthStateChanged(function (user) {
    if (!primera) return;
    primera = false;
    if (user) {
      guardarSesion(user.email);
      finish(true);
    } else {
      borrarSesion();
      mostrarLogin();
    }
  });

  function mensajeError(code) {
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(code)) return "Usuario o contraseña incorrectos.";
    if (/too-many-requests/.test(code)) return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
    if (/network/.test(code)) return "Sin conexión. Revisá internet y volvé a intentar.";
    if (/user-disabled/.test(code)) return "Este usuario está deshabilitado.";
    if (/operation-not-allowed/.test(code)) return "El ingreso por email no está habilitado en Firebase (Authentication → Método de acceso).";
    return "No se pudo ingresar (" + code + ").";
  }

  lg.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("accError");
    var u = ((document.getElementById("accUser") || {}).value || "").trim();
    var p = (document.getElementById("accPass") || {}).value || "";
    var btn = lg.querySelector('button[type="submit"], button:not([type])');
    if (btn) btn.disabled = true;
    if (err) err.textContent = "";
    a.signInWithEmailAndPassword(u, p).then(function (cred) {
      guardarSesion(cred.user && cred.user.email);
      show(cr);
      // Recarga para que los datos se pidan ya con la sesión iniciada.
      setTimeout(function () { location.reload(); }, 1200);
    }).catch(function (ex) {
      if (btn) btn.disabled = false;
      if (err) err.textContent = mensajeError(String((ex && ex.code) || (ex && ex.message) || ex));
      var pf = document.getElementById("accPass"); if (pf) { pf.value = ""; pf.focus(); }
    });
  });
})();
