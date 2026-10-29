const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "map-data.js",
  "ina.js",
  "efectores.js",
  "mapa.js",
  "firebase-config.js",
  "capas.js",
  "reglas.js",
  "motor.js",
  "tendencias.js",
  "envio.js",
  "cuota.js",
  "recepcion.js",
  "alertas.js",
  "pronostico.js",
  "rios.js",
  "viento.js",
  "precipitacion.js",
  "ayuda.js",
  "acceso.js",
  "usuarios-import.js",
  "padron.js",
  "prellenado.js",
  "confirmar.html",
];

fs.mkdirSync(dist, { recursive: true });
for (const file of files) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(dist, file));
}

// Cache-busting: agrega ?v=<version> a las referencias locales en index.html,
// para que el navegador siempre traiga la última versión tras cada deploy.
const v = Date.now().toString(36);
const idxPath = path.join(dist, "index.html");
if (fs.existsSync(idxPath)) {
  let html = fs.readFileSync(idxPath, "utf8");
  ["styles.css", "app.js", "map-data.js", "ina.js", "efectores.js", "mapa.js", "firebase-config.js", "capas.js", "reglas.js", "motor.js", "tendencias.js", "envio.js", "cuota.js", "recepcion.js", "alertas.js", "pronostico.js", "rios.js", "viento.js", "precipitacion.js", "ayuda.js", "acceso.js", "usuarios-import.js", "padron.js", "prellenado.js"]
    .forEach((f) => { html = html.split('"' + f + '"').join('"' + f + "?v=" + v + '"'); });
  fs.writeFileSync(idxPath, html);
}

// Copiar datos geográficos (GeoJSON) a dist/data/
const dataSrc = path.join(root, "data");
const dataDst = path.join(dist, "data");
if (fs.existsSync(dataSrc)) {
  fs.mkdirSync(dataDst, { recursive: true });
  for (const f of fs.readdirSync(dataSrc)) {
    if (/\.(geojson|json)$/i.test(f)) fs.copyFileSync(path.join(dataSrc, f), path.join(dataDst, f));
  }
}

// Copiar assets (logos, imágenes) a dist/assets/
const asSrc = path.join(root, "assets");
const asDst = path.join(dist, "assets");
if (fs.existsSync(asSrc)) {
  fs.mkdirSync(asDst, { recursive: true });
  for (const f of fs.readdirSync(asSrc)) {
    if (/\.(png|jpg|jpeg|svg|webp|ico)$/i.test(f)) fs.copyFileSync(path.join(asSrc, f), path.join(asDst, f));
  }
}

console.log(`Built ${files.length} frontend files into ${dist} (v=${v})`);
