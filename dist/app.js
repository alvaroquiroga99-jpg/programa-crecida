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

// Copia del estado "sin alerta" para poder volver a reposo al cerrar una alerta.
const ALERTA_REPOSO = JSON.parse(JSON.stringify(alertData));

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
    email: "alvaro_quiroga@outlook.com",
    phone: "3815089935",
    role: "Referente de Higiene y Seguridad de la DGIME",
    jurisdiction: "Capital",
    organization: "Higiene y Seguridad",
    channel: "WhatsApp",
    status: "Pendiente",
    estadoAlta: "Activo",
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
    // Fuente oficial INA (SIyAH), directo y en vivo. Reemplaza al api.php de DGIME.
    const data = await window.CRECIDA_fetchINA();
    if (!Array.isArray(data)) throw new Error("Formato hidro inválido");

    hidroStations = data
      .map((item) => ({
        nombre: item.nombre || item.rio || "Aforo sin nombre",
        rio: item.rio || "Río sin dato",
        tramo: item.tramo || "",
        altura_m: Number(item.altura_m),
        precedente: Number(item.valor_precedente),
        departamento: item.departamento || "",
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
        "INA · SIyAH",
      );
    }
    render();
  } catch (error) {
    hidroLastSync = "Error de sincronización";
    if (!silent) {
      addAudit(
        "Error hidrometría",
        "No se pudo sincronizar con el INA (SIyAH). Se mantiene la operación manual.",
        "INA · SIyAH",
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

let _destSeeded = false;
function loadRecipientsFromFirestore() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    firestoreDb.collection("destinatarios").onSnapshot(
      (snapshot) => {
        if (snapshot.empty) {
          if (!_destSeeded) { _destSeeded = true; saveRecipientsToFirestore(); }
          return;
        }
        _destSeeded = true;
        extraRecipients = snapshot.docs.map((doc) => ({ firebaseId: doc.id, ...doc.data() }));
        localStorage.setItem(storageKey, JSON.stringify(extraRecipients));
        render();
      },
      () => {},
    );
  } catch (error) {}
}

async function saveRecipientsToFirestore() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    const batch = firestoreDb.batch();
    extraRecipients.forEach((recipient) => {
      const docRef = recipient.firebaseId
        ? firestoreDb.collection("destinatarios").doc(recipient.firebaseId)
        : firestoreDb.collection("destinatarios").doc();
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
    /* fallback: queda copia local */
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
    estadoAlta: recipient.estadoAlta || "Activo",
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

  if (recipient.firebaseId && firebaseEnabled && firestoreDb) {
    firestoreDb.collection("destinatarios").doc(recipient.firebaseId).delete().catch(() => {});
  }
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

function approveRecipient(index) {
  const recipient = extraRecipients[index];
  if (!recipient) return;
  recipient.estadoAlta = "Activo";
  recipient.last = `${currentTime()} h`;
  saveExtraRecipients();
  addAudit("Usuario aprobado", `${recipient.name} (${recipient.jurisdiction}) quedó ACTIVO para recibir alertas.`, "Alta de usuarios");
  render();
}

function approveAllRecipients() {
  const pendientes = extraRecipients.filter((r) => (r.estadoAlta || "Activo") !== "Activo");
  if (!pendientes.length) return;
  if (typeof window.confirm === "function" &&
      !window.confirm(`¿Aprobar ${pendientes.length} usuario(s) pendiente(s)? Van a quedar ACTIVOS para recibir alertas.`)) {
    return;
  }
  const hora = `${currentTime()} h`;
  pendientes.forEach((r) => { r.estadoAlta = "Activo"; r.last = hora; });
  saveExtraRecipients();
  addAudit("Usuarios aprobados", `Se aprobaron ${pendientes.length} usuario(s) de una vez; quedaron ACTIVOS para recibir alertas.`, "Alta de usuarios");
  if (window.showToast) window.showToast(`✓ ${pendientes.length} usuario(s) aprobado(s).`);
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

function _esc(t) {
  return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderAlert() {
  const mon = window.CRECIDA_MONITOREO || { hayAlgo: false, jurisdicciones: [], cantidad: 0 };
  const operativa = alertData.level && alertData.level !== "Sin alerta";

  let v;
  if (operativa) {
    v = { id: alertData.id, levelText: alertData.level, levelKey: alertData.levelKey, title: alertData.title, directive: alertData.directive, zoneCompact: alertData.zoneCompact };
  } else if (mon.hayAlgo) {
    v = {
      id: "—", levelText: "Vigilancia", levelKey: mon.nivelKey,
      title: mon.titulo || "Vigilancia",
      directive: "Avisos meteorológicos/hidrológicos vigentes. No hay alerta operativa cargada: revisá las jurisdicciones involucradas y, si corresponde, cargá y distribuí una alerta.",
      zoneCompact: "—",
    };
  } else {
    v = { id: alertData.id, levelText: alertData.level, levelKey: alertData.levelKey, title: alertData.title, directive: alertData.directive, zoneCompact: alertData.zoneCompact };
  }

  document.getElementById("alertId").textContent = v.id;
  document.getElementById("alertLevel").textContent = v.levelText;
  document.getElementById("alertTitle").textContent = v.title;
  document.getElementById("alertDirective").textContent = v.directive;
  document.getElementById("alertZoneCompact").textContent = v.zoneCompact;
  document.getElementById("issuedAt").textContent = alertData.issuedAt;
  document.getElementById("validUntil").textContent = alertData.validUntil;
  document.getElementById("lastSync").textContent = window.CRECIDA_LASTSYNC || alertData.lastSync;
  const _src = document.getElementById("sourceShort");
  if (_src) _src.textContent = alertData.sourceShort;
  document.getElementById("affectedCount").textContent = operativa
    ? `${alertData.affected.length} afectadas`
    : (mon.hayAlgo ? `${mon.cantidad} involucradas` : "0 afectadas");
  document.getElementById("messageText").textContent = alertData.message;


  const badge = document.getElementById("alertLevel");
  badge.classList.toggle("severity-red", v.levelKey === "red");
  badge.classList.toggle("severity-orange", v.levelKey === "orange");
  badge.classList.toggle("severity-yellow", v.levelKey === "yellow");

  renderJurisInvolucradas(operativa, mon);
}

function renderJurisInvolucradas(operativa, mon) {
  const sec = document.getElementById("jurisInvolucradas");
  const list = document.getElementById("jurisList");
  const count = document.getElementById("jurisCount");
  if (!sec || !list) return;
  const dot = (k) => (k === "red" ? "#dc2626" : k === "orange" ? "#f59e0b" : "#eab308");

  let items = [];
  if (operativa) {
    items = (alertData.affected || []).map((n) => ({ nombre: n, meteo: [], hidro: [] }));
  } else if (mon.hayAlgo) {
    items = mon.jurisdicciones || [];
  }

  if (!items.length) { sec.hidden = true; list.innerHTML = ""; if (count) count.textContent = "0"; return; }
  sec.hidden = false;
  if (count) count.textContent = String(items.length);

  list.innerHTML = items.map((j) => {
    const chips = [];
    (j.meteo || []).forEach((m) => {
      chips.push(`<span class="jc"><span class="jc-dot" style="background:${dot(m.key)}"></span>🌧️ ${_esc(m.tipo)}</span>`);
    });
    (j.hidro || []).forEach((h) => {
      chips.push(`<span class="jc"><span class="jc-dot" style="background:${dot(h.key)}"></span>🌊 Crecida ${_esc(h.rio)}</span>`);
    });
    const causas = chips.length ? `<span class="juris-causas">${chips.join("")}</span>` : "";
    return `<li class="juris-item"><span class="juris-name">${_esc(j.nombre)}</span>${causas}</li>`;
  }).join("");
}

function renderMap() {
  // El mapa ahora es Leaflet (ver mapa.js). Solo recoloreamos por riesgo.
  if (window.CRECIDA_MAPA) window.CRECIDA_MAPA.recolorear();
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

  const _ackActiva = alertData.id && alertData.id !== "\u2014" && alertData.level !== "Sin alerta";
  const _ackSum = document.getElementById("ackSummary");
  if (_ackSum) _ackSum.textContent = _ackActiva ? `${totals.confirmed}/${totals.contacts}` : "0/0";
  const _ackProg = document.getElementById("ackProgress");
  if (_ackProg) _ackProg.style.width = _ackActiva ? `${percent}%` : "0%";

  ackList.innerHTML = "";
  const confirmationRows = !_ackActiva ? [] : extraRecipients.length
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
  if (!_ackActiva) {
    ackList.innerHTML = '<li class="ack-empty" style="color:var(--muted);padding:12px 2px;list-style:none;line-height:1.4">Sin alerta activa. Los destinatarios aparecen acá al <strong>emitir</strong> o <strong>simular</strong> una alerta.</li>';
  }

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

  document.getElementById("recipientCount").textContent = `${rows.length} usuarios`;
  const _pend = extraRecipients.filter((r) => (r.estadoAlta || "Activo") !== "Activo").length;
  const _approveAll = document.getElementById("approveAllButton");
  if (_approveAll) {
    _approveAll.hidden = _pend === 0;
    _approveAll.textContent = `✓ Aprobar todos (${_pend})`;
  }
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
      <td><span class="status-token ${row.estadoAlta === "Activo" ? "state-ok" : "state-escalate"}">${row.estadoAlta || "Pendiente"}</span></td>
      <td>${row.last}</td>
      <td>
        ${
          row.editable
            ? `<div class="table-actions">
                ${row.estadoAlta !== "Activo" ? `<button class="table-action approve-text-button" data-approve-recipient="${row.id}" type="button">Aprobar</button>` : ""}
                ${row.phone ? `<a class="table-action wa-text-button" href="https://wa.me/${waPhone(row.phone)}?text=${encodeURIComponent(alertData.message + "\n\n✅ Confirmar recepción: " + linkConfirmacionApp(row))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
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
      <span>Subiendo</span>
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
    .slice(0, 12)
    .forEach((station) => {
      // Color = estado OFICIAL del INA (Normal / Alerta / Evacuación). Que un río suba no lo
      // pone en rojo: la variación real se muestra al lado (↑ +2 cm / ↓ −16 cm).
      const enAlerta = /alerta|evacua/i.test(station.nivel_alerta);
      const delta = Number.isFinite(station.altura_m) && Number.isFinite(station.precedente)
        ? Math.round((station.altura_m - station.precedente) * 100) : null;
      let variacion = "";
      if (station.tendencia === "crece" || station.tendencia === "baja") {
        const sube = station.tendencia === "crece";
        const txt = delta != null && delta !== 0 ? `${sube ? "↑ +" : "↓ −"}${Math.abs(delta)} cm` : (sube ? "↑ sube" : "↓ baja");
        variacion = `<span title="Variación respecto de la medición anterior del INA" style="font-size:12px;font-weight:700;white-space:nowrap;color:${sube ? "#b45309" : "#0369a1"}">${txt}</span>`;
      }
      const medido = station.fecha ? new Date(station.fecha) : null;
      const cuando = medido && !isNaN(medido)
        ? ` · medido ${medido.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}` : "";
      const item = document.createElement("li");
      item.innerHTML = `
        <span class="list-main">
          <strong>${_esc(station.nombre)}</strong>
          <span>${_esc(station.rio)}${station.departamento ? ` · ${_esc(station.departamento)}` : ""}${cuando}</span>
        </span>
        <span style="display:flex;align-items:center;gap:8px">
          ${variacion}
          <span class="status-token ${enAlerta ? "state-escalate" : "state-ok"}" title="Estado oficial INA: ${_esc(station.nivel_alerta)}">
            ${Number.isFinite(station.altura_m) ? station.altura_m.toFixed(2) : "--"} m${enAlerta ? ` · ${_esc(station.nivel_alerta)}` : ""}
          </span>
        </span>
      `;
      list.appendChild(item);
    });
}

// --- Trazabilidad persistente (29/10) -----------------------------------------------
// Cada evento se guarda en Firestore (colección "auditoria"): no se pierde al recargar,
// se ve en todos los equipos y registra quién lo hizo. Los eventos no se pueden editar ni borrar.
function _fechaHora(ms) {
  const d = new Date(ms);
  const hoy = new Date();
  const hh = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toDateString() === hoy.toDateString()
    ? `${hh} h`
    : `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${hh} h`;
}

function _operadorActual() {
  try { return sessionStorage.getItem("crecida_user") || ""; } catch (e) { return ""; }
}

function renderTimeline() {
  timeline.innerHTML = "";
  if (!auditEvents.length) {
    timeline.innerHTML = '<li style="list-style:none;color:var(--muted);padding:10px 0">Todavía no hay eventos registrados.</li>';
    return;
  }
  auditEvents.forEach((event) => {
    const item = document.createElement("li");
    const quien = event.operador ? `${_esc(event.actor)}<br><small>${_esc(event.operador)}</small>` : _esc(event.actor);
    item.innerHTML = `
      <time>${_esc(event.time)}</time>
      <span><strong>${_esc(event.title)}</strong>${_esc(event.detail)}</span>
      <span>${quien}</span>
    `;
    timeline.appendChild(item);
  });
}

let _auditDesdeFirestore = false;
function addAudit(title, detail, actor = "Operador") {
  const ts = Date.now();
  const operador = _operadorActual();
  if (!_auditDesdeFirestore) {
    auditEvents.unshift({ time: _fechaHora(ts), title, detail, actor, operador });
    renderTimeline();
  }
  if (firebaseEnabled && firestoreDb && operador) {
    try {
      firestoreDb.collection("auditoria").add({
        ts, title: String(title || ""), detail: String(detail || ""), actor: String(actor || ""), operador,
        creadoEn: window.firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    } catch (e) {}
  }
}

function escucharAuditoria() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    firestoreDb.collection("auditoria").orderBy("ts", "desc").limit(200).onSnapshot((snap) => {
      _auditDesdeFirestore = true;
      auditEvents.length = 0;
      snap.docs.forEach((doc) => {
        const e = doc.data();
        auditEvents.push({ time: _fechaHora(e.ts || Date.now()), title: e.title, detail: e.detail, actor: e.actor, operador: e.operador });
      });
      renderTimeline();
    }, () => {});
  } catch (e) {}
}

function renderActionState() {
  const distributeButton = document.getElementById("distributeButton");
  const escalateButton = document.getElementById("escalateButton");
  const actionNote = document.getElementById("actionNote");
  const activa = !!(alertData.id && alertData.id !== "—" && alertData.level && alertData.level !== "Sin alerta");
  const prueba = !!alertData.esPrueba;
  const destinos = activa && !prueba && window.CRECIDA_destinatariosConEmail
    ? window.CRECIDA_destinatariosConEmail(alertData).length : null;

  if (!distributeButton.dataset.enviando) {
    distributeButton.textContent = distributed
      ? "✓ Alerta enviada"
      : prueba ? "🧪 Enviar prueba (solo a mí)"
      : destinos != null ? `Enviar alerta por correo (${destinos})` : "Enviar alerta por correo";
    distributeButton.disabled = distributed || !activa || destinos === 0;
  }
  escalateButton.textContent = "Ver quién no confirmó";
  escalateButton.className = "secondary-button";
  escalateButton.disabled = !distributed;

  if (!activa) {
    actionNote.textContent = "Primero cargá una alerta: “＋ Nueva alerta manual” o “Cargar en alerta” desde una sugerencia.";
  } else if (distributed) {
    actionNote.textContent = "Enviada. Las confirmaciones llegan en vivo. A quien no confirme, escribile por WhatsApp desde “Ver quién no confirmó”.";
  } else if (destinos === 0) {
    actionNote.textContent = `No hay usuarios activos con email en ${alertData.affected.join(", ")}. Cargalos en “Usuarios” antes de enviar.`;
  } else if (prueba) {
    actionNote.textContent = "MODO PRUEBA: el correo va solo a tu casilla, marcado como prueba de funcionamiento. Nadie del padrón lo recibe.";
  } else {
    actionNote.textContent = `Va por correo a los usuarios activos de ${alertData.affected.join(", ")}, con botón para confirmar recepción. Antes de enviar vas a ver el resumen.`;
  }

  const nt = document.getElementById("nextActionTitle");
  const nm = document.getElementById("nextActionMeta");
  if (nt && nm) {
    if (!activa) { nt.textContent = "1 · Cargar una alerta"; nm.textContent = "Desde una sugerencia o “＋ Nueva alerta manual”"; }
    else if (!distributed) { nt.textContent = prueba ? "2 · Enviar la prueba" : "2 · Enviar la alerta"; nm.textContent = prueba ? "Solo a tu casilla" : `${destinos || 0} usuario(s) con email en la zona`; }
    else { nt.textContent = "3 · Seguir confirmaciones"; nm.textContent = "“Ver quién no confirmó” → WhatsApp a los que faltan"; }
  }
  const pc = document.getElementById("pendingCount");
  if (pc) pc.textContent = activa && !prueba && destinos != null ? `${destinos} con email` : "—";
  const cb = document.getElementById("closeAlertButton");
  if (cb) cb.hidden = !activa;
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

// El envío real vive en envio.js: cuando termina bien, marca la alerta como enviada.
window.CRECIDA_marcarDistribuida = (detalle) => {
  distributed = true;
  alertData.lastSync = `${currentTime()} h`;
  addAudit("Alerta enviada", detalle || "Correos despachados con enlace de confirmación.", "Operador provincial");
  guardarEstadoAlerta();
  render();
};

document.getElementById("escalateButton").addEventListener("click", () => {
  const tab = document.querySelector('.tab[data-view="alertas"]');
  if (tab) tab.click();
  if (window.CRECIDA_verFaltantes) window.CRECIDA_verFaltantes(alertData.id);
});

document.getElementById("addAuditButton").addEventListener("click", () => {
  const texto = typeof window.prompt === "function" ? window.prompt("Novedad a registrar en la trazabilidad:") : "";
  if (!texto || !texto.trim()) return;
  auditCounter += 1;
  addAudit("Seguimiento manual", texto.trim().slice(0, 500), "Sala de situación");
});

// --- Detección de duplicados (mismo WhatsApp o mismo email) ---
function _emailKey(e) { return String(e || "").trim().toLowerCase(); }
function _phoneKey(p) { const d = String(p || "").replace(/\D/g, ""); return d ? d.slice(-10) : ""; }
function buscarDuplicado(email, phone, exceptIndex) {
  const ek = _emailKey(email), pk = _phoneKey(phone);
  for (let i = 0; i < extraRecipients.length; i++) {
    if (exceptIndex != null && i === exceptIndex) continue;
    const r = extraRecipients[i];
    if (ek && _emailKey(r.email) === ek) return r;
    if (pk && _phoneKey(r.phone) === pk) return r;
  }
  return null;
}

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
    estadoAlta: "Pendiente",
    last: `${currentTime()} h`,
  };

  const _dup = buscarDuplicado(recipient.email, recipient.phone, editingRecipientIndex);
  if (_dup) {
    window.alert(`Ya existe un usuario con ese WhatsApp o email: ${_dup.name} (${_dup.jurisdiction}). No se agregó de nuevo.`);
    return;
  }

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

  const approveButton = event.target.closest("[data-approve-recipient]");
  if (approveButton) {
    approveRecipient(Number(approveButton.dataset.approveRecipient));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-recipient]");
  if (!deleteButton) return;
  deleteRecipient(Number(deleteButton.dataset.deleteRecipient));
});

const approveAllButton = document.getElementById("approveAllButton");
if (approveAllButton) approveAllButton.addEventListener("click", approveAllRecipients);

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
  alertData.esPrueba = false;
  alertData.level = levelLabel(levelKey);
  alertData.levelKey = levelKey;
  alertData.title = title;
  alertData.directive = directive;
  alertData.zoneCompact = affected.join(" / ");
  const fuenteDatos = (alertForm.dataset.fuente || "").trim(); // la completa prellenado.js
  alertData.source = fuenteDatos ? `Carga manual · ${fuenteDatos}` : "Carga manual auditada";
  alertData.sourceShort = "Manual";
  alertData.issuedAt = `${now} h`;
  alertData.validUntil = validUntil;
  alertData.lastSync = `${now} h`;
  alertData.affected = affected;
  alertData.message = `${alertData.level.toUpperCase()} - ${title.toUpperCase()}\n\nFuente: ${fuenteDatos ? fuenteDatos + " (validado por la sala de situación)" : "carga manual auditada"}\nID: ${alertData.id}\n\nZona afectada: ${affected.join(" - ")}.\nVigencia: ${validUntil}.\n\nAcción: ${directive}\n\nPara confirmar la recepción, usá el enlace de este mensaje.`;

  resetJurisdictionRisks(affected, levelKey);
  selectedJurisdiction = getJurisdiction(affected[0] || selectedJurisdiction.name);
  distributed = false;
  escalated = false;
  addAudit(
    "Alerta manual creada",
    `${alertData.level}: ${title}. Zonas: ${affected.join(", ")}.`,
    "Super admin / sala de situación",
  );
  guardarEstadoAlerta();
  render();
});

document.getElementById("simulateAlertButton").addEventListener("click", () => {
  alertData.id = `PRUEBA-${Date.now().toString().slice(-6)}`; // id único por simulacro
  alertData.esPrueba = true;
  alertData.source = "Simulacro interno";
  alertData.sourceShort = "Prueba";
  alertData.level = "Rojo";
  alertData.levelKey = "red";
  alertData.title = "Prueba de funcionamiento (simulacro)";
  alertData.directive = "Emergencia operativa en Simoca, Monteros y Leales.";
  alertData.zoneCompact = "Simoca / Monteros / Leales";
  alertData.affected = ["Simoca", "Monteros", "Leales"]; // zonas afectadas (recepción/envío filtran por esto)
  alertData.issuedAt = `${currentTime()} h`;
  alertData.validUntil = "Próximas 3 h";
  alertData.lastSync = `${currentTime()} h`;
  distributed = false;
  escalated = false;
  alertData.message =
    "🧪 ESTO ES UNA PRUEBA DE FUNCIONAMIENTO — NO REQUIERE NINGUNA ACCIÓN\n\nSimulacro interno del Programa CRECIDA. No es un aviso oficial del SMN ni del INA.\nID: " + alertData.id + "\n\nEscenario simulado: lluvia intensa con riesgo de anegamiento en Simoca - Monteros - Leales.\n\nPara probar el circuito, confirmá la recepción con el enlace de este mensaje.";

  const leales = jurisdictions.find((item) => item.name === "Leales");
  if (leales) {
    leales.risk = "red";
    leales.response = "escalate";
    leales.status = "Escalar";
    leales.detail = "Alerta roja simulada. Falta confirmación de Defensa Civil local.";
  }

  addAudit("Simulacro iniciado", "Prueba de funcionamiento (no oficial). El envío va solo a la casilla del operador.", "Modo prueba");
  guardarEstadoAlerta();
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
escucharAuditoria();
syncHidroData({ silent: true });

// --- Alerta activa persistente (29/10) ---------------------------------------------
// La alerta cargada se guarda en Firestore (estado/alertaActiva): sobrevive a recargas,
// se ve igual en todos los equipos y, si ya se envió, no se puede volver a enviar.
function guardarEstadoAlerta() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    firestoreDb.collection("estado").doc("alertaActiva").set({
      alert: JSON.parse(JSON.stringify(alertData)),
      distributed: !!distributed,
      cerrada: false,
      actualizadoEn: window.firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
  } catch (e) {}
}

function volverAReposo() {
  Object.keys(alertData).forEach((k) => { if (!(k in ALERTA_REPOSO)) delete alertData[k]; });
  Object.assign(alertData, JSON.parse(JSON.stringify(ALERTA_REPOSO)));
  distributed = false;
  escalated = false;
}

function cerrarAlertaActiva() {
  const activa = alertData.id && alertData.id !== "—" && alertData.level !== "Sin alerta";
  if (!activa) return;
  if (typeof window.confirm === "function" &&
      !window.confirm(`¿Cerrar la alerta ${alertData.id}?\n\nEl panel vuelve a "Sin alerta". El historial y las confirmaciones quedan guardados.`)) return;
  const id = alertData.id;
  volverAReposo();
  addAudit("Alerta cerrada", `Se cerró la alerta ${id}. El sistema vuelve a monitoreo normal.`, "Operador provincial");
  if (firebaseEnabled && firestoreDb) {
    try {
      firestoreDb.collection("estado").doc("alertaActiva").set({
        cerrada: true,
        ultimaCerrada: id,
        actualizadoEn: window.firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    } catch (e) {}
  }
  render();
}
window.CRECIDA_cerrarAlerta = cerrarAlertaActiva;

(function escucharEstadoAlerta() {
  if (!firebaseEnabled || !firestoreDb) return;
  try {
    firestoreDb.collection("estado").doc("alertaActiva").onSnapshot((snap) => {
      const d = snap && snap.exists ? snap.data() : null;
      if (!d || d.cerrada || !d.alert || !d.alert.id || d.alert.id === "—") {
        // Cerrada desde otro equipo: este también vuelve a reposo.
        if (d && d.cerrada && alertData.id !== "—") { volverAReposo(); render(); }
        return;
      }
      if (d.alert.id === alertData.id && !!d.distributed === distributed) return; // sin cambios
      volverAReposo();
      Object.assign(alertData, d.alert);
      distributed = !!d.distributed;
      render();
    }, () => {});
  } catch (e) {}
})();

const _btnCerrarAlerta = document.getElementById("closeAlertButton");
if (_btnCerrarAlerta) _btnCerrarAlerta.addEventListener("click", cerrarAlertaActiva);

// --- Envío: helpers compartidos ---
function linkConfirmacionApp(row) {
  const base = location.origin;
  return `${base}/confirmar.html?a=${encodeURIComponent(alertData.id || "")}&d=${encodeURIComponent(row.name || "")}&j=${encodeURIComponent(row.jurisdiction || "")}` + (row.firebaseId ? `&u=${encodeURIComponent(row.firebaseId)}` : "");
}
function waPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.startsWith("54") ? d : "549" + d;
}
window.CRECIDA_estado = () => ({ alert: alertData, destinatarios: extraRecipients, enviada: distributed });
window.getJurisdiction = getJurisdiction;
window.selectJurisdiction = selectJurisdiction;
window.CRECIDA_selectedName = () => selectedJurisdiction.name;

// --- Carga masiva de usuarios (importación desde Excel) ---
window.CRECIDA_importarUsuarios = async (lista) => {
  if (!Array.isArray(lista) || !lista.length) return { ok: 0, dup: 0 };
  let added = 0, dup = 0;
  lista.forEach((r) => {
    const email = (r.email || "").trim();
    const phone = (r.phone || "").trim();
    // Omite si ya existe (por WhatsApp o email) o si se repite dentro de la misma planilla.
    if (buscarDuplicado(email, phone, null)) { dup++; return; }
    extraRecipients.unshift({
      name: (r.name || "").trim(),
      email: email,
      phone: phone,
      role: (r.role || "").trim(),
      jurisdiction: (r.jurisdiction || "").trim(),
      organization: (r.organization || "").trim(),
      channel: "WhatsApp",
      status: "Pendiente",
      estadoAlta: "Pendiente",
      last: `${currentTime()} h`,
    });
    added++;
  });
  try { addAudit("Carga masiva de usuarios", `Importados ${added} usuario(s) desde Excel; ${dup} ya existían (omitidos).`, "Carga operativa"); } catch (e) {}
  render();
  try { await saveRecipientsToFirestore(); } catch (e) {}
  return { ok: added, dup: dup };
};
