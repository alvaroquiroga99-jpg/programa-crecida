/**
 * Programa CRECIDA — Vigía (ingesta server-side hacia Firestore)
 * Token del SMN vía FlareSolverr (pasa Cloudflare) + ACP + focos NASA FIRMS.
 * Secrets: FIREBASE_SERVICE_ACCOUNT, NASA_MAP_KEY. Servicio: FLARESOLVERR_URL.
 */
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

const TUC = { oeste: -66.1, sur: -28.1, este: -64.3, norte: -26.0 };

async function tokenSMN() {
  const FS = process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";
  let html = null;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await fetch(FS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "request.get", url: "https://www.smn.gob.ar/alertas", maxTimeout: 60000 }),
      });
      const j = await r.json();
      if (j && j.solution && j.solution.response) { html = j.solution.response; break; }
    } catch (e) { /* FlareSolverr todavía no está listo */ }
    await new Promise((res) => setTimeout(res, 5000));
  }
  if (!html) throw new Error("FlareSolverr no respondió");
  const m = html.match(/setItem\(['"]token['"]\s*,\s*['"]([^'"]+)['"]\)/);
  if (!m) throw new Error("token no está en el HTML resuelto por FlareSolverr");
  return m[1];
}

async function traerACP(token) {
  const res = await fetch("https://ws1.smn.gob.ar/v1/warning/shortterm/", {
    headers: { Authorization: "JWT " + token },
  });
  if (!res.ok) throw new Error("SMN shortterm HTTP " + res.status);
  const data = await res.json();
  const esTuc = (o) => JSON.stringify(o).toLowerCase().includes("tucum");
  const tuc = Array.isArray(data) ? data.filter(esTuc) : [];
  return { total_pais: Array.isArray(data) ? data.length : 0, tucuman: tuc };
}

async function traerFIRMS() {
  const key = process.env.NASA_MAP_KEY;
  if (!key) return { skip: "sin NASA_MAP_KEY" };
  const area = `${TUC.oeste},${TUC.sur},${TUC.este},${TUC.norte}`;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${area}/1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("FIRMS HTTP " + res.status);
  const csv = await res.text();
  const lineas = csv.trim().split("\n");
  if (lineas.length < 2) return { focos: [] };
  const cols = lineas[0].split(",");
  const idx = (n) => cols.indexOf(n);
  const focos = lineas.slice(1).map((l) => {
    const c = l.split(",");
    return {
      latitude: Number(c[idx("latitude")]),
      longitude: Number(c[idx("longitude")]),
      detection_date: c[idx("acq_date")],
      detection_time: c[idx("acq_time")],
      confidence: c[idx("confidence")],
      frp_mw: Number(c[idx("frp")]),
      satellite: c[idx("satellite")] || "VIIRS",
      fuente: "NASA FIRMS VIIRS (NRT, 24h)",
    };
  });
  return { focos };
}

async function traerOSM() {
  const S = TUC.sur, W = TUC.oeste, N = TUC.norte, E = TUC.este;
  const q = `[out:json][timeout:180];(` +
    `nwr["amenity"="fire_station"](${S},${W},${N},${E});` +
    `nwr["amenity"="police"](${S},${W},${N},${E});` +
    `nwr["amenity"="hospital"](${S},${W},${N},${E});` +
    `nwr["amenity"="clinic"](${S},${W},${N},${E});` +
    `nwr["amenity"="pharmacy"](${S},${W},${N},${E});` +
    `nwr["amenity"="school"](${S},${W},${N},${E});` +
    `);out tags center;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  let data = null, lastErr = null;
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) });
      if (!r.ok) { lastErr = "HTTP " + r.status + " @ " + ep; continue; }
      data = await r.json(); break;
    } catch (e) { lastErr = String(e); }
  }
  if (!data) throw new Error("Overpass sin respuesta: " + lastErr);

  const mapCat = { fire_station: "bomberos", police: "policia", hospital: "salud", clinic: "salud", pharmacy: "farmacias", school: "escuelas" };
  const nombreDefault = { bomberos: "Cuartel de bomberos", policia: "Comisaría / Policía", salud: "Centro de salud", farmacias: "Farmacia", escuelas: "Escuela" };
  const buckets = { bomberos: [], policia: [], salud: [], farmacias: [], escuelas: [] };
  for (const el of (data.elements || [])) {
    const t = el.tags || {};
    const cat = mapCat[t.amenity];
    if (!cat) continue;
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lon = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (lat == null || lon == null) continue;
    buckets[cat].push({
      nombre: t.name || t["name:es"] || nombreDefault[cat],
      lat: Number(lat), lon: Number(lon),
      tipo: t.amenity,
      telefono: t.phone || t["contact:phone"] || "",
      direccion: [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "),
      localidad: t["addr:city"] || "",
    });
  }
  return buckets;
}

async function correr() {
  const resumen = { ts: new Date().toISOString() };
  try {
    const token = await tokenSMN();
    const acp = await traerACP(token);
    await db.collection("smn").doc("acp").set({
      ...acp, actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
    });
    resumen.acp = `${acp.tucuman.length} en Tucumán (${acp.total_pais} país)`;
  } catch (e) { resumen.acp = "ERROR: " + e.message; }

  try {
    const f = await traerFIRMS();
    if (!f.skip) {
      await db.collection("capas").doc("focos").set({
        items: f.focos, total: f.focos.length, origen: "NASA FIRMS",
        actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
      });
      resumen.focos = `${f.focos.length} focos`;
    } else resumen.focos = f.skip;
  } catch (e) { resumen.focos = "ERROR: " + e.message; }

  try {
    const osm = await traerOSM();
    for (const [cat, items] of Object.entries(osm)) {
      await db.collection("capas").doc("osm_" + cat).set({
        items, total: items.length, origen: "OpenStreetMap",
        actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    resumen.osm = Object.entries(osm).map(([k, v]) => `${k}:${v.length}`).join(" ");
  } catch (e) { resumen.osm = "ERROR: " + e.message; }

  await db.collection("sistema").doc("vigia").set(resumen, { merge: true });
  console.log("Vigía CRECIDA:", JSON.stringify(resumen, null, 2));
}

correr().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
