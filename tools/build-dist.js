const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "map-data.js",
  "firebase-config.js",
];

fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(dist, file));
  }
}

console.log(`Built ${files.length} frontend files into ${dist}`);
