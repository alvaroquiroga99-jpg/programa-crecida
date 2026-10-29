// Programa CRECIDA - Envio de correos con verificacion de quien pide el envio (29/10)
// Copia de referencia del codigo publicado en Apps Script (casilla secciondehysdgime@gmail.com).
// Si se modifica alla, actualizar esta copia.
var FIREBASE_API_KEY = "AIzaSyDhoyjhIZf8XDqHC8LER6aYOTRRCNI5zDA";
var OPERADORES = ["alvaro.quiroga99@gmail.com"];
var MAX_DESTINATARIOS_POR_PEDIDO = 5;
// La clave vieja quedo desactivada el 29/10: solo se acepta la sesion de Firebase.
var ACEPTAR_CLAVE_VIEJA = false;
var CLAVE_VIEJA = "";

function emailDelToken_(idToken) {
  if (!idToken) return null;
  try {
    var r = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return null;
    var u = (JSON.parse(r.getContentText()).users || [])[0];
    return u && u.email ? String(u.email).toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || "{}");
    var email = emailDelToken_(d.idToken);
    var autorizado = (email && OPERADORES.indexOf(email) !== -1) ||
                     (ACEPTAR_CLAVE_VIEJA && CLAVE_VIEJA && d.clave === CLAVE_VIEJA);
    if (!autorizado) return respuesta_({ ok: false, error: "no_autorizado" });

    var dest = (d.destinatarios || []).filter(function (x) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x));
    });
    if (!dest.length) return respuesta_({ ok: false, error: "sin_destinatarios" });
    if (dest.length > MAX_DESTINATARIOS_POR_PEDIDO) return respuesta_({ ok: false, error: "demasiados_destinatarios" });
    if (MailApp.getRemainingDailyQuota() < dest.length) return respuesta_({ ok: false, error: "sin_cupo" });

    dest.forEach(function (to) {
      MailApp.sendEmail({
        to: to,
        subject: String(d.asunto || "Programa CRECIDA").slice(0, 200),
        body: String(d.cuerpo || ""),
        htmlBody: d.html ? String(d.html) : undefined,
        name: "Programa CRECIDA"
      });
    });
    return respuesta_({ ok: true, enviados: dest.length, cupoRestante: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err) });
  }
}

// Ejecutar UNA vez desde el editor para dar los permisos
function autorizar() {
  UrlFetchApp.fetch("https://www.google.com");
  Logger.log("Cupo de correos hoy: " + MailApp.getRemainingDailyQuota());
}
