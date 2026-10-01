/**
 * Programa CRECIDA — Vigía (ingesta server-side hacia Firestore)
 * Obtiene el token del SMN con un navegador headless (pasa Cloudflare),
 * trae Avisos a Corto Plazo (ACP) + focos NASA FIRMS, y los guarda en Firestore.
 *
 * Secrets (GitHub Actions):
 *   FIREBASE_SERVICE_ACCOUNT : JSON de la cuenta de servicio
 *   NASA_MAP_KEY             : MAP_KEY gratuita de NASA FIRMS
 */
const admin = require("firebase-admin");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

const TUC = { oeste: -66.1, sur: -28.1, este: -64.3, norte: -26.0 };

// ── Token del SMN con navegador real (pasa Cloudflare) ────────────────
async function tokenSMN() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    await page.goto("https://www.smn.gob.ar/alertas", { waitUntil: "domcontentloaded", timeout: 60000 });
    // Dar tiempo a que Cloudflare resuelva el desafío y la página real cargue
    for (let i = 0; i < 30; i++) {
      const t = await page.evaluate(() => localStorage.getItem("token"));
      if (t) return t;
      await page.waitForTimeout(2000);
    }
    throw new Error("token no apareció (posible bloqueo Cloudflare)");
  } finally {
    await browser.close();
  }
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

async function correr() {
  const resumen = { ts: new Date().toISOString() };

  try {
    const token = await tokenSMN();
    const acp = await traerACP(token);
    await db.collection("smn").doc("acp").set({
      ...acp,
      actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
    });
    resumen.acp = `${acp.tucuman.length} en Tucumán (${acp.total_pais} país)`;
  } catch (e) {
    resumen.acp = "ERROR: " + e.message;
  }

  try {
    const f = await traerFIRMS();
    if (!f.skip) {
      await db.collection("capas").doc("focos").set({
        items: f.focos,
        total: f.focos.length,
        origen: "NASA FIRMS",
        actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
      });
      resumen.focos = `${f.focos.length} focos`;
    } else resumen.focos = f.skip;
  } catch (e) {
    resumen.focos = "ERROR: " + e.message;
  }

  await db.collection("sistema").doc("vigia").set(resumen, { merge: true });
  console.log("Vigía CRECIDA:", JSON.stringify(resumen, null, 2));
}

correr().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
