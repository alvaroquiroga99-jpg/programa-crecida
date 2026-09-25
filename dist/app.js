const alertData = {
  id: "ACP-SMN-TUC-1540",
  level: "Naranja",
  levelKey: "orange",
  title: "Tormentas fuertes",
  directive: "Lluvias intensas. Preparación activa.",
  zoneCompact: "Famaillá / Monteros / Simoca",
  source: "Servicio Meteorológico Nacional",
  sourceShort: "SMN",
  issuedAt: "15:40 h",
  validUntil: "Hasta 18:40 h",
  lastSync: "15:41 h",
  affected: ["Famaillá", "Monteros", "Simoca", "Leales"],
  message:
    "AVISO A MUY CORTO PLAZO\n\nFuente: Servicio Meteorológico Nacional\nID: ACP-SMN-TUC-1540\n\nFenómeno: tormentas fuertes con lluvias intensas.\nZona afectada: Famaillá - Monteros - Simoca.\nVigencia: hasta 18:40 h.\n\nAcción: confirmar recepción y verificar disponibilidad operativa.\n\nCONFIRMAR RECEPCIÓN EN LA APP",
};

const jurisdictions = [
  {
    name: "Simoca",
    risk: "red",
    response: "escalate",
    contacts: 2,
    confirmed: 0,
    status: "Escalar",
    detail:
      "Jurisdicción crítica sin confirmaciones. Debe escalarse a Defensa Civil provincial y 107 Central.",
    critical: ["Atahona", "Ciudacita", "Pampa Mayo", "Los Juárez"],
    orgs: [
      { name: "Defensa Civil local", status: "Sin confirmar", channel: "WhatsApp", last: "15:42 h" },
      { name: "Municipio", status: "Sin confirmar", channel: "App", last: "15:42 h" },
    ],
  },
  {
    name: "Monteros",
    risk: "orange",
    response: "partial",
    contacts: 3,
    confirmed: 2,
    status: "Parcial",
    detail:
      "Afectada por el polígono del ACP. Falta la confirmación municipal para cerrar la recepción local.",
    critical: ["Villa Quinteros", "León Rougés", "Los Sosa", "Santa Lucía"],
    orgs: [
      { name: "107 local", status: "Confirmado", channel: "WhatsApp", last: "15:43 h" },
      { name: "Hospital", status: "Confirmado", channel: "App", last: "15:44 h" },
      { name: "Municipio", status: "Pendiente", channel: "WhatsApp", last: "15:42 h" },
    ],
  },
  {
    name: "Famaillá",
    risk: "orange",
    response: "ok",
    contacts: 3,
    confirmed: 3,
    status: "Confirmado",
    detail: "Jurisdicción afectada con recepción completa. Mantener seguimiento hasta el cierre de vigencia.",
    critical: ["Padilla", "El Cruce", "Nueva Baviera"],
    orgs: [
      { name: "Defensa Civil local", status: "Confirmado", channel: "WhatsApp", last: "15:43 h" },
      { name: "Hospital", status: "Confirmado", channel: "App", last: "15:44 h" },
      { name: "Municipio", status: "Confirmado", channel: "WhatsApp", last: "15:45 h" },
    ],
  },
  {
    name: "Leales",
    risk: "orange",
    response: "partial",
    contacts: 3,
    confirmed: 2,
    status: "Parcial",
    detail: "Área bajo preparación activa por posible desplazamiento de tormentas hacia zonas bajas.",
    critical: ["Los Gómez", "Los Puestos", "Santa Rosa de Leales"],
    orgs: [
      { name: "Municipio", status: "Confirmado", channel: "WhatsApp", last: "15:43 h" },
      { name: "Salud", status: "Confirmado", channel: "App", last: "15:46 h" },
      { name: "Defensa Civil local", status: "Pendiente", channel: "WhatsApp", last: "15:42 h" },
    ],
  },
  {
    name: "Capital",
    risk: "yellow",
    response: "watch",
    contacts: 4,
    confirmed: 3,
    status: "Vigilancia",
    detail: "Vigilancia reforzada por acumulación de lluvia y posible impacto en accesos del área metropolitana.",
    critical: ["Barrios del sur", "Canal Sur", "Accesos a hospitales"],
    orgs: [
      { name: "107 Central", status: "Confirmado", channel: "App", last: "15:42 h" },
      { name: "Defensa Civil", status: "Confirmado", channel: "WhatsApp", last: "15:42 h" },
      { name: "Municipio", status: "Confirmado", channel: "App", last: "15:45 h" },
      { name: "Higiene y Seguridad", status: "Pendiente", channel: "WhatsApp", last: "15:42 h" },
    ],
  },
  {
    name: "Yerba Buena",
    risk: "yellow",
    response: "watch",
    contacts: 3,
    confirmed: 2,
    status: "Vigilancia",
    detail: "Vigilancia reforzada por proximidad al área de tormentas y accesos hacia pedemonte.",
    critical: ["San José", "Canales de escurrimiento", "Acceso oeste"],
    orgs: [
      { name: "Municipio", status: "Confirmado", channel: "WhatsApp", last: "15:43 h" },
      { name: "Salud", status: "Confirmado", channel: "App", last: "15:44 h" },
      { name: "Higiene y Seguridad", status: "Pendiente", channel: "WhatsApp", last: "15:42 h" },
    ],
  },
  {
    name: "Lules",
    risk: "yellow",
    response: "watch",
    contacts: 2,
    confirmed: 2,
    status: "Vigilancia",
    detail: "Zona en vigilancia por cercanía al corredor de tormentas. Sin faltantes críticos al momento.",
    critical: ["San Pablo", "El Manantial", "Canalizaciones rurales"],
    orgs: [
      { name: "Municipio", status: "Confirmado", channel: "WhatsApp", last: "15:44 h" },
      { name: "Salud", status: "Confirmado", channel: "App", last: "15:45 h" },
    ],
  },
  {
    name: "Cruz Alta",
    risk: "yellow",
    response: "watch",
    contacts: 2,
    confirmed: 1,
    status: "Vigilancia",
    detail: "Seguimiento preventivo del sector este y accesos por posible anegamiento.",
    critical: ["Banda del Río Salí", "Alderetes", "Los Ralos"],
    orgs: [
      { name: "Municipio", status: "Confirmado", channel: "App", last: "15:46 h" },
      { name: "Defensa Civil local", status: "Pendiente", channel: "WhatsApp", last: "15:42 h" },
    ],
  },
  {
    name: "Chicligasta",
    risk: "yellow",
    response: "watch",
    contacts: 2,
    confirmed: 2,
    status: "Vigilancia",
    detail: "Vigilancia del corredor sur por crecidas repentinas y accesos secundarios.",
    critical: ["Alpachiri", "Alto Verde", "Arcadia"],
    orgs: [
      { name: "107 local", status: "Confirmado", channel: "WhatsApp", last: "15:45 h" },
      { name: "Municipio", status: "Confirmado", channel: "App", last: "15:46 h" },
    ],
  },
  {
    name: "Río Chico",
    risk: "yellow",
    response: "watch",
    contacts: 2,
    confirmed: 1,
    status: "Vigilancia",
    detail: "Área de vigilancia por historial de anegamientos y necesidad de monitoreo territorial.",
    critical: ["Aguilares", "Los Sarmientos", "Santa Bárbara"],
    orgs: [
      { name: "Hospital", status: "Confirmado", channel: "App", last: "15:46 h" },
      { name: "Municipio", status: "Pendiente", channel: "WhatsApp", last: "15:42 h" },
    ],
  },
];

const defaultState = {
  risk: "green",
  response: "ok",
  contacts: 0,
  confirmed: 0,
  status: "Sin afectación",
  detail: "Sin afectación vigente. Mantiene datos territoriales disponibles para consulta.",
  critical: ["Sin puntos cargados en el MVP"],
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

const schema = [
  ["users", "Identidad, rol, MFA, organismo y jurisdicción asignada."],
  ["organizations", "Defensa Civil, 107, Salud, municipios, policía, bomberos y Cruz Roja."],
  ["jurisdictions", "Departamentos, municipios, localidades y geometría PostGIS."],
  ["alerts", "Alerta oficial, fuente, vigencia, nivel, fenómeno y payload original."],
  ["alert_areas", "Polígonos oficiales para intersección territorial."],
  ["alert_impacts", "Resultado del cruce entre alerta, jurisdicción y organismo."],
  ["notifications", "Mensajes generados por canal y regla de distribución."],
  ["notification_deliveries", "Envío, entrega, error y proveedor de cada mensaje."],
  ["acknowledgements", "Confirmación de recepción por usuario, hora y organismo."],
  ["escalations", "Escalamiento automático por falta de respuesta."],
  ["audit_log", "Bitácora inmodificable de acciones relevantes."],
];

const architectureSteps = [
  ["1. Detector oficial", "Cloud Scheduler consulta SMN/SINAME y Cloud Run valida nuevas alertas."],
  ["2. Cruce territorial", "PostGIS intersecta el polígono con Tucumán, departamentos y jurisdicciones."],
  ["3. Distribución", "Pub/Sub genera tareas de WhatsApp, push, correo o SMS con reintentos."],
  ["4. Confirmación", "Cada responsable confirma recepción y el tablero actualiza faltantes."],
  ["5. Escalamiento", "Si no hay respuesta en el plazo definido, avisa a 107 Central y Defensa Civil."],
  ["6. Auditoría", "Todo evento queda registrado con hora, actor, canal y resultado."],
];

const launchDecisions = [
  "Definir responsables titulares y suplentes por organismo y jurisdicción.",
  "Acordar si la primera fuente de alerta será carga manual validada o integración SMN/SINAME.",
  "Confirmar canales permitidos: app, WhatsApp, correo y SMS de contingencia.",
  "Elegir alcance territorial inicial: piloto Tucumán completo o departamentos priorizados.",
  "Nombrar un responsable institucional para acceso a APIs, plantillas y datos sensibles.",
];

const integrations = [
  {
    name: "SMN / SINAME",
    status: "Gestión institucional",
    detail: "Fuente oficial de alertas. Para la primera etapa puede convivir con carga manual auditada.",
  },
  {
    name: "WhatsApp Business",
    status: "Requiere alta",
    detail: "Mensajes automáticos con plantillas aprobadas y costo por conversación/mensaje.",
  },
  {
    name: "Firebase Push",
    status: "Listo para MVP",
    detail: "Notificaciones dentro de la app/PWA para responsables con sesión activa.",
  },
  {
    name: "Base PostgreSQL/PostGIS",
    status: "Necesario",
    detail: "Persistencia de alertas, confirmaciones, auditoría, jurisdicciones y geometría.",
  },
  {
    name: "Autenticación MFA",
    status: "Necesario",
    detail: "Ingreso seguro por rol: sala provincial, 107, HyS, Defensa Civil y municipios.",
  },
  {
    name: "SMS contingencia",
    status: "Etapa 2",
    detail: "Canal alternativo para alerta roja o caída de conectividad de datos.",
  },
];

const milestones = [
  ["Semana 1", "Validar roles, organismos, jurisdicciones y circuito real de escalamiento."],
  ["Semanas 2-3", "Backend, base de datos, login y primera auditoría persistente."],
  ["Semanas 4-5", "Carga de alertas, confirmaciones reales y tablero operativo conectado."],
  ["Semanas 6-7", "WhatsApp/push, plantillas, permisos y pruebas con responsables designados."],
  ["Semanas 8-10", "Piloto controlado, ajustes operativos, reporte y decisión de escalamiento."],
];

let selectedJurisdiction = jurisdictions.find((item) => item.name === "Monteros");
let distributed = false;
let escalated = false;
let auditCounter = 0;
let extraRecipients = loadExtraRecipients();

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

const auditEvents = [
  {
    time: "15:41 h",
    title: "ACP detectado",
    detail: "El sistema registró una alerta nueva del SMN.",
    actor: "Detector automático",
  },
  {
    time: "15:41 h",
    title: "Cruce territorial",
    detail: "El polígono intersecta Famaillá, Monteros, Simoca y Leales.",
    actor: "Motor PostGIS",
  },
  {
    time: "15:42 h",
    title: "Destinatarios generados",
    detail: "Se prepararon mensajes para responsables operativos afectados.",
    actor: "Regla de distribución",
  },
  {
    time: "15:43 h",
    title: "Recepción confirmada",
    detail: "Famaillá completó 3/3 confirmaciones.",
    actor: "Operador local",
  },
  {
    time: "15:50 h",
    title: "Pendiente crítico",
    detail: "Simoca continúa sin confirmar recepción.",
    actor: "Monitor automático",
  },
];

const departmentData = window.TUCUMAN_DEPARTMENTS || [];
const provinceMap = document.getElementById("provinceMap");
const ackList = document.getElementById("ackList");
const pendingList = document.getElementById("pendingList");
const orgList = document.getElementById("orgList");
const criticalList = document.getElementById("criticalList");
const timeline = document.getElementById("timeline");
const schemaList = document.getElementById("schemaList");
const architectureStepsEl = document.getElementById("architectureSteps");
const recipientRows = document.getElementById("recipientRows");
const recipientForm = document.getElementById("recipientForm");
const recipientJurisdiction = document.getElementById("recipientJurisdiction");
const alertForm = document.getElementById("alertForm");
const manualAlertZones = document.getElementById("manualAlertZones");
const selectAllZonesButton = document.getElementById("selectAllZonesButton");
const clearZonesButton = document.getElementById("clearZonesButton");
const launchDecisionsEl = document.getElementById("launchDecisions");
const integrationList = document.getElementById("integrationList");
const milestoneGrid = document.getElementById("milestoneGrid");

function currentTime() {
  return new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

  return { name, ...defaultState };
}

function responseClass(response) {
  return `state-${response}`;
}

function statusForOrg(status) {
  if (status === "Confirmado") return "ok";
  if (status === "Sin confirmar") return "escalate";
  if (status === "Pendiente") return "partial";
  return "watch";
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
  saveExtraRecipients();
  addAudit(
    "Responsable eliminado",
    `${recipient.name} fue eliminado de ${recipient.organization} en ${recipient.jurisdiction}.`,
    "Carga operativa",
  );
  render();
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
  document.getElementById("lastSync").textContent = alertData.lastSync;
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
  const totals = jurisdictions.reduce(
    (acc, item) => {
      acc.contacts += item.contacts;
      acc.confirmed += item.confirmed;
      return acc;
    },
    { contacts: 0, confirmed: 0 },
  );
  const percent = totals.contacts ? Math.round((totals.confirmed / totals.contacts) * 100) : 0;

  document.getElementById("ackSummary").textContent = `${totals.confirmed}/${totals.contacts}`;
  document.getElementById("ackProgress").style.width = `${percent}%`;

  ackList.innerHTML = "";
  jurisdictions.slice(0, 7).forEach((item) => {
    const row = document.createElement("li");
    row.innerHTML = `
      <span class="list-main">
        <strong>${item.name}</strong>
        <span>${item.confirmed}/${item.contacts} confirmaciones</span>
      </span>
      <span class="status-token ${responseClass(item.response)}">${item.status}</span>
    `;
    ackList.appendChild(row);
  });

  pendingList.innerHTML = "";
  jurisdictions
    .filter((item) => item.contacts - item.confirmed > 0)
    .sort((a, b) => b.contacts - b.confirmed - (a.contacts - a.confirmed))
    .slice(0, 5)
    .forEach((item) => {
      const pending = item.contacts - item.confirmed;
      const row = document.createElement("li");
      row.innerHTML = `
        <span class="list-main">
          <strong>${item.name}</strong>
          <span>Faltan ${pending} responsables</span>
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
            ? `<button class="table-action danger-text-button" data-delete-recipient="${row.id}" type="button">Eliminar</button>`
            : `<span class="table-subtext">Base operativa</span>`
        }
      </td>
    `;
    recipientRows.appendChild(tr);
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

function renderArchitecture() {
  architectureStepsEl.innerHTML = "";
  architectureSteps.forEach(([title, detail]) => {
    const item = document.createElement("div");
    item.className = "step-item";
    item.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
    architectureStepsEl.appendChild(item);
  });

  schemaList.innerHTML = "";
  schema.forEach(([table, description]) => {
    const item = document.createElement("div");
    item.className = "schema-item";
    item.innerHTML = `<strong>${table}</strong><span>${description}</span>`;
    schemaList.appendChild(item);
  });
}

function renderLaunchPlan() {
  launchDecisionsEl.innerHTML = "";
  launchDecisions.forEach((decision) => {
    const item = document.createElement("li");
    item.textContent = decision;
    launchDecisionsEl.appendChild(item);
  });

  integrationList.innerHTML = "";
  integrations.forEach((integration) => {
    const item = document.createElement("div");
    item.className = "integration-item";
    item.innerHTML = `
      <div>
        <strong>${integration.name}</strong>
        <span>${integration.detail}</span>
      </div>
      <span class="quiet-pill">${integration.status}</span>
    `;
    integrationList.appendChild(item);
  });

  milestoneGrid.innerHTML = "";
  milestones.forEach(([period, detail]) => {
    const item = document.createElement("div");
    item.className = "milestone-item";
    item.innerHTML = `<strong>${period}</strong><span>${detail}</span>`;
    milestoneGrid.appendChild(item);
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
  renderTimeline();
  renderLaunchPlan();
  renderArchitecture();
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

  extraRecipients.unshift(recipient);
  saveExtraRecipients();
  addAudit(
    "Responsable agregado",
    `${recipient.name} fue cargado como ${recipient.organization} en ${recipient.jurisdiction}.`,
    "Carga operativa",
  );
  recipientForm.reset();
  recipientJurisdiction.value = recipient.jurisdiction;
  render();
});

recipientRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-recipient]");
  if (!button) return;
  deleteRecipient(Number(button.dataset.deleteRecipient));
});

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

setupRecipientForm();
setupAlertForm();
render();
