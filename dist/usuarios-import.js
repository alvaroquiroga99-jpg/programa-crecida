/* Carga masiva de usuarios desde Excel (SheetJS). Escribe en el modelo de destinatarios
   vía window.CRECIDA_importarUsuarios. No inventa datos: valida jurisdicción y organismo. */
(function () {
  "use strict";
  var COLS = ["Responsable", "Email", "WhatsApp", "Función", "Jurisdicción", "Organismo"];

  function opciones(selId) {
    var sel = document.getElementById(selId);
    if (!sel) return [];
    return Array.from(sel.options).map(function (o) { return (o.value || o.textContent).trim(); }).filter(Boolean);
  }
  function norm(s) { return (s || "").toString().trim(); }
  function normLow(s) { return norm(s).toLowerCase(); }

  // Obligatorios = los que valida la app. "Función" queda opcional.
  var CAMPOS = [
    { h: "Responsable", req: true, w: 24 },
    { h: "Email", req: false, w: 26 },
    { h: "WhatsApp", req: true, w: 18 },
    { h: "Función", req: false, w: 22 },
    { h: "Jurisdicción", req: true, w: 20 },
    { h: "Organismo", req: true, w: 26 },
  ];

  async function plantilla() {
    if (!window.ExcelJS) { alert("No se pudo cargar el generador de Excel. Revisá tu conexión."); return; }
    var juris = opciones("recipientJurisdiction");
    var orgs = opciones("recipientOrganization");

    var wb = new ExcelJS.Workbook();
    wb.creator = "Programa CRECIDA";
    wb.created = new Date();

    // --- Hoja de referencia (fuente de las listas desplegables) ---
    var ref = wb.addWorksheet("Valores válidos");
    ref.getCell("A1").value = "Jurisdicciones válidas";
    ref.getCell("B1").value = "Organismos válidos";
    ref.getRow(1).font = { bold: true };
    juris.forEach(function (j, i) { ref.getCell("A" + (i + 2)).value = j; });
    orgs.forEach(function (o, i) { ref.getCell("B" + (i + 2)).value = o; });
    ref.getColumn(1).width = 26;
    ref.getColumn(2).width = 30;

    // --- Hoja principal ---
    var ws = wb.addWorksheet("Miembros");
    CAMPOS.forEach(function (c, i) {
      var cell = ws.getCell(1, i + 1);
      cell.value = c.h + (c.req ? " *" : "");
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.req ? "FF0E6E8C" : "FF64748B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getColumn(i + 1).width = c.w;
    });
    ws.getRow(1).height = 22;
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.getCell("A1").note =
      "Los campos con * son obligatorios: Responsable, Email, WhatsApp, Jurisdicción y Organismo. " +
      "Jurisdicción y Organismo se eligen de la lista desplegable (no escribir a mano).";

    // Fila de ejemplo
    ws.getRow(2).values = ["Juan Pérez", "juan@ejemplo.com", "3815123456", "Coordinador operativo", juris[0] || "", orgs[0] || ""];

    // --- Listas desplegables (validación de datos) en Jurisdicción (col E) y Organismo (col F) ---
    var jurFormula = "'Valores válidos'!$A$2:$A$" + (juris.length + 1);
    var orgFormula = "'Valores válidos'!$B$2:$B$" + (orgs.length + 1);
    for (var r = 2; r <= 501; r++) {
      ws.getCell("E" + r).dataValidation = {
        type: "list", allowBlank: false, formulae: [jurFormula],
        showErrorMessage: true, errorStyle: "error",
        errorTitle: "Jurisdicción no válida", error: "Elegí una jurisdicción de la lista desplegable.",
      };
      ws.getCell("F" + r).dataValidation = {
        type: "list", allowBlank: false, formulae: [orgFormula],
        showErrorMessage: true, errorStyle: "error",
        errorTitle: "Organismo no válido", error: "Elegí un organismo de la lista desplegable.",
      };
    }

    // --- Descargar ---
    var buf = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "plantilla-miembros-CRECIDA.xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function mostrarResultado(html, tipo) {
    var box = document.getElementById("bulkResult");
    if (!box) return;
    box.hidden = false;
    box.className = "bulk-result " + (tipo || "");
    box.innerHTML = html;
  }

  async function importar(file) {
    if (!window.XLSX) { alert("No se pudo cargar el lector de Excel."); return; }
    if (typeof window.CRECIDA_importarUsuarios !== "function") { alert("La app todavía no está lista. Esperá unos segundos."); return; }
    var jurisOk = opciones("recipientJurisdiction").map(normLow);
    var orgsOk = opciones("recipientOrganization").map(normLow);
    mostrarResultado("Procesando archivo…", "");
    try {
      var buf = await file.arrayBuffer();
      var wb = XLSX.read(buf, { type: "array" });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var filas = XLSX.utils.sheet_to_json(ws, { defval: "" });
      var validos = [], errores = [];
      filas.forEach(function (row, idx) {
        var name = norm(row["Responsable"] || row["responsable"] || row["Nombre"] || row["nombre"]);
        var email = norm(row["Email"] || row["email"] || row["Correo"]);
        var phone = norm(row["WhatsApp"] || row["Whatsapp"] || row["whatsapp"] || row["Teléfono"] || row["Telefono"] || row["telefono"]);
        var role = norm(row["Función"] || row["Funcion"] || row["funcion"] || row["Rol"] || row["rol"]);
        var jur = norm(row["Jurisdicción"] || row["Jurisdiccion"] || row["jurisdiccion"]);
        var org = norm(row["Organismo"] || row["organismo"]);
        var fila = idx + 2; // +1 encabezado, +1 base 1
        var falta = [];
        if (!name) falta.push("Responsable");
        if (!phone) falta.push("WhatsApp");
        if (!jur) falta.push("Jurisdicción");
        if (!org) falta.push("Organismo");
        if (falta.length) { errores.push("Fila " + fila + ": falta " + falta.join(", ")); return; }
        if (jurisOk.indexOf(jur.toLowerCase()) === -1) { errores.push("Fila " + fila + ": jurisdicción no válida (\"" + jur + "\")"); return; }
        if (orgsOk.indexOf(org.toLowerCase()) === -1) { errores.push("Fila " + fila + ": organismo no válido (\"" + org + "\")"); return; }
        validos.push({ name: name, email: email, phone: phone, role: role, jurisdiction: (opciones("recipientJurisdiction").find(function (o) { return String(o).toLowerCase() === jur.toLowerCase(); }) || jur), organization: org });
      });
      var res = { ok: 0, dup: 0 };
      if (validos.length) { res = (await window.CRECIDA_importarUsuarios(validos)) || res; }
      var html = "<strong>" + res.ok + "</strong> miembro(s) importado(s) como <em>Pendientes</em>.";
      if (res.dup) { html += " <span class='bulk-err-title'>" + res.dup + " ya existían (omitidos).</span>"; }
      if (errores.length) {
        html += "<br><span class='bulk-err-title'>" + errores.length + " con error (no cargadas):</span><ul>" +
          errores.slice(0, 12).map(function (e) { return "<li>" + e + "</li>"; }).join("") +
          (errores.length > 12 ? "<li>…y " + (errores.length - 12) + " más</li>" : "") + "</ul>";
      }
      mostrarResultado(html, errores.length ? "warn" : "ok");
    } catch (e) {
      mostrarResultado("No se pudo leer el archivo. Verificá que sea un Excel válido con las columnas de la plantilla.", "err");
    }
  }

  function init() {
    var tbtn = document.getElementById("bulkTemplateBtn");
    var file = document.getElementById("bulkFile");
    if (tbtn && !tbtn._w) { tbtn._w = true; tbtn.addEventListener("click", plantilla); }
    if (file && !file._w) {
      file._w = true;
      file.addEventListener("change", function () {
        if (file.files && file.files[0]) { importar(file.files[0]); file.value = ""; }
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  setTimeout(init, 1500);
})();
