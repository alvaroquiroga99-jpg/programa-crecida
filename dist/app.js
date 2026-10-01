const alertData = {
  id: "—",
  level: "Sin alerta",
  levelKey: "green",
  title: "Sin alerta activa",
  directive: "Monitoreo normal. Sin eventos hidrometeorológicos vigentes en la provincia.",
  zoneCompact: "—",
  source: "Monitoreo INA / SMN",
  sourceShort: "INA/SMN",
  issuedAt: "—",
  validUntil: "—",
  lastSync: "—",
  affected: [],
  message:
    "SIN ALERTA ACTIVA\n\nEl sistema está en monitoreo normal.\nCuando se cargue o confirme una alerta, el mensaje operativo aparecerá aquí, listo para distribuir a los responsables.",
};

const jurisdictions = [];

const defaultState = {
  risk: "green",
  response: "ok",
  contacts: 0,
  confirmed: 0,
  status: "Sin afectación",
  detail: "Sin afectación vigente. Mantiene datos territoriales disponibles para consulta.",
  critical: ["Sin puntos críticos cargados"],
  orgs: [],
};

const defaultExtraRecipients = [
  {
    name: "Alvaro Dario Quiroga",
    email: "alvaro_quiroga@outlook.com.ar",
    phone: "3815089935",
    role: "Referente de Higiene y Seguridad de la DGIME",
    jurisdiction: "Capital",
    organization: "Higiene y Seguridad",
    channel: "WhatsApp",
    status: "Pendiente",
    last: "Carga inicial",
  },
];

const storageKey = "crecida.extraRecipients";
const hidroApiUrl = "https://www.dgime.site/Mapas/api.php?action=get_hidro";
const tucumanBounds = {
  minLat: -28.05,
  maxLat: -26.05,
  minLon: -66.05,
  maxLon: -64.35,
};

let selectedJurisdiction = getJurisdiction("Capital");
let distributed = false;
let escalated = false;
let auditCounter = 0;
let extraRecipients = loadExtraRecipients();
let editingRecipientIndex = null;
let hidroStations = [];
let hidroLastSync = "Sin sincronizar";
let firebaseApp = null;
let firestoreDb = null;
let firebaseEnabled = false;

const labelOffsets = {
  Capital: [20, -6],
  "Cruz Alta": [22, -8],
  Famaillá: [22, -6],
  Leales: [22, -12],
  Lules: [-20, 20],
  Monteros: [22, 8],
  "Río Chico": [18, -16],
  Simoca: [20, 22],
  "Yerba Buena": [-20, -22],
};

const auditEvents = [];

const departmentData = window.TUCUMAN_DEPARTMENTS || [];
const provinceMap = document.getElementById("provinceMap");
const ackList = document.getElementById("ackList");
const pendingList = document.getElementById("pendingList");
const orgList = document.getElementById("orgList");
const criticalList = document.getElementById("criticalList");
const timeline = document.getElementById("timeline");
const recipientRows = document.getElementById("recipientRows");
const recipientForm = document.getElementById("recipientForm");
const recipientJurisdiction = document.getElementById("recipientJurisdiction");
const recipientSubmitButton = document.getElementById("recipientSubmitButton");
const cancelRecipientEditButton = document.getElementById("cancelRecipientEditButton");
const alertForm = document.getElementById("alertForm");
const manualAlertZones = document.getElementById("manualAlertZones");
const selectAllZonesButton = document.getElementById("selectAllZonesButton");
const clearZonesButton = document.getElementById("clearZonesButton");

function currentTime() {
  return new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isInsideTucumanBounds(item) {
  return (
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lon) &&
    item.lat >= tucumanBounds.minLat &&
    item.lat <= tucumanBounds.maxLat &&
    item.lon >= tucumanBounds.minLon &&
    item.lon <= tucumanBounds.maxLon
  );
}

function latLonToSvg(lat, lon) {
  const x = ((lon - tucumanBounds.minLon) / (tucumanBounds.maxLon - tucumanBounds.minLon)) * 460;
  const y = ((tucumanBounds.maxLat - lat) / (tucumanBounds.maxLat - tucumanBounds.minLat)) * 640;
  return [Math.max(0, Math.min(460, x)), Math.max(0, Math.min(640, y))];
}

async function syncHidroData({ silent = false } = {}) {
  try {
    const url = hidroApiUrl; // usa api.php directo (la Function /api no está desplegada)
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const data = Array.isArray(payload) ? payload : payload.data;
    if (!Array.isArray(data)) throw new Error("Formato hidro inválido");

    hidroStations = data
      .map((item) => ({
        nombre: item.nombre || item.rio || "Aforo sin nombre",
        rio: item.rio || "Río sin dato",
        tramo: item.tramo || "",
        altura_m: Number(item.altura_m),
        caudal_m3s: Number(item.caudal_estimado_m3s ?? item.caudal_m3s),
        tendencia: item.tendencia || "permanece",
        nivel_alerta: item.nivel_alerta || "Normal",
        fecha: item.fecha || "",
        lat: Number(item.lat),
        lon: Number(item.lon),
      }))
      .filter(isInsideTucumanBounds);

    hidroLastSync = `${currentTime()} h`;
    window.CRECIDA_LASTSYNC = hidroLastSync;
    if (!silent) {
      addAudit(
        "Hidrometría sincronizada",
        `Se actualizaron ${hidroStations.length} aforos INA visibles para Tucumán.`,
        "API DGIME / INA",
      );
    }
    render();
  } catch (error) {
    hidroLastSync = "Error de sincronización";
    if (!silent) {
      addAudit(
        "Error hidrometría",
        "No se pudo sincronizar la API INA/DGIME. Se mantiene la operación manual.",
        "API DGIME / INA",
      );
      render();
    }
  }
}

function getJurisdiction(name) {
  const configured = jurisdictions.find((item) => item.name === name);
  if (configured) return configured;

  if (alertData.affected.includes(name)) {
    return {
      ...defaultState,
      name,
      risk: alertData.levelKey,
      response: alertData.levelKey === "red" ? "escalate" : alertData.levelKey === "orange" ? "partial" : "watch",
      status: alertData.levelKey === "red" ? "Escalar" : alertData.level,
      detail: `${name} está incluida en la alerta ${alertData.level.toLowerCase()} activa. Falta cargar responsables operativos para esta jurisdicción.`,
      critical: ["Responsables locales pendientes de carga"],
    };
  }

  const auto = window.CRECIDA_RIESGO && window.CRECIDA_RIESGO[name];
  if (auto) {
    return {
      ...defaultState,
      name,
      risk: auto.levelKey,
      response: auto.levelKey === "red" ? "escalate" : "watch",
      status: auto.levelKey === "red" ? "Riesgo alto" : "Riesgo hidrológico",
      detail: `Riesgo hidrológico automático por monitoreo INA en vivo: ${auto.motivo}. Pendiente de confirmación operativa.`,
      critical: ["Según aforos en crecida monitoreados"],
    };
  }

  return { name, ...defaultState };
}

function responseClass(response) {
  return `state-${response}`;
}

function statusForOrg(status) {
  if (status === "Confirmado") return "ok";
  if (status === "Recibido") return "ok";
  if (status === "En seguimiento") return "watch";
  if (status === "Sin novedad") return "partial";
  if (status === "Requiere apoyo") return "escalate";
  if (status === "Sin confirmar") return "escalate";
  if (status === "Pendiente") return "partial";
  return "watch";
}

function isConfirmedStatus(status) {
  return ["Confirmado", "Recibido", "En seguimiento", "Sin novedad", "Requiere apoyo"].includes(status);
}

function loadExtraRecipients() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(saved) && saved.length ? saved : [...defaultExtraRecipients];
  } catch {
    return [...defaultExtraRecipients];
  }
}

function saveExtraRecipients() {
  localStorage.setItem(storageKey, JSON.stringify(extraRecipients));
  saveRecipientsToFirestore();
}

function initFirebase() {
  const config = window.CRECIDA_FIREBASE_CONFIG;
  if (!config || !window.firebase) return;

  try {
    firebaseApp = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
    firestoreDb = window.firebase.firestore(firebaseApp);
    firebaseEnabled = true;
  } catch (error) {
    firebaseEnabled = false;
  }
}

async function loadRecipientsFromFirestore() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    const snapshot = await firestoreDb.collection("recipients").orderBy("updatedAt", "desc").limit(250).get();
    const remoteRecipients = snapshot.docs.map((doc) => ({ firebaseId: doc.id, ...doc.data() }));
    if (remoteRecipients.length) {
      extraRecipients = remoteRecipients;
      localStorage.setItem(storageKey, JSON.stringify(extraRecipients));
      render();
    }
  } catch (error) {
    addAudit("Firestore no disponible", "La app continúa con almacenamiento local.", "Firebase");
  }
}

async function saveRecipientsToFirestore() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    const batch = firestoreDb.batch();
    extraRecipients.forEach((recipient) => {
      const docRef = recipient.firebaseId
        ? firestoreDb.collection("recipients").doc(recipient.firebaseId)
        : firestoreDb.collection("recipients").doc();
      recipient.firebaseId = docRef.id;
      batch.set(
        docRef,
        {
          ...recipient,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
    localStorage.setItem(storageKey, JSON.stringify(extraRecipients));
  } catch (error) {
    addAudit("Firestore no guardó", "Se conserva copia local de responsables.", "Firebase");
  }
}

function allRecipients() {
  const operationalRows = jurisdictions.flatMap((jurisdiction) =>
    jurisdiction.orgs.map((org) => ({
      id: "",
      editable: false,
      name: "Responsable designado",
      email: "",
      phone: "",
      role: org.name,
      jurisdiction: jurisdiction.name,
      organization: org.name,
      channel: org.channel,
      status: org.status,
      last: org.last,
      response: statusForOrg(org.status),
    })),
  );

  const extraRows = extraRecipients.map((recipient, index) => ({
    id: String(index),
    editable: true,
    ...recipient,
    response: statusForOrg(recipient.status),
  }));

  return [...extraRows, ...operationalRows];
}

function setupRecipientForm() {
  if (!recipientJurisdiction) return;
  recipientJurisdiction.innerHTML = "";
  departmentData
    .map((department) => department.name)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      recipientJurisdiction.appendChild(option);
    });
  recipientJurisdiction.value = "Capital";
}

function setupAlertForm() {
  if (!manualAlertZones) return;
  manualAlertZones.innerHTML = "";
  departmentData
    .map((department) => department.name)
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach((name) => {
      const label = document.createElement("label");
      label.className = "zone-option";
      label.innerHTML = `
        <input type="checkbox" name="zones" value="${name}" ${alertData.affected.includes(name) ? "checked" : ""} />
        <span class="zone-checkmark" aria-hidden="true"></span>
        <span>${name}</span>
      `;
      manualAlertZones.appendChild(label);
    });
}

function levelLabel(levelKey) {
  return {
    yellow: "Amarillo",
    orange: "Naranja",
    red: "Rojo",
  }[levelKey];
}

function directiveForLevel(levelKey, directive) {
  if (directive.trim()) return directive.trim();
  if (levelKey === "red") return "Emergencia operativa. Activar responsables y confirmar disponibilidad.";
  if (levelKey === "orange") return "Preparación activa. Confirmar recepción y verificar disponibilidad.";
  return "Vigilancia reforzada. Confirmar recepción y mantener monitoreo.";
}

function resetJurisdictionRisks(affected, levelKey) {
  jurisdictions.forEach((jurisdiction) => {
    const isAffected = affected.includes(jurisdiction.name);
    if (!isAffected) {
      jurisdiction.risk = "green";
      jurisdiction.response = jurisdiction.contacts - jurisdiction.confirmed > 0 ? "watch" : "ok";
      jurisdiction.status = "Sin afectación";
      return;
    }

    jurisdiction.risk = levelKey;
    if (levelKey === "red") {
      jurisdiction.response = "escalate";
      jurisdiction.status = "Escalar";
      jurisdiction.detail = "Alerta roja cargada manualmente. Requiere confirmación operativa prioritaria.";
    } else if (levelKey === "orange") {
      jurisdiction.response = jurisdiction.contacts === jurisdiction.confirmed ? "ok" : "partial";
      jurisdiction.status = jurisdiction.contacts === jurisdiction.confirmed ? "Confirmado" : "Parcial";
      jurisdiction.detail = "Alerta naranja cargada manualmente. Preparación activa y seguimiento de responsables.";
    } else {
      jurisdiction.response = "watch";
      jurisdiction.status = "Vigilancia";
      jurisdiction.detail = "Alerta amarilla cargada manualmente. Mantener vigilancia reforzada.";
    }
  });
}

function createAlertAreaPath(affected) {
  const affectedDepartments = departmentData.filter((department) => affected.includes(department.name));
  if (!affectedDepartments.length) return "";

  const xs = affectedDepartments.map((department) => department.centroid[0]);
  const ys = affectedDepartments.map((department) => department.centroid[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = Math.max(52, (maxX - minX) / 2 + 64);
  const radiusY = Math.max(54, (maxY - minY) / 2 + 72);

  return [
    `M ${centerX - radiusX} ${centerY}`,
    `C ${centerX - radiusX} ${centerY - radiusY * 0.58} ${centerX - radiusX * 0.58} ${centerY - radiusY} ${centerX} ${centerY - radiusY}`,
    `C ${centerX + radiusX * 0.58} ${centerY - radiusY} ${centerX + radiusX} ${centerY - radiusY * 0.58} ${centerX + radiusX} ${centerY}`,
    `C ${centerX + radiusX} ${centerY + radiusY * 0.58} ${centerX + radiusX * 0.58} ${centerY + radiusY} ${centerX} ${centerY + radiusY}`,
    `C ${centerX - radiusX * 0.58} ${centerY + radiusY} ${centerX - radiusX} ${centerY + radiusY * 0.58} ${centerX - radiusX} ${centerY}`,
    "Z",
  ].join(" ");
}

function deleteRecipient(index) {
  const recipient = extraRecipients[index];
  if (!recipient) return;

  extraRecipients.splice(index, 1);
  if (editingRecipientIndex === index) {
    cancelRecipientEdit();
  } else if (editingRecipientIndex !== null && editingRecipientIndex > index) {
    editingRecipientIndex -= 1;
  }
  saveExtraRecipients();
  addAudit(
    "Responsable eliminado",
    `${recipient.name} fue eliminado de ${recipient.organization} en ${recipient.jurisdiction}.`,
    "Carga operativa",
  );
  render();
}

function updateRecipientStatus(index, status) {
  const recipient = extraRecipients[index];
  if (!recipient) return;

  recipient.status = status;
  recipient.last = `${currentTime()} h`;
  saveExtraRecipients();
  addAudit(
    "Recepción actualizada",
    `${recipient.name} marcó estado "${status}" para ${recipient.organization} en ${recipient.jurisdiction}.`,
    recipient.name,
  );
  render();
}

function cancelRecipientEdit() {
  editingRecipientIndex = null;
  recipientForm.reset();
  recipientJurisdiction.value = "Capital";
  recipientSubmitButton.textContent = "Agregar responsable";
  cancelRecipientEditButton.hidden = true;
}

function editRecipient(index) {
  const recipient = extraRecipients[index];
  if (!recipient) return;

  editingRecipientIndex = index;
  recipientForm.elements.name.value = recipient.name;
  recipientForm.elements.email.value = recipient.email;
  recipientForm.elements.phone.value = recipient.phone;
  recipientForm.elements.role.value = recipient.role;
  recipientForm.elements.jurisdiction.value = recipient.jurisdiction;
  recipientForm.elements.organization.value = recipient.organization;
  recipientSubmitButton.textContent = "Guardar cambios";
  cancelRecipientEditButton.hidden = false;
  recipientForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function makeSvgElement(tag, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderAlert() {
  document.getElementById("alertId").textContent = alertData.id;
  document.getElementById("alertLevel").textContent = alertData.level;
  document.getElementById("alertTitle").textContent = alertData.title;
  document.getElementById("alertDirective").textContent = alertData.directive;
  document.getElementById("alertZoneCompact").textContent = alertData.zoneCompact;
  document.getElementById("issuedAt").textContent = alertData.issuedAt;
  document.getElementById("validUntil").textContent = alertData.validUntil;
  document.getElementById("lastSync").textContent = window.CRECIDA_LASTSYNC || alertData.lastSync;
  document.getElementById("sourceShort").textContent = alertData.sourceShort;
  document.getElementById("affectedCount").textContent = `${alertData.affected.length} afectadas`;
  document.getElementById("messageText").textContent = alertData.message;

  const pending = jurisdictions.reduce((sum, item) => sum + (item.contacts - item.confirmed), 0);
  document.getElementById("pendingCount").textContent = `${pending} responsables`;

  const badge = document.getElementById("alertLevel");
  badge.classList.toggle("severity-red", alertData.levelKey === "red");
  badge.classList.toggle("severity-orange", alertData.levelKey === "orange");
  badge.classList.toggle("severity-yellow", alertData.levelKey === "yellow");
}

function renderMap() {
  provinceMap.innerHTML = "";

  const svg = makeSvgElement("svg", {
    class: "tucuman-svg",
    viewBox: "0 0 460 640",
    role: "img",
    "aria-label": "Departamentos de Tucumán con severidad y confirmaciones",
  });

  const defs = makeSvgElement("defs");
  const pattern = makeSvgElement("pattern", {
    id: "alertHatch",
    width: "10",
    height: "10",
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(35)",
  });
  pattern.appendChild(makeSvgElement("rect", { width: "10", height: "10", fill: "rgba(215,107,47,0.18)" }));
  pattern.appendChild(
    makeSvgElement("line", {
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "10",
      stroke: "rgba(156,67,43,0.28)",
      "stroke-width": "4",
    }),
  );
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const departmentsGroup = makeSvgElement("g", { class: "department-layer" });
  departmentData.forEach((department) => {
    const jurisdiction = getJurisdiction(department.name);
    const path = makeSvgElement("path", {
      d: department.path,
      class: `department risk-${jurisdiction.risk}${selectedJurisdiction.name === department.name ? " selected" : ""}`,
      tabindex: "0",
      role: "button",
      "aria-label": `${department.name}. Riesgo ${jurisdiction.risk}. Estado ${jurisdiction.status}.`,
    });

    path.addEventListener("click", () => selectJurisdiction(department.name));
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectJurisdiction(department.name);
      }
    });

    departmentsGroup.appendChild(path);
  });
  svg.appendChild(departmentsGroup);

  const alertAreaPath = createAlertAreaPath(alertData.affected);
  if (alertAreaPath) {
    const alertArea = makeSvgElement("path", {
      class: `alert-area alert-area-${alertData.levelKey}`,
      d: alertAreaPath,
    });
    svg.appendChild(alertArea);
  }

  const hidroGroup = makeSvgElement("g", { class: "hydro-layer" });
  hidroStations.forEach((station) => {
    const [x, y] = latLonToSvg(station.lat, station.lon);
    const isCrecida = station.tendencia === "crece" || station.nivel_alerta.toLowerCase().includes("alerta");
    const marker = makeSvgElement("g", {
      class: `hydro-marker ${isCrecida ? "hydro-alert" : "hydro-normal"}`,
      transform: `translate(${x} ${y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${station.nombre}. ${station.nivel_alerta}. Altura ${station.altura_m || "--"} metros.`,
    });
    marker.appendChild(makeSvgElement("circle", { class: "hydro-pulse", r: "13" }));
    marker.appendChild(makeSvgElement("circle", { class: "hydro-core", r: "7" }));
    hidroGroup.appendChild(marker);
  });
  svg.appendChild(hidroGroup);

  const markersGroup = makeSvgElement("g", { class: "marker-layer" });
  departmentData.forEach((department) => {
    const jurisdiction = getJurisdiction(department.name);

    if (jurisdiction.risk === "green" && selectedJurisdiction.name !== department.name) {
      return;
    }

    const [x, y] = department.centroid;
    const marker = makeSvgElement("g", {
      class: `map-marker ${responseClass(jurisdiction.response)}`,
      transform: `translate(${x} ${y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${department.name}. ${jurisdiction.confirmed} de ${jurisdiction.contacts} confirmaciones.`,
    });
    marker.appendChild(makeSvgElement("circle", { class: "marker-hit", r: "24" }));
    marker.appendChild(makeSvgElement("circle", { class: "marker-core", r: "15" }));

    const text = makeSvgElement("text", { class: "marker-text", y: "1" });
    text.textContent = jurisdiction.contacts ? `${jurisdiction.confirmed}/${jurisdiction.contacts}` : "";
    marker.appendChild(text);

    marker.addEventListener("click", () => selectJurisdiction(department.name));
    marker.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectJurisdiction(department.name);
      }
    });

    markersGroup.appendChild(marker);

    const shouldLabel =
      jurisdiction.risk === "red" ||
      jurisdiction.risk === "orange" ||
      selectedJurisdiction.name === department.name;

    if (shouldLabel) {
      const [dx, dy] = labelOffsets[department.name] || [20, -18];
      const label = makeSvgElement("text", {
        class: "map-label",
        x: String(x + dx),
        y: String(y + dy),
        "text-anchor": dx < 0 ? "end" : "start",
      });
      label.textContent = department.name;
      markersGroup.appendChild(label);
    }
  });
  svg.appendChild(markersGroup);
  provinceMap.appendChild(svg);
}

function selectJurisdiction(name) {
  selectedJurisdiction = getJurisdiction(name);
  render();
}

function renderSelected() {
  document.getElementById("selectedName").textContent = selectedJurisdiction.name;
  document.getElementById("selectedDetail").textContent = selectedJurisdiction.detail;
  document.getElementById("selectedContacts").textContent = selectedJurisdiction.contacts;
  document.getElementById("selectedConfirmed").textContent = selectedJurisdiction.confirmed;
  document.getElementById("selectedPending").textContent = selectedJurisdiction.contacts - selectedJurisdiction.confirmed;

  const selectedStatus = document.getElementById("selectedStatus");
  selectedStatus.textContent = selectedJurisdiction.status;
  selectedStatus.className = `status-token ${responseClass(selectedJurisdiction.response)}`;

  orgList.innerHTML = "";
  selectedJurisdiction.orgs.forEach((org) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="list-main">
        <strong>${org.name}</strong>
        <span>${org.channel} - ${org.last}</span>
      </span>
      <span class="status-token ${responseClass(statusForOrg(org.status))}">${org.status}</span>
    `;
    orgList.appendChild(item);
  });

  criticalList.innerHTML = "";
  selectedJurisdiction.critical.forEach((name) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="list-main"><strong>${name}</strong><span>Validación territorial pendiente</span></span>`;
    criticalList.appendChild(item);
  });
}

function renderConfirmations() {
  const extraTotals = extraRecipients.reduce(
    (acc, item) => {
      acc.contacts += 1;
      if (isConfirmedStatus(item.status)) acc.confirmed += 1;
      if (item.status === "Requiere apoyo") acc.requiresSupport += 1;
      return acc;
    },
    { contacts: 0, confirmed: 0, requiresSupport: 0 },
  );
  const totals = extraTotals.contacts
    ? extraTotals
    : jurisdictions.reduce(
        (acc, item) => {
          acc.contacts += item.contacts;
          acc.confirmed += item.confirmed;
          return acc;
        },
        { contacts: 0, confirmed: 0, requiresSupport: 0 },
      );
  const percent = totals.contacts ? Math.round((totals.confirmed / totals.contacts) * 100) : 0;

  document.getElementById("ackSummary").textContent = `${totals.confirmed}/${totals.contacts}`;
  document.getElementById("ackProgress").style.width = `${percent}%`;

  ackList.innerHTML = "";
  const confirmationRows = extraRecipients.length
    ? extraRecipients.slice(0, 7).map((recipient) => ({
        name: recipient.name,
        meta: `${recipient.organization} / ${recipient.jurisdiction}`,
        response: statusForOrg(recipient.status),
        status: recipient.status,
      }))
    : jurisdictions.slice(0, 7).map((item) => ({
        name: item.name,
        meta: `${item.confirmed}/${item.contacts} confirmaciones`,
        response: item.response,
        status: item.status,
      }));

  confirmationRows.forEach((item) => {
    const row = document.createElement("li");
    row.innerHTML = `
      <span class="list-main">
        <strong>${item.name}</strong>
        <span>${item.meta}</span>
      </span>
      <span class="status-token ${responseClass(item.response)}">${item.status}</span>
    `;
    ackList.appendChild(row);
  });

  pendingList.innerHTML = "";
  const pendingRows = extraRecipients.length
    ? extraRecipients
        .filter((item) => !isConfirmedStatus(item.status) || item.status === "Requiere apoyo")
        .map((item) => ({
          name: item.name,
          meta: item.status === "Requiere apoyo" ? "Requiere apoyo operativo" : "Confirmación pendiente",
          response: statusForOrg(item.status),
          status: item.status,
        }))
    : jurisdictions
        .filter((item) => item.contacts - item.confirmed > 0)
        .sort((a, b) => b.contacts - b.confirmed - (a.contacts - a.confirmed))
        .slice(0, 5)
        .map((item) => {
          const pending = item.contacts - item.confirmed;
          return {
            name: item.name,
            meta: `Faltan ${pending} responsables`,
            response: item.response,
            status: item.status,
          };
        });

  pendingRows.slice(0, 5).forEach((item) => {
      const row = document.createElement("li");
      row.innerHTML = `
        <span class="list-main">
          <strong>${item.name}</strong>
          <span>${item.meta}</span>
        </span>
        <span class="status-token ${responseClass(item.response)}">${item.status}</span>
      `;
      pendingList.appendChild(row);
    });
}

function renderRecipients() {
  const rows = allRecipients();

  document.getElementById("recipientCount").textContent = `${rows.length} responsables`;
  recipientRows.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${row.name}</strong>
        <span class="table-subtext">${row.email || row.phone || "Sin datos cargados"}</span>
      </td>
      <td>${row.jurisdiction}</td>
      <td>${row.organization}</td>
      <td>${row.role}</td>
      <td>${row.channel}</td>
      <td><span class="status-token ${responseClass(row.response)}">${row.status}</span></td>
      <td>${row.last}</td>
      <td>
        ${
          row.editable
            ? `<div class="table-actions">
                <select class="status-select" data-status-recipient="${row.id}" aria-label="Estado de ${row.name}">
                  <option ${row.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
                  <option ${row.status === "Recibido" ? "selected" : ""}>Recibido</option>
                  <option ${row.status === "En seguimiento" ? "selected" : ""}>En seguimiento</option>
                  <option ${row.status === "Sin novedad" ? "selected" : ""}>Sin novedad</option>
                  <option ${row.status === "Requiere apoyo" ? "selected" : ""}>Requiere apoyo</option>
                </select>
                <button class="table-action edit-text-button" data-edit-recipient="${row.id}" type="button">Editar</button>
                <button class="table-action danger-text-button" data-delete-recipient="${row.id}" type="button">Eliminar</button>
              </div>`
            : `<span class="table-subtext">Base operativa</span>`
        }
      </td>
    `;
    recipientRows.appendChild(tr);
  });
}

function renderHydroContext() {
  const summary = document.getElementById("hydroSummary");
  const list = document.getElementById("hydroList");
  if (!summary || !list) return;

  const crecidas = hidroStations.filter(
    (item) => item.tendencia === "crece" || item.nivel_alerta.toLowerCase().includes("alerta"),
  );
  const maxHeight = hidroStations.reduce((max, item) => {
    if (!Number.isFinite(item.altura_m)) return max;
    return Math.max(max, item.altura_m);
  }, 0);

  summary.innerHTML = `
    <div>
      <span>Aforos visibles</span>
      <strong>${hidroStations.length}</strong>
    </div>
    <div>
      <span>En crecida</span>
      <strong>${crecidas.length}</strong>
    </div>
    <div>
      <span>Mayor altura</span>
      <strong>${maxHeight ? `${maxHeight.toFixed(2)} m` : "--"}</strong>
    </div>
    <div>
      <span>Sync</span>
      <strong>${hidroLastSync}</strong>
    </div>
  `;

  list.innerHTML = "";
  hidroStations
    .slice()
    .sort((a, b) => {
      const ar = a.tendencia === "crece" || a.nivel_alerta.toLowerCase().includes("alerta") ? 1 : 0;
      const br = b.tendencia === "crece" || b.nivel_alerta.toLowerCase().includes("alerta") ? 1 : 0;
      return br - ar || (b.altura_m || 0) - (a.altura_m || 0);
    })
    .slice(0, 6)
    .forEach((station) => {
      const isCrecida = station.tendencia === "crece" || station.nivel_alerta.toLowerCase().includes("alerta");
      const item = document.createElement("li");
      item.innerHTML = `
        <span class="list-main">
          <strong>${station.nombre}</strong>
          <span>${station.rio}${station.tramo ? ` / ${station.tramo}` : ""}</span>
        </span>
        <span class="status-token ${isCrecida ? "state-escalate" : "state-ok"}">
          ${Number.isFinite(station.altura_m) ? station.altura_m.toFixed(2) : "--"} m
        </span>
      `;
      list.appendChild(item);
    });
}

function renderTimeline() {
  timeline.innerHTML = "";
  auditEvents.forEach((event) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <time>${event.time}</time>
      <span><strong>${event.title}</strong>${event.detail}</span>
      <span>${event.actor}</span>
    `;
    timeline.appendChild(item);
  });
}

function addAudit(title, detail, actor = "Operador") {
  auditEvents.unshift({
    time: `${currentTime()} h`,
    title,
    detail,
    actor,
  });
  renderTimeline();
}

function renderActionState() {
  const distributeButton = document.getElementById("distributeButton");
  const escalateButton = document.getElementById("escalateButton");
  const actionNote = document.getElementById("actionNote");

  distributeButton.textContent = distributed ? "Alerta distribuida" : "Distribuir alerta";
  distributeButton.disabled = distributed;
  escalateButton.textContent = escalated ? "Escalamiento enviado" : "Escalar faltantes";
  escalateButton.disabled = escalated;

  if (escalated) {
    actionNote.textContent = "Defensa Civil provincial y 107 Central fueron notificados por falta de respuesta.";
  } else if (distributed) {
    actionNote.textContent = "Distribución registrada. El sistema espera confirmaciones y prepara escalamiento.";
  } else {
    actionNote.textContent = "WhatsApp individual + notificación de la app. Cada envío queda auditado.";
  }
}

function render() {
  renderAlert();
  renderMap();
  renderSelected();
  renderConfirmations();
  renderRecipients();
  renderHydroContext();
  renderTimeline();
  renderActionState();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((button) => button.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.view}View`).classList.add("active");
  });
});

document.getElementById("distributeButton").addEventListener("click", () => {
  if (distributed) return;
  distributed = true;
  alertData.lastSync = `${currentTime()} h`;
  addAudit(
    "Alerta distribuida",
    "WhatsApp y notificación de la app enviados a responsables de jurisdicciones afectadas.",
    "Operador provincial",
  );
  render();
});

document.getElementById("escalateButton").addEventListener("click", () => {
  if (escalated) return;
  escalated = true;
  alertData.lastSync = `${currentTime()} h`;
  addAudit(
    "Escalamiento enviado",
    "Defensa Civil provincial y 107 Central fueron notificados por falta de confirmación en Simoca.",
    "Monitor automático",
  );
  render();
});

document.getElementById("addAuditButton").addEventListener("click", () => {
  auditCounter += 1;
  addAudit(
    "Seguimiento manual",
    `El operador registró una novedad de seguimiento (${auditCounter}).`,
    "Sala de situación",
  );
});

recipientForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(recipientForm);
  const recipient = {
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    phone: formData.get("phone").trim(),
    role: formData.get("role").trim(),
    jurisdiction: formData.get("jurisdiction"),
    organization: formData.get("organization"),
    channel: "WhatsApp",
    status: "Pendiente",
    last: `${currentTime()} h`,
  };

  if (editingRecipientIndex === null) {
    extraRecipients.unshift(recipient);
    addAudit(
      "Responsable agregado",
      `${recipient.name} fue cargado como ${recipient.organization} en ${recipient.jurisdiction}.`,
      "Carga operativa",
    );
  } else {
    const previous = extraRecipients[editingRecipientIndex];
    extraRecipients[editingRecipientIndex] = {
      ...recipient,
      status: previous?.status || "Pendiente",
      last: `${currentTime()} h`,
    };
    addAudit(
      "Responsable editado",
      `${recipient.name} fue actualizado en ${recipient.organization} / ${recipient.jurisdiction}.`,
      "Carga operativa",
    );
  }

  saveExtraRecipients();
  cancelRecipientEdit();
  render();
});

recipientRows.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-recipient]");
  if (editButton) {
    editRecipient(Number(editButton.dataset.editRecipient));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-recipient]");
  if (!deleteButton) return;
  deleteRecipient(Number(deleteButton.dataset.deleteRecipient));
});

recipientRows.addEventListener("change", (event) => {
  const statusSelect = event.target.closest("[data-status-recipient]");
  if (!statusSelect) return;
  updateRecipientStatus(Number(statusSelect.dataset.statusRecipient), statusSelect.value);
});

cancelRecipientEditButton.addEventListener("click", cancelRecipientEdit);

selectAllZonesButton.addEventListener("click", () => {
  manualAlertZones.querySelectorAll('input[name="zones"]').forEach((input) => {
    input.checked = true;
  });
});

clearZonesButton.addEventListener("click", () => {
  manualAlertZones.querySelectorAll('input[name="zones"]').forEach((input) => {
    input.checked = false;
  });
});

alertForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(alertForm);
  const levelKey = formData.get("level");
  const title = formData.get("title").trim();
  const affected = formData.getAll("zones");
  const validUntil = formData.get("validUntil").trim();
  const directive = directiveForLevel(levelKey, formData.get("directive"));
  const now = currentTime();

  if (!affected.length) {
    addAudit("Alerta no creada", "La carga manual no tenía departamentos afectados seleccionados.", "Validación");
    return;
  }

  alertData.id = `MANUAL-TUC-${Date.now().toString().slice(-6)}`;
  alertData.level = levelLabel(levelKey);
  alertData.levelKey = levelKey;
  alertData.title = title;
  alertData.directive = directive;
  alertData.zoneCompact = affected.join(" / ");
  alertData.source = "Carga manual auditada";
  alertData.sourceShort = "Manual";
  alertData.issuedAt = `${now} h`;
  alertData.validUntil = validUntil;
  alertData.lastSync = `${now} h`;
  alertData.affected = affected;
  alertData.message = `${alertData.level.toUpperCase()} - ${title.toUpperCase()}\n\nFuente: carga manual auditada\nID: ${alertData.id}\n\nZona afectada: ${affected.join(" - ")}.\nVigencia: ${validUntil}.\n\nAcción: ${directive}\n\nCONFIRMAR RECEPCIÓN EN LA APP`;

  resetJurisdictionRisks(affected, levelKey);
  selectedJurisdiction = getJurisdiction(affected[0] || selectedJurisdiction.name);
  distributed = false;
  escalated = false;
  addAudit(
    "Alerta manual creada",
    `${alertData.level}: ${title}. Zonas: ${affected.join(", ")}.`,
    "Super admin / sala de situación",
  );
  render();
});

document.getElementById("simulateAlertButton").addEventListener("click", () => {
  alertData.id = "ACP-SMN-TUC-ROJO";
  alertData.level = "Rojo";
  alertData.levelKey = "red";
  alertData.title = "Lluvia intensa";
  alertData.directive = "Emergencia operativa en Simoca, Monteros y Leales.";
  alertData.zoneCompact = "Simoca / Monteros / Leales";
  alertData.validUntil = "Próximas 3 h";
  alertData.lastSync = `${currentTime()} h`;
  alertData.message =
    "ALERTA ROJA SIMULADA\n\nFuente: Servicio Meteorológico Nacional\nID: ACP-SMN-TUC-ROJO\n\nFenómeno: lluvia intensa con riesgo de anegamiento.\nZona afectada: Simoca - Monteros - Leales.\n\nAcción: activar responsables, confirmar recepción y reportar disponibilidad operativa.\n\nCONFIRMAR RECEPCIÓN EN LA APP";

  const leales = jurisdictions.find((item) => item.name === "Leales");
  if (leales) {
    leales.risk = "red";
    leales.response = "escalate";
    leales.status = "Escalar";
    leales.detail = "Alerta roja simulada. Falta confirmación de Defensa Civil local.";
  }

  addAudit("Alerta roja simulada", "Se activó un escenario de prueba para validar diseño y flujo.", "Modo demo");
  render();
});

document.getElementById("syncHidroButton").addEventListener("click", () => {
  syncHidroData();
});

setupRecipientForm();
setupAlertForm();
initFirebase();
render();
loadRecipientsFromFirestore();
syncHidroData({ silent: true });
