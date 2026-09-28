const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

admin.initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

const SOURCE_BASE = "https://www.dgime.site/Mapas";
const CACHE_TTL_MS = 15 * 60 * 1000;

const SOURCES = {
  stations: { remote: `${SOURCE_BASE}/api.php?action=get_stations`, fallback: `${SOURCE_BASE}/estaciones_data.json` },
  hidro: { remote: `${SOURCE_BASE}/api.php?action=get_hidro`, fallback: `${SOURCE_BASE}/hidro_ina.json` },
  rutas: { remote: `${SOURCE_BASE}/api.php?action=get_rutas`, fallback: `${SOURCE_BASE}/modulos/rutas_criticas.json` },
  defensaCivil: { remote: `${SOURCE_BASE}/api.php?action=get_defensa_civil`, fallback: `${SOURCE_BASE}/modulos/defensa_civil.json` },
  inundaciones: { remote: `${SOURCE_BASE}/api.php?action=get_inundaciones`, fallback: `${SOURCE_BASE}/modulos/inundaciones.json` },
  bomberos: { remote: `${SOURCE_BASE}/api.php?action=get_bomberos`, fallback: `${SOURCE_BASE}/modulos/bomberos.json` },
  incendios: { remote: `${SOURCE_BASE}/api.php?action=get_focos_incendio`, fallback: `${SOURCE_BASE}/modulos/focos_incendio.json` },
  presas: { remote: `${SOURCE_BASE}/api.php?action=get_presas`, fallback: `${SOURCE_BASE}/modulos/presas_tucuman.json` },
  timeline: { remote: `${SOURCE_BASE}/api.php?action=get_timeline`, fallback: null },
  rios: { remote: `${SOURCE_BASE}/tucuman_rios.json`, fallback: null },
  salud: { remote: `${SOURCE_BASE}/geolocalizacion.json`, fallback: null },
  boundary: { remote: `${SOURCE_BASE}/tucuman_boundary.json`, fallback: null },
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "accept": "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadSource(sourceKey, force = false) {
  const source = SOURCES[sourceKey];
  if (!source) {
    const error = new Error("Unknown source");
    error.statusCode = 404;
    throw error;
  }

  const cacheRef = admin.firestore().collection("externalCache").doc(sourceKey);
  const cached = await cacheRef.get();
  const now = Date.now();

  if (!force && cached.exists) {
    const value = cached.data();
    const updatedAt = value.updatedAt?.toMillis?.() || 0;
    if (now - updatedAt < CACHE_TTL_MS) {
      return { source: sourceKey, cached: true, updatedAt, data: value.data };
    }
  }

  let data;
  let usedUrl = source.remote;
  try {
    data = await fetchJson(source.remote);
  } catch (remoteError) {
    if (!source.fallback) throw remoteError;
    usedUrl = source.fallback;
    data = await fetchJson(source.fallback);
  }

  await cacheRef.set({
    data,
    sourceUrl: usedUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { source: sourceKey, cached: false, sourceUrl: usedUrl, data };
}

exports.api = onRequest({ cors: true }, async (req, res) => {
  try {
    const sourceKey = String(req.path || "").replace(/^\/+/, "").split("/")[0] || String(req.query.source || "");
    const force = req.query.force === "1" || req.query.force === "true";
    const result = await loadSource(sourceKey, force);
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Unable to load source",
    });
  }
});
