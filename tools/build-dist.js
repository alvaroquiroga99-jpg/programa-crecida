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
  "envio.js",
  "recepcion.js",
  "alertas.js",
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
  ["styles.css", "app.js", "map-data.js", "ina.js", "efectores.js", "mapa.js", "firebase-config.js", "capas.js", "reglas.js", "motor.js", "envio.js", "recepcion.js", "alertas.js"]
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

console.log(`Built ${files.length} frontend files into ${dist} (v=${v})`);
