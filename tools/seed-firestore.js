const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "programa-crecida";
const fs = require("fs");
const path = require("path");

const configPath = path.join(process.env.USERPROFILE, ".config", "configstore", "firebase-tools.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const token = config.tokens?.access_token;

if (!token) {
  throw new Error("No Firebase access token found. Run firebase login first.");
}

const now = new Date().toISOString();
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const sources = [
  ["stations", "Estaciones meteorologicas", "api.php?action=get_stations"],
  ["hidro", "Hidrometria y rios", "api.php?action=get_hidro"],
  ["rutas", "Rutas criticas", "api.php?action=get_rutas"],
  ["defensaCivil", "Defensa Civil", "api.php?action=get_defensa_civil"],
  ["inundaciones", "Inundaciones", "api.php?action=get_inundaciones"],
  ["bomberos", "Bomberos", "api.php?action=get_bomberos"],
  ["incendios", "Focos de incendio", "api.php?action=get_focos_incendio"],
  ["presas", "Presas", "api.php?action=get_presas"],
  ["timeline", "Timeline geovisor", "api.php?action=get_timeline"],
  ["rios", "Trazas de rios", "tucuman_rios.json"],
  ["salud", "Geolocalizacion sanitaria", "geolocalizacion.json"],
  ["boundary", "Limite Tucuman", "tucuman_boundary.json"],
];

function firestoreValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === null || value === undefined) return { nullValue: null };
  return { stringValue: String(value) };
}

function firestoreFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function setDoc(collection, id, data) {
  await request(`${baseUrl}/${collection}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: firestoreFields({
        ...data,
        updatedAt: now,
      }),
    }),
  });
}

async function addDoc(collection, data) {
  await request(`${baseUrl}/${collection}`, {
    method: "POST",
    body: JSON.stringify({
      fields: firestoreFields(data),
    }),
  });
}

async function main() {
  await setDoc("settings", "app", {
    name: "Programa CRECIDA",
    stage: "piloto_primario",
    province: "Tucuman",
    owner: "DGIME - Higiene y Seguridad",
    externalSourceBase: "https://www.dgime.site/Mapas",
  });

  await setDoc("users", "alvaro-quiroga", {
    displayName: "Alvaro Dario Quiroga",
    email: "alvaro_quiroga@outlook.com.ar",
    phone: "3815089935",
    role: "SUPER_ADMIN",
    organization: "Higiene y Seguridad de la DGIME",
    jurisdiction: "Capital",
    status: "active",
  });

  await setDoc("recipients", "alvaro-quiroga", {
    name: "Alvaro Dario Quiroga",
    email: "alvaro_quiroga@outlook.com.ar",
    phone: "3815089935",
    role: "Referente de Higiene y Seguridad de la DGIME",
    jurisdiction: "Capital",
    organization: "Higiene y Seguridad",
    channel: "WhatsApp",
    status: "Pendiente",
    last: "Carga inicial Firebase",
  });

  for (const [id, name, endpoint] of sources) {
    await setDoc("externalSources", id, {
      name,
      endpoint,
      enabled: true,
      cacheMinutes: 15,
      source: "DGIME geovisor de referencia",
    });
  }

  await addDoc("auditLog", {
    title: "Base inicial creada",
    detail: "Se cargaron usuario super admin, destinatario inicial y fuentes externas detectadas.",
    actor: "Firebase seed",
    createdAt: now,
  });

  console.log(`Seed completed for project ${projectId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
