/**
 * GEOVISOR MODULAR DE TUCUMÁN - ARQUITECTURA DE PLUGINS & CAPAS
 * Leaflet.js Framework con soporte para múltiples extensiones combinables:
 * - Plugin 1: Estaciones Meteorológicas (39)
 * - Plugin 2: Hidrometría INA - Altura de Ríos (39)
 * - Plugin 3: Efectores de Salud SIPROSA (367)
 * - Plugin 4: Red Hidrográfica de Ríos
 * - Plugin 5: Masas de Calor Diurnas (24 Horas)
 */

// Estado Global del Framework
const state = {
  // Datos crudos
  stations: [],
  hidroList: [],
  saludList: [],
  rutasList: [],
  defensaCivilList: [],
  inundacionesList: [],
  bomberosList: [],
  focosIncendioList: [],
  presasList: [],
  hourlyHeatData: new Map(),

  // Filtros internos
  filterMeteoOrg: 'all',
  filterHidroTendencia: 'all',
  filterSaludTipo: 'all',
  filterInundacionRiesgo: 'all',
  filterBomberoEstado: 'all',
  filterPyroConfidence: 'all',
  filterPresaTipo: 'all',
  pyroDisplayMode: 'points',
  selectedDepartamento: 'all',
  universalSearchQuery: '',
  universalSearchCat: 'all',

  // Instancias del mapa y capas
  map: null,
  boundaryLayer: null,
  boundaryWeight: 2.2,
  layers: {
    meteo: null,
    hidro: null,
    salud: null,
    rivers: null,
    heat: null,
    rutas: null,
    defensaCivil: null,
    inundaciones: null,
    bomberos: null,
    incendios: null,
    focosHeatmap: null,
    presas: null,
    simuladorBuffer: null
  },

  // Estado de activación de plugins (Inicio despejado / Sin marcas)
  pluginsActive: {
    meteo: false,
    hidro: false,
    salud: false,
    rivers: false,
    calor: false,
    rutas: false,
    defensaCivil: false,
    inundaciones: false,
    bomberos: false,
    incendios: false,
    presas: false
  },

  // Estado de visibilidad de las capas en el mapa (Limpiar mapa / Ocultar sin desactivar plugins)
  mapLayersHidden: false,

  // Registro dinámico de módulos instalados (Marketplace / Subidos)
  installedModules: {},

  // Estado del reproductor de calor
  heatPlaying: false,
  heatPlayTimer: null,
  currentHeatHour: 14,

  // Objeto seleccionado actualmente en el inspector
  selectedEntity: null,

  // 1. Time Machine 48 Horas
  timeline: {
    steps: [],
    currentIndex: 3, // Inicia en 0h (En Vivo)
    isPlaying: false,
    timer: null,
    speed: 1
  },

  // 2. Audio Alertas Tácticas (Web Audio API)
  soundEnabled: true,

  // 3. Paleta de Comandos (Ctrl + K)
  palette: {
    isOpen: false,
    filter: 'all',
    selectedIndex: 0,
    items: []
  },

  // 4. Modo Video-Wall / Sala de Situación COE
  videoWall: {
    active: false,
    patrolTimer: null,
    patrolIndex: 0
  }
};

// Coordenadas y encuadres de los 17 departamentos de Tucumán
const DEPARTAMENTOS_GEO = {
  'Capital': { center: [-26.8322, -65.2089], zoom: 13 },
  'Yerba Buena': { center: [-26.8167, -65.3167], zoom: 12 },
  'Tafí Viejo': { center: [-26.7333, -65.2667], zoom: 11 },
  'Lules': { center: [-26.9167, -65.3333], zoom: 11 },
  'Famaillá': { center: [-27.0500, -65.4000], zoom: 11 },
  'Monteros': { center: [-27.1681, -65.4989], zoom: 11 },
  'Chicligasta': { center: [-27.3456, -65.5944], zoom: 11 },
  'Río Chico': { center: [-27.4378, -65.6189], zoom: 11 },
  'Juan Bautista Alberdi': { center: [-27.5833, -65.6167], zoom: 11 },
  'La Cocha': { center: [-27.7667, -65.5833], zoom: 11 },
  'Graneros': { center: [-27.6328, -65.2478], zoom: 11 },
  'Simoca': { center: [-27.2644, -65.3556], zoom: 11 },
  'Leales': { center: [-27.1333, -65.3156], zoom: 11 },
  'Cruz Alta': { center: [-26.8500, -65.0500], zoom: 11 },
  'Burruyacú': { center: [-26.5000, -64.9500], zoom: 10 },
  'Trancas': { center: [-26.2333, -65.2833], zoom: 10 },
  'Tafí del Valle': { center: [-26.8639, -65.7139], zoom: 10 }
};

// Diccionario WMO
const WMO_CODES = {
  0: { desc: 'Despejado', icon: '01d', iconNight: '01n' },
  1: { desc: 'Mayormente Despejado', icon: '02d', iconNight: '02n' },
  2: { desc: 'Parcialmente Nublado', icon: '03d', iconNight: '03n' },
  3: { desc: 'Nublado / Cubierto', icon: '04d', iconNight: '04n' },
  45: { desc: 'Niebla', icon: '50d', iconNight: '50n' },
  48: { desc: 'Niebla con Escarcha', icon: '50d', iconNight: '50n' },
  51: { desc: 'Llovizna Ligera', icon: '09d', iconNight: '09n' },
  53: { desc: 'Llovizna Moderada', icon: '09d', iconNight: '09n' },
  55: { desc: 'Llovizna Densa', icon: '09d', iconNight: '09n' },
  61: { desc: 'Lluvia Ligera', icon: '10d', iconNight: '10n' },
  63: { desc: 'Lluvia Moderada', icon: '10d', iconNight: '10n' },
  65: { desc: 'Lluvia Fuerte', icon: '10d', iconNight: '10n' },
  80: { desc: 'Chubascos Aislados', icon: '09d', iconNight: '09n' },
  81: { desc: 'Chubascos Moderados', icon: '09d', iconNight: '09n' },
  82: { desc: 'Chubascos Violentos', icon: '09d', iconNight: '09n' },
  95: { desc: 'Tormenta Eléctrica', icon: '11d', iconNight: '11n' },
  96: { desc: 'Tormenta con Granizo', icon: '11d', iconNight: '11n' }
};

const WIND_DIRS = {
  'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
  'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
  'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
  'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
  'CALMA': 0
};

// -------------------------------------------------------------
// INICIALIZACIÓN DEL FRAMEWORK
// -------------------------------------------------------------
// PERSISTENCIA DE PREFERENCIAS (LOCALSTORAGE)
// -------------------------------------------------------------
function saveUserPreferences() {
  try {
    const prefs = {
      pluginsActive: state.pluginsActive,
      selectedDepartamento: state.selectedDepartamento,
      boundaryWeight: state.boundaryWeight
    };
    localStorage.setItem('geovisor_tucuman_prefs', JSON.stringify(prefs));
  } catch (e) {}
}

function loadUserPreferences() {
  try {
    const raw = localStorage.getItem('geovisor_tucuman_prefs');
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs && prefs.pluginsActive) {
      Object.assign(state.pluginsActive, prefs.pluginsActive);
      const mapCheckboxes = {
        meteo: 'chkPluginMeteo',
        hidro: 'chkPluginHidro',
        salud: 'chkPluginSalud',
        rivers: 'chkPluginRios',
        calor: 'chkPluginCalor',
        rutas: 'chkPluginRutas',
        defensaCivil: 'chkPluginDefensaCivil',
        inundaciones: 'chkPluginInundaciones',
        bomberos: 'chkPluginBomberos',
        incendios: 'chkPluginIncendios',
        presas: 'chkPluginPresas'
      };
      Object.entries(mapCheckboxes).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el && typeof state.pluginsActive[k] === 'boolean') {
          el.checked = state.pluginsActive[k];
          const card = el.closest('.plugin-card');
          if (card) {
            const tag = card.querySelector('.vsc-ext-status-tag');
            if (tag) {
              tag.textContent = el.checked ? 'En Mapa' : 'Desactivado';
              tag.classList.toggle('active', el.checked);
            }
          }
        }
      });
    }
    if (prefs && prefs.selectedDepartamento) {
      state.selectedDepartamento = prefs.selectedDepartamento;
      const sel = document.getElementById('selectDepartamento');
      if (sel) sel.value = prefs.selectedDepartamento;
    }
    if (prefs && prefs.boundaryWeight) {
      state.boundaryWeight = parseFloat(prefs.boundaryWeight);
      const slider = document.getElementById('sliderBoundaryThickness');
      const lbl = document.getElementById('lblBoundaryThickness');
      if (slider) slider.value = state.boundaryWeight;
      if (lbl) lbl.textContent = `${state.boundaryWeight.toFixed(1)}px`;
    }
  } catch (e) {}
}

// -------------------------------------------------------------
// INICIALIZACIÓN DEL FRAMEWORK
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  loadUserPreferences();
  initMap();
  setupUIEvents();
  await loadTucumanBoundary();
  await loadStationsData();
  await loadHidroData();
  await loadSaludData();
  await loadTucumanRivers();
  await loadRutasData();
  await loadDefensaCivilData();
  await loadInundacionesData();
  await loadBomberosData();
  await loadFocosIncendioData();
  await loadPresasData();
  await loadTimelineData();
  calculateRiverContingency();
  preloadHourlyForecasts();
  updateVulnerabilityBadge(state.selectedDepartamento);
  updateLegendDisplay();
  updateClearButtonUI();
});

// Inicializar Mapa Leaflet con capas 100% libres de API key
function initMap() {
  state.map = L.map('map', {
    center: [-26.95, -65.35],
    zoom: 9,
    zoomControl: false,
    attributionControl: true
  });

  L.control.zoom({ position: 'topright' }).addTo(state.map);

  // Capas Base
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(state.map);

  const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  });

  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri, Maxar',
    maxZoom: 18
  });

  const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  });

  const baseLayers = {
    "🗺️ OpenStreetMap": osm,
    "🏙️ Callejero ESRI": esriStreet,
    "🛰️ Satélite HD": esriSatellite,
    "⛰️ Relieve Topográfico": esriTopo
  };

  L.control.layers(baseLayers, null, { position: 'bottomright' }).addTo(state.map);

  // Inicializar grupos de capas modulares
  state.layers.meteo = L.featureGroup();
  state.layers.hidro = L.featureGroup();
  
  // Salud con agrupamiento inteligente de marcadores (Marker Clustering)
  if (typeof L.markerClusterGroup === 'function') {
    state.layers.salud = L.markerClusterGroup({
      disableClusteringAtZoom: 14,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    });
  } else {
    state.layers.salud = L.featureGroup();
  }

  state.layers.rutas = L.featureGroup();
  state.layers.defensaCivil = L.featureGroup();
  state.layers.inundaciones = L.featureGroup();
  state.layers.bomberos = L.featureGroup();
  state.layers.incendios = L.featureGroup();
  state.layers.focosHeatmap = L.layerGroup();
  state.layers.presas = L.featureGroup();
  state.layers.simuladorBuffer = L.featureGroup().addTo(state.map);
  state.layers.timelineStorm = L.featureGroup().addTo(state.map);
}

// Cargar Límite Poligonal Provincial
async function loadTucumanBoundary() {
  try {
    const res = await fetch('tucuman_boundary.json');
    if (!res.ok) return;
    const geojson = await res.json();
    const currentWeight = state.boundaryWeight || 2.2;
    state.boundaryLayer = L.geoJSON(geojson, {
      style: {
        color: '#ea580c',        // Naranja exacto del botón "Reproducir ciclo"
        weight: currentWeight,   // Calibre configurable mediante el deslizador
        opacity: 0.95,           // Alta nitidez
        fillColor: '#ea580c',
        fillOpacity: 0.015,      // Tinte suave muy sutil
        dashArray: '7, 6',       // Línea entrecortada bien definida
        lineCap: 'round',
        lineJoin: 'round',
        className: 'tucuman-boundary-line'
      }
    }).addTo(state.map);
  } catch (err) {
    console.warn('Límite de Tucumán no cargado:', err);
  }
}

// =============================================================
// CARGA Y GESTIÓN DE DATOS DE CADA PLUGIN
// =============================================================

// 1. Cargar Estaciones Meteorológicas (39)
async function loadStationsData(forceRefresh = false) {
  try {
    const url = forceRefresh ? 'api.php?action=refresh' : 'api.php?action=get_stations';
    let data = null;
    try {
      const res = await fetch(url);
      if (res.ok) data = await res.json();
    } catch (e) {}

    if (!data || !data.estaciones) {
      const fallbackRes = await fetch('estaciones_data.json');
      data = await fallbackRes.json();
    }

    if (data && data.estaciones) {
      state.stations = data.estaciones;
      updateHeaderKPIs(data.metadata);
      renderMeteoLayer();
      if (state.pluginsActive.meteo && state.map && !state.map.hasLayer(state.layers.meteo)) {
        state.layers.meteo.addTo(state.map);
      }
    }
  } catch (err) {
    console.error('Error al cargar estaciones meteo:', err);
  }
}

// 2. Cargar Sensores y Caudal de Ríos (Hidrometría INA SIYAH)
async function loadHidroData() {
  try {
    let data = null;
    try {
      const res = await fetch('api.php?action=get_hidro');
      if (res.ok) data = await res.json();
    } catch (e) {}

    if (!data || !Array.isArray(data)) {
      const fallback = await fetch('hidro_ina.json');
      data = await fallback.json();
    }

    if (Array.isArray(data)) {
      state.hidroList = data;
      renderHidroLayer();
      updateHidroMetricsUI();

      if (state.pluginsActive.hidro && !state.map.hasLayer(state.layers.hidro)) {
        state.layers.hidro.addTo(state.map);
      }
    }
  } catch (err) {
    console.warn('Error al cargar datos hidrométricos:', err);
  }
}

// 3. Cargar Efectores de Salud SIPROSA
async function loadSaludData() {
  try {
    const res = await fetch('geolocalizacion.json');
    if (!res.ok) return;
    state.saludList = await res.json();
    renderSaludLayer();
    const badge = document.getElementById('badgeCountSalud');
    if (badge) badge.textContent = `${state.saludList.length} efectores`;
    const btnAll = document.querySelector('[data-filter-salud="all"]');
    if (btnAll) btnAll.textContent = `Todos (${state.saludList.length})`;
  } catch (err) {
    console.warn('Error al cargar geolocalizacion.json:', err);
  }
}

// 4. Cargar Red de Ríos con Líneas Celestes
async function loadTucumanRivers() {
  try {
    const res = await fetch('tucuman_rios.json');
    if (!res.ok) return;
    const geojson = await res.json();

    state.layers.rivers = L.geoJSON(geojson, {
      style: function(f) {
        const isMain = f.properties && f.properties.tipo === 'river';
        return {
          color: '#0284c7', // Línea celeste
          weight: isMain ? 2.4 : 1.5,
          opacity: 0.85
        };
      },
      onEachFeature: function(f, layer) {
        if (f.properties && f.properties.nombre && f.properties.nombre !== 'Curso de agua') {
          layer.bindTooltip(`💧 ${f.properties.nombre}`, { sticky: true });
        }
      }
    });

    if (state.pluginsActive.rivers) {
      state.layers.rivers.addTo(state.map);
    }
  } catch (err) {
    console.warn('Error al cargar ríos:', err);
  }
}

// 5. Cargar Vialidad y Rutas Críticas
async function loadRutasData() {
  try {
    let data = null;
    try {
      const res = await fetch('api.php?action=get_rutas');
      if (res.ok) data = await res.json();
    } catch (e) {}

    if (!data || !Array.isArray(data) || data.length === 0) {
      const fallback = await fetch('modulos/rutas_criticas.json');
      data = await fallback.json();
    }

    if (Array.isArray(data)) {
      state.rutasList = data;
      renderRutasLayer();

      if (state.pluginsActive.rutas && !state.map.hasLayer(state.layers.rutas)) {
        state.layers.rutas.addTo(state.map);
      }
    }
  } catch (err) {
    console.warn('Error al cargar rutas críticas:', err);
  }
}

// 6. Cargar Defensa Civil y Centros de Evacuación
async function loadDefensaCivilData() {
  try {
    let data = null;
    try {
      const res = await fetch('api.php?action=get_defensa_civil');
      if (res.ok) data = await res.json();
    } catch (e) {}

    if (!data || !Array.isArray(data) || data.length === 0) {
      const fallback = await fetch('modulos/defensa_civil.json');
      data = await fallback.json();
    }

    if (Array.isArray(data)) {
      state.defensaCivilList = data;
      renderDefensaCivilLayer();

      if (state.pluginsActive.defensaCivil && !state.map.hasLayer(state.layers.defensaCivil)) {
        state.layers.defensaCivil.addTo(state.map);
      }
    }
  } catch (err) {
    console.warn('Error al cargar defensa civil:', err);
  }
}

// 8. Cargar InundaRisk Sentinel (FloodRisk & Google FloodHub)
async function loadInundacionesData() {
  try {
    let data = null;
    try {
      const res = await fetch('api.php?action=get_inundaciones');
      if (res.ok) data = await res.json();
    } catch (e) {}

    if (!data || !Array.isArray(data) || data.length === 0) {
      const fallback = await fetch('modulos/inundaciones.json');
      data = await fallback.json();
    }

    if (Array.isArray(data)) {
      state.inundacionesList = data;
      renderInundacionesLayer();

      if (state.pluginsActive.inundaciones && !state.map.hasLayer(state.layers.inundaciones)) {
        state.layers.inundaciones.addTo(state.map);
      }
    }
  } catch (err) {
    console.warn('Error al cargar InundaRisk Sentinel:', err);
  }
}

// Cargar Red de Bomberos Voluntarios de Tucumán
async function loadBomberosData() {
  try {
    const res = await fetch('api.php?action=get_bomberos');
    let data = [];
    if (res.ok) {
      data = await res.json();
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      const fallback = await fetch('modulos/bomberos.json');
      if (fallback.ok) data = await fallback.json();
    }

    if (Array.isArray(data)) {
      state.bomberosList = data;
      renderBomberosLayer();

      if (state.pluginsActive.bomberos && state.layers.bomberos && !state.map.hasLayer(state.layers.bomberos)) {
        state.layers.bomberos.addTo(state.map);
      }
      const badge = document.getElementById('badgeCountBomberos');
      if (badge) badge.textContent = `${state.bomberosList.length} cuarteles`;
    }
  } catch (err) {
    console.warn('Error al cargar Bomberos Sentinel:', err);
  }
}

// Cargar Focos de Calor y Anomalías Térmicas NASA FIRMS
async function loadFocosIncendioData() {
  try {
    const res = await fetch('api.php?action=get_focos_incendio');
    let data = [];
    if (res.ok) {
      data = await res.json();
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      const fallback = await fetch('modulos/focos_incendio.json');
      if (fallback.ok) data = await fallback.json();
    }

    if (Array.isArray(data)) {
      state.focosIncendioList = data;
      renderFocosIncendioLayer();

      if (state.pluginsActive.incendios && state.layers.incendios && !state.map.hasLayer(state.layers.incendios)) {
        state.layers.incendios.addTo(state.map);
      }
      const badge = document.getElementById('badgeCountIncendios');
      if (badge) badge.textContent = `${state.focosIncendioList.length} focos FIRMS`;
    }
  } catch (err) {
    console.warn('Error al cargar PyroScan Sentinel:', err);
  }
}

// Cargar Presas y Riesgo Hidrológico (ORSEP & Obras Hidráulicas)
async function loadPresasData() {
  try {
    let data = null;
    try {
      const res = await fetch('api.php?action=get_presas');
      if (res.ok) data = await res.json();
    } catch (e) {}

    if (!data || (!Array.isArray(data) && !Array.isArray(data.obras))) {
      const fallback = await fetch('modulos/presas_tucuman.json');
      if (fallback.ok) data = await fallback.json();
    }

    const obras = Array.isArray(data) ? data : (data && Array.isArray(data.obras) ? data.obras : []);
    if (Array.isArray(obras) && obras.length > 0) {
      state.presasList = obras;
      renderPresasLayer();

      if (state.pluginsActive.presas && state.layers.presas && !state.map.hasLayer(state.layers.presas)) {
        state.layers.presas.addTo(state.map);
      }
      const badge = document.getElementById('badgeCountPresas');
      if (badge) badge.textContent = `${state.presasList.length} obras`;
    }
  } catch (err) {
    console.warn('Error al cargar Presas y Riesgo Hidrológico:', err);
  }
}

// Renderizar Marcadores de Presas y Obras Hidráulicas
function renderPresasLayer() {
  if (!state.layers.presas) return;
  state.layers.presas.clearLayers();

  const filtered = state.presasList.filter(item => {
    if (state.filterPresaTipo === 'all') return true;
    if (state.filterPresaTipo === 'presa') return (item.tipo || '').toLowerCase().includes('presa');
    if (state.filterPresaTipo === 'derivador') return (item.tipo || '').toLowerCase().includes('derivador');
    if (state.filterPresaTipo === 'orsep') return item.fiscalizado_orsep === true;
    return true;
  });

  filtered.forEach(item => {
    if (!item.latitud || !item.longitud) return;
    const originalIndex = state.presasList.indexOf(item);
    const isDerivador = (item.tipo || '').toLowerCase().includes('derivador');
    const isPendingCoord = (item.coordenada_estado || '').toLowerCase().includes('pendiente');

    const icon = L.divIcon({
      className: 'custom-presa-pin',
      html: `
        <div class="presa-marker-pin ${isDerivador ? 'derivador' : ''} ${isPendingCoord ? 'coord-referencia' : ''}" title="${item.nombre} (${item.tipo})">
          <span>${isDerivador ? '🔀' : '🏗️'}</span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });

    const marker = L.marker([item.latitud, item.longitud], { icon });

    const popupContent = `
      <div class="popup-station-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="badge-presa-tipo">${item.tipo}</span>
          ${item.fiscalizado_orsep ? '<span class="badge-orsep-verified">✓ ORSEP</span>' : ''}
        </div>
        <h3 style="margin:2px 0 3px 0; font-size:0.95rem; color:#0f172a; line-height:1.2;">${item.nombre}</h3>
        <div style="font-size:0.75rem; color:#0369a1; font-weight:700; margin-bottom:4px;">
          ${item.alias ? 'Alias: ' + item.alias + ' · ' : ''}Complejo ${item.complejo}
        </div>
        <p style="font-size:0.75rem; color:#475569; margin-bottom:4px;">
          📍 <strong>${item.departamento}</strong> (${item.localidad_referencial})<br>
          🌊 <strong>${item.rio}</strong> · Cuenca ${item.cuenca}
        </p>
        <div style="font-size:0.72rem; color:#1e293b; background:#f0f9ff; border:1px solid #bae6fd; padding:6px; border-radius:6px; margin:0 0 6px 0;">
          ${item.altura_m ? `📏 Altura: <strong>${item.altura_m} m</strong> · ` : ''}
          ${item.capacidad_embalse_hm3 ? `💧 Embalse: <strong>${item.capacidad_embalse_hm3} hm³</strong><br>` : ''}
          ${item.capacidad_vertedero_m3s ? `⚡ Vertedero: <strong>${item.capacidad_vertedero_m3s} m³/s</strong><br>` : ''}
          🏢 Operador: <strong>${item.operador}</strong>
        </div>
        <div style="display:flex; gap:6px; margin-bottom:4px;">
          <button onclick="window.inspectEntity('presas', ${originalIndex})" style="flex:1.2; background:#0284c7; border:none; color:#fff; padding:6px 8px; border-radius:6px; font-size:0.72rem; font-weight:700; cursor:pointer;">
            Ver Ficha Técnica →
          </button>
          ${item.fuente_url ? `
            <a href="${item.fuente_url}" target="_blank" style="flex:1; text-align:center; background:#0f172a; color:#fff; text-decoration:none; padding:6px 8px; border-radius:6px; font-size:0.72rem; font-weight:700;">
              🏛️ Fuente ORSEP
            </a>
          ` : ''}
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 280 });
    marker.on('click', () => {
      inspectEntity('presas', originalIndex);
    });
    state.layers.presas.addLayer(marker);
  });
}

// Renderizar Marcadores de Rutas Críticas
function renderRutasLayer() {
  if (!state.layers.rutas) return;
  state.layers.rutas.clearLayers();

  state.rutasList.forEach((r, idx) => {
    if (!r.lat || !r.lon) return;
    const color = r.color_estado || '#f59e0b';
    const html = `
      <div class="pin-container" style="filter:drop-shadow(0 3px 8px rgba(217, 119, 6, 0.35));">
        <div class="pin-badge" style="border-color:${color}; color:#9a3412; font-weight:800; font-size:0.68rem;">
          <span class="pin-dot" style="background:${color};"></span>
          <span>🛣️ ${r.ruta.replace('Ruta ', '')}</span>
        </div>
        <div class="pin-needle" style="background:${color};"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-rutas-pin',
      html: html,
      iconSize: [66, 40],
      iconAnchor: [33, 40],
      popupAnchor: [0, -36]
    });

    const marker = L.marker([r.lat, r.lon], { icon: icon });
    marker.rutaId = r.id;
    marker.bindPopup(`
      <div class="popup-station-card">
        <div style="font-size:0.68rem; font-weight:700; color:${color}; text-transform:uppercase;">${r.ruta} • ${r.km}</div>
        <h3 style="margin:2px 0 4px 0; font-size:0.92rem;">${r.nombre}</h3>
        <p style="font-size:0.75rem; color:#475569; margin-bottom:6px;">${r.tipo} · <strong>Estado: ${r.estado_transito}</strong></p>
        <p style="font-size:0.72rem; color:#64748b; background:#f8fafc; padding:6px; border-radius:6px; margin:0 0 6px 0;">${r.observacion}</p>
        <button onclick="window.inspectEntity('rutas', ${idx})" style="width:100%; background:#d97706; border:none; color:#fff; padding:5px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
          Ver Ficha del Paso Vial
        </button>
      </div>
    `);
    marker.on('click', () => { inspectEntity('rutas', idx); });
    state.layers.rutas.addLayer(marker);
  });
}

// Renderizar Marcadores de Defensa Civil
function renderDefensaCivilLayer() {
  if (!state.layers.defensaCivil) return;
  state.layers.defensaCivil.clearLayers();

  state.defensaCivilList.forEach((d, idx) => {
    if (!d.lat || !d.lon) return;
    const html = `
      <div class="pin-container" style="filter:drop-shadow(0 3px 8px rgba(220, 38, 38, 0.35));">
        <div class="pin-badge" style="border-color:#dc2626; color:#991b1b; font-weight:800; font-size:0.68rem;">
          <span class="pin-dot" style="background:#dc2626;"></span>
          <span>🛡️ ${d.capacidad_personas}p</span>
        </div>
        <div class="pin-needle" style="background:#dc2626;"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-defensa-pin',
      html: html,
      iconSize: [60, 40],
      iconAnchor: [30, 40],
      popupAnchor: [0, -36]
    });

    const marker = L.marker([d.lat, d.lon], { icon: icon });
    marker.bindPopup(`
      <div class="popup-station-card">
        <div style="font-size:0.68rem; font-weight:700; color:#dc2626; text-transform:uppercase;">Defensa Civil • ${d.departamento}</div>
        <h3 style="margin:2px 0 4px 0; font-size:0.92rem;">${d.nombre}</h3>
        <p style="font-size:0.75rem; color:#475569; margin-bottom:4px;">${d.tipo} · <strong>Capacidad: ${d.capacidad_personas} personas</strong></p>
        <p style="font-size:0.72rem; color:#1e293b; margin:0 0 6px 0;">📞 Tel: <strong>${d.telefono}</strong> (${d.responsable})</p>
        <button onclick="window.inspectEntity('defensaCivil', ${idx})" style="width:100%; background:#dc2626; border:none; color:#fff; padding:5px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
          Ver Ficha del Refugio
        </button>
      </div>
    `);
    marker.on('click', () => { inspectEntity('defensaCivil', idx); });
    state.layers.defensaCivil.addLayer(marker);
  });
}

// Renderizar Marcadores de Inundaciones y Crecidas (FloodRisk & Google FloodHub)
function renderInundacionesLayer() {
  if (!state.layers.inundaciones) return;
  state.layers.inundaciones.clearLayers();

  const filtered = state.inundacionesList.filter(item => {
    if (state.filterInundacionRiesgo === 'all') return true;
    if (state.filterInundacionRiesgo === 'extremo') return item.nivel_riesgo.toLowerCase().includes('extremo');
    if (state.filterInundacionRiesgo === 'alto') return item.nivel_riesgo.toLowerCase().includes('alto');
    if (state.filterInundacionRiesgo === 'moderado') return item.nivel_riesgo.toLowerCase().includes('moderado');
    return true;
  });

  filtered.forEach(item => {
    if (!item.lat || !item.lon) return;
    const originalIndex = state.inundacionesList.indexOf(item);
    const color = item.color_riesgo || '#dc2626';

    const html = `
      <div class="pin-container" style="filter:drop-shadow(0 3px 8px ${color}66);">
        <div class="pin-badge" style="border-color:${color}; color:#fff; background:${color}; font-weight:800; font-size:0.68rem; padding:3px 7px; border-radius:12px;">
          <span class="pin-dot" style="background:#fff;"></span>
          <span>🌊 ${item.nivel_riesgo.replace('Riesgo ', '')}</span>
        </div>
        <div class="pin-needle" style="background:${color};"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-inundaciones-pin',
      html: html,
      iconSize: [82, 42],
      iconAnchor: [41, 42],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([item.lat, item.lon], { icon: icon });
    marker.bindPopup(`
      <div class="popup-station-card">
        <div style="font-size:0.68rem; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:0.3px;">FloodRisk & Google FloodHub • ${item.departamento}</div>
        <h3 style="margin:2px 0 4px 0; font-size:0.92rem; color:#0f172a;">${item.nombre}</h3>
        <p style="font-size:0.75rem; color:#475569; margin-bottom:4px;">Río / Cauce: <strong>${item.rio_principal}</strong></p>
        <p style="font-size:0.72rem; color:#1e293b; background:#f0f9ff; border:1px solid #bae6fd; padding:6px; border-radius:6px; margin:0 0 6px 0;">
          📊 <strong>${item.frecuencia_satelital}</strong><br>
          <small style="color:#64748b;">${item.observacion}</small>
        </p>
        <div style="display:flex; gap:4px; margin-bottom:6px;">
          <a href="${item.google_floodhub_url}" target="_blank" style="flex:1; text-align:center; background:#4285f4; color:#fff; text-decoration:none; padding:4px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">
            🌐 Google FloodHub
          </a>
          <a href="${item.floodrisk_url}" target="_blank" style="flex:1; text-align:center; background:#0f172a; color:#fff; text-decoration:none; padding:4px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">
            🌊 FloodRisk.com.ar
          </a>
        </div>
        <button onclick="window.inspectEntity('inundaciones', ${originalIndex})" style="width:100%; background:${color}; border:none; color:#fff; padding:6px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
          Ver Ficha Completa de Riesgo
        </button>
      </div>
    `);
    marker.on('click', () => { inspectEntity('inundaciones', originalIndex); });
    state.layers.inundaciones.addLayer(marker);
  });
}

// Renderizar Marcadores de Bomberos Voluntarios
function renderBomberosLayer() {
  if (!state.layers.bomberos) return;
  state.layers.bomberos.clearLayers();

  const filtered = state.bomberosList.filter(item => {
    if (state.filterBomberoEstado === 'all') return true;
    if (state.filterBomberoEstado === 'verificado') return item.estado && item.estado.toLowerCase() === 'verificado';
    if (state.filterBomberoEstado === 'pendiente') return item.estado && item.estado.toLowerCase() === 'pendiente';
    return true;
  });

  filtered.forEach(item => {
    if (!item.latitud || !item.longitud) return;
    const originalIndex = state.bomberosList.indexOf(item);
    const isPending = item.estado && item.estado.toLowerCase() === 'pendiente';

    const icon = L.divIcon({
      className: 'custom-bombero-pin',
      html: `
        <div class="bombero-marker-pin ${isPending ? 'pending' : ''}">
          <span>👨‍🚒</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const marker = L.marker([item.latitud, item.longitud], { icon });
    const phoneCall = item.telefono ? item.telefono.split('/')[0].trim() : '100';

    const popupContent = `
      <div class="popup-station-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="${isPending ? 'badge-bombero-pending' : 'badge-bombero-verified'}">${item.estado || 'VERIFICADO'}</span>
          <span style="font-size:0.68rem; font-weight:700; color:#b91c1c; text-transform:uppercase;">Bomberos Voluntarios</span>
        </div>
        <h3 style="margin:2px 0 4px 0; font-size:0.92rem; color:#0f172a; line-height:1.2;">${item.nombre}</h3>
        <p style="font-size:0.75rem; color:#475569; margin-bottom:4px;">
          📍 <strong>${item.localidad || 'Tucumán'}</strong> · ${item.direccion || 'Dirección en trámite'}
        </p>
        <p style="font-size:0.72rem; color:#1e293b; background:#fef2f2; border:1px solid #fecaca; padding:6px; border-radius:6px; margin:0 0 6px 0;">
          📞 Emergencias: <strong style="color:#b91c1c;">${item.telefono || '100 / 103'}</strong><br>
          <small style="color:#64748b;">${item.observaciones || 'Cuartel operativo de bomberos voluntarios.'}</small>
        </p>
        <div style="display:flex; gap:6px; margin-bottom:6px;">
          <a href="tel:${phoneCall}" style="flex:1; text-align:center; background:#dc2626; color:#fff; text-decoration:none; padding:5px 8px; border-radius:6px; font-size:0.72rem; font-weight:700;">
            📞 Llamar (${phoneCall})
          </a>
          <button onclick="window.inspectEntity('bomberos', ${originalIndex})" style="flex:1.4; background:#0f172a; border:none; color:#fff; padding:5px 8px; border-radius:6px; font-size:0.72rem; font-weight:700; cursor:pointer;">
            Ver Ficha Completa →
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 260 });
    marker.on('click', () => {
      inspectEntity('bomberos', originalIndex);
    });
    state.layers.bomberos.addLayer(marker);
  });
}

// Renderizar Marcadores de Focos de Calor (PyroScan Sentinel)
function renderFocosIncendioLayer() {
  if (!state.layers.incendios || !state.layers.focosHeatmap) return;
  state.layers.incendios.clearLayers();
  state.layers.focosHeatmap.clearLayers();

  const tucumanFocosList = state.focosIncendioList.filter(item => {
    const lat = item.latitude || item.lat;
    const lon = item.longitude || item.lon;
    if (lat && lon) return (lat >= -28.02 && lat <= -26.04) && (lon >= -66.18 && lon <= -64.48);
    return true;
  });

  if (state.pyroDisplayMode === 'heatmap') {
    // Modo Mapa de Densidad (Heatmap por FRP MW)
    if (state.map.hasLayer(state.layers.incendios)) state.map.removeLayer(state.layers.incendios);
    if (!state.map.hasLayer(state.layers.focosHeatmap)) state.layers.focosHeatmap.addTo(state.map);

    const heatPoints = [];
    tucumanFocosList.forEach(item => {
      if (!item.latitude || !item.longitude) return;
      const intensity = Math.max(0.3, Math.min(1.0, (item.frp_mw || 10) / 45));
      heatPoints.push([item.latitude, item.longitude, intensity]);
    });

    if (typeof L.heatLayer === 'function') {
      const hLayer = L.heatLayer(heatPoints, {
        radius: 35,
        blur: 25,
        maxZoom: 14,
        gradient: { 0.2: '#fef08a', 0.5: '#f97316', 0.85: '#ef4444', 1.0: '#b91c1c' }
      });
      state.layers.focosHeatmap.addLayer(hLayer);
    }
    return;
  }

  // Modo Puntos de Confianza
  if (state.map.hasLayer(state.layers.focosHeatmap)) state.map.removeLayer(state.layers.focosHeatmap);
  if (state.pluginsActive.incendios && !state.map.hasLayer(state.layers.incendios)) state.layers.incendios.addTo(state.map);

  const filtered = tucumanFocosList.filter(item => {
    if (state.filterPyroConfidence === 'all') return true;
    if (state.filterPyroConfidence === 'high') return item.confidence.toLowerCase() === 'alta';
    if (state.filterPyroConfidence === 'nominal') return item.confidence.toLowerCase() === 'nominal';
    if (state.filterPyroConfidence === 'low') return item.confidence.toLowerCase() === 'baja';
    return true;
  });

  filtered.forEach(item => {
    if (!item.latitude || !item.longitude) return;
    const originalIndex = state.focosIncendioList.indexOf(item);
    const confLower = item.confidence.toLowerCase();
    const pinClass = confLower === 'alta' ? '' : (confLower === 'nominal' ? 'nominal' : 'low');
    const badgeClass = confLower === 'alta' ? 'badge-pyro-high' : (confLower === 'nominal' ? 'badge-pyro-nominal' : 'badge-pyro-low');

    const icon = L.divIcon({
      className: 'custom-pyro-pin',
      html: `
        <div class="pyro-marker-pin ${pinClass}">
          <span>🔥</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const marker = L.marker([item.latitude, item.longitude], { icon });

    const popupContent = `
      <div style="font-family:'Outfit',sans-serif; width:230px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="${badgeClass}">Confianza ${item.confidence} (${item.confidence_pct}%)</span>
          <span style="font-size:0.68rem; font-weight:700; color:#ea580c; text-transform:uppercase;">NASA FIRMS</span>
        </div>
        <strong style="display:block; font-size:0.92rem; color:#0f172a; margin-bottom:4px; line-height:1.2;">Foco de Calor en ${item.departamento}</strong>
        <div style="font-size:0.75rem; color:#475569; margin-bottom:6px;">
          🔥 FRP: <strong>${item.frp_mw} MW</strong> · Temp Brillo: <strong>${item.brightness_temp_c}°C</strong><br>
          🛰️ Satélite: ${item.satellite} (${item.detection_date})
        </div>
        <button onclick="window.inspectEntity('incendios', ${originalIndex})" style="width:100%; background:#ea580c; color:#fff; border:none; padding:6px; border-radius:6px; font-weight:600; font-size:0.75rem; cursor:pointer;">
          Ver Ficha de Anomalía Térmica →
        </button>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 250 });
    marker.on('click', () => { inspectEntity('incendios', originalIndex); });
    state.layers.incendios.addLayer(marker);
  });
}

// 7. Cruzamiento Geoespacial de Contingencia: Ríos en Alerta vs. Efectores de Salud en Proximidad (< 2.5 km)
function calculateRiverContingency() {
  const container = document.getElementById('contingencyList');
  if (!container) return;

  if (!state.hidroList || state.hidroList.length === 0 || !state.saludList || state.saludList.length === 0) {
    container.innerHTML = '<div style="font-size:0.72rem; color:#64748b;">Esperando telemetría...</div>';
    return;
  }

  const alertRivers = state.hidroList.filter(h => {
    if (h.es_tucuman === false || (h.provincia && h.provincia !== 'Tucumán')) return false;
    return (h.altura_m !== null && h.altura_m >= 2.4) ||
           h.tendencia === 'crece' ||
           (h.nivel_alerta && (h.nivel_alerta.includes('Alerta') || h.nivel_alerta.includes('Alza')));
  });

  if (alertRivers.length === 0) {
    container.innerHTML = `
      <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:7px 10px; font-size:0.72rem; color:#065f46;">
        ✅ <strong>Sin aforos en alerta hídrica</strong><br>
        Todos los cauces se encuentran en niveles estables o regulares.
      </div>
    `;
    return;
  }

  const proximityMatches = [];
  alertRivers.forEach(r => {
    if (!r.lat || !r.lon) return;
    state.saludList.forEach((s, sIdx) => {
      if (!s.latitud || !s.longitud) return;
      const dist = calculateDistance(r.lat, r.lon, s.latitud, s.longitud);
      if (dist <= 2.5) {
        proximityMatches.push({
          river: r.rio || r.nombre,
          riverLvl: r.altura_m,
          riverTrend: r.tendencia,
          efector: s.efector,
          distKm: dist.toFixed(2),
          lat: s.latitud,
          lon: s.longitud,
          saludIdx: sIdx
        });
      }
    });
  });

  if (proximityMatches.length === 0) {
    container.innerHTML = `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:7px 10px; font-size:0.72rem; color:#92400e;">
        ⚠️ <strong>${alertRivers.length} aforo(s) en vigilancia</strong> (${alertRivers.map(r => r.rio || r.nombre).join(', ')}), sin centros de salud a menos de 2.5 km de la estación de aforo.
      </div>
    `;
    return;
  }

  container.innerHTML = proximityMatches.slice(0, 6).map(m => `
    <div class="contingency-item" onclick="window.inspectEntity('salud', ${m.saludIdx}); state.map.flyTo([${m.lat}, ${m.lon}], 15);" title="Inspeccionar efector cercano">
      <div class="contingency-header">
        <span class="contingency-title">${m.efector}</span>
        <span class="contingency-dist">${m.distKm} km</span>
      </div>
      <div class="contingency-sub">
        Cauce: <strong>${m.river}</strong> (${m.riverLvl !== null ? m.riverLvl + 'm' : '--'} · ${m.riverTrend === 'crece' ? '🔺 Crecida' : 'Vigilancia'})
      </div>
    </div>
  `).join('');
}

// =============================================================
// RENDERIZADO DE CAPAS MODULARES EN EL MAPA
// =============================================================

// Renderizar Marcadores Meteorológicos
function renderMeteoLayer() {
  state.layers.meteo.clearLayers();

  const filtered = state.stations.filter(st => {
    if (state.filterMeteoOrg !== 'all' && st.organismo !== state.filterMeteoOrg) return false;
    return true;
  });

  filtered.forEach(st => {
    const orgClass = (st.organismo || 'eeaoc').toLowerCase();
    let badgeText = st.organismo;
    if (st.telemetria_oficial && st.telemetria_oficial.temperatura_c !== null) {
      badgeText = `${st.telemetria_oficial.temperatura_c}°`;
    }

    const html = `
      <div class="pin-container ${orgClass}">
        <div class="pin-badge">
          <span class="pin-dot"></span>
          <span>${badgeText}</span>
        </div>
        <div class="pin-needle"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-station-pin',
      html: html,
      iconSize: [58, 42],
      iconAnchor: [29, 42],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([st.lat, st.lon], { icon: icon });
    marker.baseTemp = (st.telemetria_oficial && st.telemetria_oficial.temperatura_c !== null) ? parseFloat(st.telemetria_oficial.temperatura_c) : (st.temperatura_estimada || 18.0);
    marker.stationId = st.id;

    marker.bindPopup(`
      <div class="popup-station-card">
        <div style="font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase;">${st.organismo} • ID ${st.id}</div>
        <h3>${st.nombre}</h3>
        <p>${st.localidad || ''}, ${st.departamento || ''} • ${st.altitud_m} msnm</p>
        <button onclick="window.inspectEntity('meteo', '${st.id}')" style="width:100%; background:#e0f2fe; border:1px solid #bae6fd; color:#0284c7; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer; margin-top:4px;">
          Ver Información en Panel
        </button>
      </div>
    `, { closeButton: false });

    marker.on('click', () => {
      inspectEntity('meteo', st.id);
    });

    state.layers.meteo.addLayer(marker);
  });
}

// Renderizar Marcadores de Sensores y Caudal de Ríos (INA SIYAH)
function renderHidroLayer() {
  state.layers.hidro.clearLayers();

  const filtered = state.hidroList.filter(h => {
    // Filtrado territorial estricto: Provincia de Tucumán
    if (h.es_tucuman === false || (h.provincia && h.provincia !== 'Tucumán')) return false;
    const lat = h.lat || h.latitud;
    const lon = h.lon || h.longitud;
    if (lat && lon && !(lat >= -28.02 && lat <= -26.04 && lon >= -66.18 && lon <= -64.48)) return false;

    if (state.filterHidroTendencia === 'all') return true;
    if (state.filterHidroTendencia === 'crece') return h.tendencia === 'crece' || (h.nivel_alerta && h.nivel_alerta.includes('Alerta'));
    if (state.filterHidroTendencia === 'baja') return h.tendencia === 'baja';
    if (state.filterHidroTendencia === 'permanece') return h.tendencia === 'permanece' || h.tendencia === 'estable';
    return true;
  });

  filtered.forEach(h => {
    if (!h.lat || !h.lon) return;
    const originalIndex = state.hidroList.indexOf(h);

    const alt = h.altura_m ?? 0;
    const isCrecida = alt >= 3.0 || h.nivel_alerta === 'Alerta Crecida';
    const isAlza = h.tendencia === 'crece' || h.nivel_alerta === 'Caudal en Alza';
    const isBajante = h.tendencia === 'baja' || h.nivel_alerta === 'En Bajante';

    let alertClass = 'alert-normal';
    if (isCrecida) alertClass = 'alert-crecida';
    else if (isAlza) alertClass = 'alert-alza';
    else if (isBajante) alertClass = 'alert-bajante';

    const tendIcon = h.tendencia === 'crece' ? '🔺' : (h.tendencia === 'baja' ? '🔻' : '⏸️');
    const alturaStr = h.altura_m !== null && h.altura_m !== undefined ? `${h.altura_m}m` : '--';
    const pulseHtml = (isCrecida || isAlza) ? '<div class="pin-pulse-alert"></div>' : '';

    const html = `
      <div class="pin-container hidro ${alertClass}">
        <div class="pin-badge">
          ${pulseHtml}
          <span class="pin-dot"></span>
          <span>${alturaStr} ${tendIcon}</span>
        </div>
        <div class="pin-needle"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-hidro-pin',
      html: html,
      iconSize: [68, 42],
      iconAnchor: [34, 42],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([h.lat, h.lon], { icon: icon });

    const varStr = (h.variacion_m !== null && h.variacion_m !== undefined) ? `${h.variacion_m > 0 ? '+' : ''}${h.variacion_m}m` : '0.00m';
    const caudalStr = h.caudal_estimado_m3s !== undefined ? `${h.caudal_estimado_m3s} m³/s` : '-- m³/s';

    marker.bindPopup(`
      <div class="popup-station-card">
        <div style="font-size:0.68rem; font-weight:700; color:#0284c7; text-transform:uppercase; letter-spacing:0.3px;">Sensor de Río • INA SIYAH</div>
        <h3 style="margin:2px 0; font-size:0.92rem;">${h.rio || h.nombre}</h3>
        ${h.tramo ? `<p style="color:#64748b; font-size:0.72rem; margin-bottom:4px;">Tramo: <strong>${h.tramo}</strong></p>` : ''}
        
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f0f9ff; border:1px solid #bae6fd; padding:6px 8px; border-radius:6px; margin:6px 0;">
          <div>
            <div style="font-size:0.62rem; color:#64748b; text-transform:uppercase; font-weight:700;">Nivel de Agua</div>
            <div style="font-size:1.15rem; font-weight:850; color:#0284c7;">${alturaStr}</div>
            <div style="font-size:0.65rem; color:#64748b;">Var: ${varStr}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.62rem; color:#64748b; text-transform:uppercase; font-weight:700;">Caudal Est.</div>
            <div style="font-size:1.15rem; font-weight:850; color:#0369a1;">${caudalStr}</div>
            <div style="font-size:0.65rem; color:${h.color_alerta || '#10b981'}; font-weight:700;">${h.nivel_alerta || 'Normal'}</div>
          </div>
        </div>

        <button onclick="window.inspectEntity('hidro', ${originalIndex})" style="width:100%; background:#0284c7; border:none; color:#ffffff; padding:6px 10px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer; margin-top:2px;">
          🌊 Inspeccionar Caudal y Dinámica
        </button>
      </div>
    `, { closeButton: false });

    marker.on('click', () => {
      inspectEntity('hidro', originalIndex);
    });

    state.layers.hidro.addLayer(marker);
  });
}

// Renderizar Efectores de Salud SIPROSA
// Renderizar Efectores de Salud SIPROSA
function renderSaludLayer() {
  state.layers.salud.clearLayers();
  state.saludMarkers = state.saludMarkers || {};

  state.saludList.forEach((s, origIdx) => {
    s._origIndex = origIdx;
  });

  const filtered = state.saludList.filter(s => {
    if (!s.latitud || !s.longitud) return false;
    const nom = s.efector.toUpperCase();
    if (state.filterSaludTipo === 'hosp') return nom.includes('HOSPITAL');
    if (state.filterSaludTipo === 'caps') return nom.includes('CAPS') || nom.includes('POLICLINICA');
    if (state.filterSaludTipo === '107') return nom.includes('107') || nom.includes('URGENCIAS');
    return true;
  });

  filtered.forEach(s => {
    const origIndex = s._origIndex !== undefined ? s._origIndex : state.saludList.indexOf(s);
    let tipoShort = 'CAPS';
    const nomUpper = s.efector.toUpperCase();
    if (nomUpper.includes('HOSPITAL')) tipoShort = 'Hosp';
    else if (nomUpper.includes('107')) tipoShort = '107';

    const isBlinking = (state.blinkingSaludIndex === origIndex);

    const html = `
      <div class="pin-container salud ${isBlinking ? 'efector-parpadeo' : ''}" data-salud-index="${origIndex}">
        <div class="pin-badge">
          <span class="pin-dot"></span>
          <span>${tipoShort}</span>
        </div>
        <div class="pin-needle"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: `custom-salud-pin ${isBlinking ? 'pin-marker-blinking' : ''}`,
      html: html,
      iconSize: [52, 38],
      iconAnchor: [26, 38],
      popupAnchor: [0, -34]
    });

    const marker = L.marker([s.latitud, s.longitud], { icon: icon });
    marker._saludIndex = origIndex;
    marker._saludData = s;
    state.saludMarkers[origIndex] = marker;

    marker.bindPopup(`
      <div class="popup-station-card">
        <div style="font-size:0.68rem; font-weight:700; color:#e11d48; text-transform:uppercase;">Efector de Salud SIPROSA</div>
        <h3>${s.efector}</h3>
        <button onclick="window.inspectEntity('salud', '${origIndex}', false)" style="width:100%; background:#ffe4e6; border:1px solid #fecdd3; color:#e11d48; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer; margin-top:4px;">
          Ver Ficha Sanitaria
        </button>
      </div>
    `, { closeButton: false });

    marker.on('click', () => {
      // Detener parpadeo si este efector estaba parpadeando
      if (state.blinkingSaludIndex === origIndex || state.currentBlinkingMarker === marker) {
        clearEfectorHighlight();
      }
      inspectEntity('salud', origIndex, false);
    });

    state.layers.salud.addLayer(marker);
  });
}

// =============================================================
// RESALTADO Y BALIZA RADAR DE EFECTOR EN EL MAPA
// =============================================================
window.highlightEfectorOnMap = function(idOrIndex) {
  const numericIndex = parseInt(idOrIndex, 10);
  const s = state.saludList[numericIndex];
  if (!s || !s.latitud || !s.longitud) {
    console.warn('Efector no válido o sin coordenadas:', idOrIndex, s);
    return;
  }

  // 1. Limpiar cualquier parpadeo previo
  clearEfectorHighlight();

  // 2. Si las marcas estaban ocultas con "Limpiar Mapa", reactivarlas
  if (state.mapLayersHidden) {
    state.mapLayersHidden = false;
    updateClearButtonUI();
  }

  // 3. Si el filtro de salud no está en 'all', restablecer a 'all' para asegurar que el efector esté en el mapa
  if (state.filterSaludTipo !== 'all') {
    state.filterSaludTipo = 'all';
    document.querySelectorAll('[data-filter-salud]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter-salud') === 'all');
    });
    renderSaludLayer();
  }

  // 4. Si el plugin de salud está inactivo o la capa no está en el mapa, activarla
  if (!state.map.hasLayer(state.layers.salud)) {
    state.map.addLayer(state.layers.salud);
    state.pluginsActive.salud = true;
    updatePluginUIStatus('chkPluginSalud', true);
    if (typeof updateLegendDisplay === 'function') updateLegendDisplay();
    saveUserPreferences();
  }

  // 5. Registrar índice que está parpadeando
  state.blinkingSaludIndex = numericIndex;

  // 6. Baliza interactiva con ondas de sonar concéntricas y cartel flotante directamente en state.map
  const beaconHtml = `
    <div class="efector-radar-beacon" title="Haz clic sobre el efector para seleccionarlo y detener el parpadeo">
      <div class="beacon-sonar-wave wave-1"></div>
      <div class="beacon-sonar-wave wave-2"></div>
      <div class="beacon-sonar-wave wave-3"></div>
      <div class="beacon-center-dot"></div>
      <div class="beacon-floating-tag">
        <span class="beacon-tag-icon">🏥</span>
        <span class="beacon-tag-name">${s.efector}</span>
        <span class="beacon-tag-hint">Clic para ver</span>
      </div>
    </div>
  `;

  const beaconIcon = L.divIcon({
    className: 'custom-efector-beacon-wrap',
    html: beaconHtml,
    iconSize: [140, 140],
    iconAnchor: [70, 70]
  });

  const beaconMarker = L.marker([s.latitud, s.longitud], {
    icon: beaconIcon,
    zIndexOffset: 999999,
    interactive: true
  });

  // Al hacer clic en la baliza o su etiqueta, detener el parpadeo e inspeccionar
  beaconMarker.on('click', (e) => {
    if (e && e.originalEvent) e.originalEvent.stopPropagation();
    clearEfectorHighlight();
    inspectEntity('salud', numericIndex, false);
    const m = state.saludMarkers ? state.saludMarkers[numericIndex] : null;
    if (m) m.openPopup();
  });

  beaconMarker.addTo(state.map);
  state.efectorHighlightBeacon = beaconMarker;

  // 7. Volar de forma directa y garantizada al efector (zoom 16 para desagrupar clusters)
  state.map.flyTo([s.latitud, s.longitud], 16, { animate: true, duration: 0.8 });

  // 8. Aplicar la clase de parpadeo al marcador del efector cuando esté visible en el DOM
  function applyPinPulse() {
    const m = state.saludMarkers ? state.saludMarkers[numericIndex] : null;
    if (m) {
      state.currentBlinkingMarker = m;
      m.setZIndexOffset(99999);
      const el = m.getElement();
      if (el) {
        el.classList.add('pin-marker-blinking');
        const pinContainer = el.querySelector('.pin-container');
        if (pinContainer) pinContainer.classList.add('efector-parpadeo');
      }
    }
  }

  applyPinPulse();
  state.map.once('moveend', applyPinPulse);
  setTimeout(applyPinPulse, 500);
  setTimeout(applyPinPulse, 1000);

  showToast(`📍 Efector localizado: ${s.efector} (parpadeando en mapa)`);
};

window.clearEfectorHighlight = function() {
  if (state.blinkingSaludIndex !== null && state.blinkingSaludIndex !== undefined) {
    const marker = state.saludMarkers ? state.saludMarkers[state.blinkingSaludIndex] : null;
    if (marker) {
      marker.setZIndexOffset(0);
      const el = marker.getElement();
      if (el) {
        el.classList.remove('pin-marker-blinking');
        const pinContainer = el.querySelector('.pin-container');
        if (pinContainer) pinContainer.classList.remove('efector-parpadeo');
      }
    }
  }

  if (state.currentBlinkingMarker) {
    state.currentBlinkingMarker.setZIndexOffset(0);
    const el = state.currentBlinkingMarker.getElement();
    if (el) {
      el.classList.remove('pin-marker-blinking');
      const pinContainer = el.querySelector('.pin-container');
      if (pinContainer) pinContainer.classList.remove('efector-parpadeo');
    }
    state.currentBlinkingMarker = null;
  }

  if (state.efectorHighlightBeacon) {
    try {
      state.map.removeLayer(state.efectorHighlightBeacon);
    } catch (e) {}
    state.efectorHighlightBeacon = null;
  }

  // Por seguridad adicional, limpiar cualquier remanente en el DOM
  document.querySelectorAll('.custom-efector-beacon-wrap').forEach(el => el.remove());
  document.querySelectorAll('.efector-parpadeo').forEach(el => el.classList.remove('efector-parpadeo'));
  document.querySelectorAll('.pin-marker-blinking').forEach(el => el.classList.remove('pin-marker-blinking'));

  state.blinkingSaludIndex = null;
};

// =============================================================
// GESTIÓN DEL PANEL DE INSPECCIÓN UNIVERSAL
// =============================================================
window.inspectEntity = function(type, idOrIndex, triggerHighlight = true) {
  openSidebar();
  switchSidebarView('viewDetalle');

  const emptyState = document.getElementById('inspectorEmptyState');
  const content = document.getElementById('inspectorContent');
  emptyState.classList.add('hidden');
  content.classList.remove('hidden');

  if (type === 'meteo') {
    const st = state.stations.find(s => s.id === idOrIndex);
    if (!st) return;
    state.selectedEntity = { type: 'meteo', data: st };
    state.map.flyTo([st.lat, st.lon], 12, { duration: 0.7 });
    renderMeteoInspector(st);
  } else if (type === 'hidro') {
    const h = state.hidroList[idOrIndex];
    if (!h) return;
    state.selectedEntity = { type: 'hidro', data: h };
    state.map.flyTo([h.lat, h.lon], 13, { duration: 0.7 });
    renderHidroInspector(h);
  } else if (type === 'salud') {
    const s = state.saludList[idOrIndex];
    if (!s) return;
    state.selectedEntity = { type: 'salud', data: s };
    if (triggerHighlight !== false) {
      highlightEfectorOnMap(idOrIndex);
    } else {
      state.map.flyTo([s.latitud, s.longitud], 15, { duration: 0.7 });
    }
    renderSaludInspector(s);
  } else if (type === 'defensa' || type === 'defensaCivil') {
    const d = state.defensaCivilList[idOrIndex] || ((state.installedModules['defensa'] && state.installedModules['defensa'].data) ? state.installedModules['defensa'].data[idOrIndex] : null);
    if (!d) return;
    state.selectedEntity = { type: 'defensa', data: d };
    state.map.flyTo([d.lat, d.lon], 14, { duration: 0.7 });
    renderDefensaInspector(d);
  } else if (type === 'rutas') {
    const r = state.rutasList[idOrIndex] || ((state.installedModules['rutas'] && state.installedModules['rutas'].data) ? state.installedModules['rutas'].data[idOrIndex] : null);
    if (!r) return;
    state.selectedEntity = { type: 'rutas', data: r };
    state.map.flyTo([r.lat, r.lon], 14, { duration: 0.7 });
    renderRutasInspector(r);
  } else if (type === 'inundaciones') {
    const item = state.inundacionesList[idOrIndex];
    if (!item) return;
    state.selectedEntity = { type: 'inundaciones', data: item };
    if (item.lat && item.lon) state.map.flyTo([item.lat, item.lon], 13, { duration: 0.7 });
    renderInundacionesInspector(item);
  } else if (type === 'bomberos') {
    const item = state.bomberosList[idOrIndex];
    if (!item) return;
    state.selectedEntity = { type: 'bomberos', data: item };
    if (item.latitud && item.longitud) state.map.flyTo([item.latitud, item.longitud], 14, { duration: 0.7 });
    renderBomberosInspector(item);
  } else if (type === 'incendios') {
    const item = state.focosIncendioList[idOrIndex];
    if (!item) return;
    state.selectedEntity = { type: 'incendios', data: item };
    if (item.latitude && item.longitude) state.map.flyTo([item.latitude, item.longitude], 14, { duration: 0.7 });
    renderFocosIncendioInspector(item);
  } else if (type === 'presas') {
    const item = state.presasList[idOrIndex];
    if (!item) return;
    state.selectedEntity = { type: 'presas', data: item };
    if (item.latitud && item.longitud) state.map.flyTo([item.latitud, item.longitud], 13, { duration: 0.7 });
    renderPresasInspector(item);
  } else if (type === 'custom') {
    const item = idOrIndex;
    if (!item) return;
    state.selectedEntity = { type: 'custom', data: item };
    if (item.lat && item.lon) state.map.flyTo([item.lat, item.lon], 14, { duration: 0.7 });
    renderCustomModuleInspector(item);
  }
};

// 1. Inspector de Estación Meteorológica
function renderMeteoInspector(st) {
  const content = document.getElementById('inspectorContent');
  const orgClass = (st.organismo || 'eeaoc').toLowerCase();
  const tel = st.telemetria_oficial;

  let tempVal = '--';
  let humVal = '--';
  let presVal = '--';
  let speedVal = '--';
  let dirVal = 'CALMA';
  let gustVal = '--';
  let reportTime = 'Modelo hiperlocal';

  if (tel && tel.temperatura_c !== null) {
    tempVal = tel.temperatura_c.toFixed(1);
    humVal = `${tel.humedad_pct ?? '--'} %`;
    presVal = `${tel.presion_hpa ?? '--'} hPa`;
    speedVal = `${tel.viento_kmh ?? 0} km/h`;
    dirVal = tel.direccion_viento || 'CALMA';
    gustVal = `${tel.rafaga24_kmh ?? tel.viento_max_kmh ?? 0} km/h`;
    reportTime = tel.fecha_hora_reporte || 'Tiempo real';
  }

  content.innerHTML = `
    <div class="card-meteo-detail">
      <div class="station-meta-tags">
        <span class="badge-org ${orgClass}">${st.organismo}</span>
        <span class="badge-status ${st.sensores_activos ? 'active' : ''}">${st.sensores_activos ? 'En línea' : 'Por Coordenadas'}</span>
        <span class="badge-code">ID: ${st.id}</span>
      </div>
      <h3 style="font-size:1.3rem; font-weight:800; color:#0f172a;">${st.nombre}</h3>
      <p style="font-size:0.78rem; color:#64748b; margin-top:-6px;">${st.localidad || ''}, ${st.departamento || ''} • ${st.altitud_m} msnm</p>

      <div class="hero-weather-card">
        <div class="hero-main">
          <div class="hero-temp-group">
            <span class="hero-temp-val" id="inspHeroTemp">${tempVal}</span>
            <span class="hero-temp-unit">°C</span>
          </div>
          <div class="hero-weather-visual">
            <img id="inspHeroIcon" class="weather-icon-large" src="https://openweathermap.org/img/wn/01d@2x.png" alt="icon">
            <span class="weather-condition-desc" id="inspHeroDesc">Cargando...</span>
          </div>
        </div>
        <div class="hero-meta-row">
          <div>Sensación Térmica: <strong id="inspHeroSensacion">-- °C</strong></div>
          <div>Reporte: <strong>${reportTime}</strong></div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon-wrap hum">💧</div>
          <div class="metric-info">
            <span class="metric-lbl">Humedad</span>
            <span class="metric-val" id="inspHumedad">${humVal}</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon-wrap pres">⏱️</div>
          <div class="metric-info">
            <span class="metric-lbl">Presión</span>
            <span class="metric-val" id="inspPresion">${presVal}</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon-wrap rain">🌧️</div>
          <div class="metric-info">
            <span class="metric-lbl">Lluvia Hoy</span>
            <span class="metric-val">${tel ? tel.lluvia_dia_mm ?? 0 : 0} mm</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon-wrap sun">☀️</div>
          <div class="metric-info">
            <span class="metric-lbl">Índice UV</span>
            <span class="metric-val" id="inspUV">--</span>
          </div>
        </div>
      </div>

      <div class="wind-box">
        <div class="compass-circle">
          <div class="compass-needle" id="inspCompassNeedle"></div>
          <span class="compass-label">${dirVal}</span>
        </div>
        <div class="wind-data">
          <div class="wind-lbl">Anemómetro y Dirección</div>
          <div class="wind-val" id="inspWindSpeed">${speedVal}</div>
          <div class="wind-sub">Ráfagas: ${gustVal}</div>
        </div>
      </div>

      <div class="specs-table">
        <div class="spec-row"><span class="spec-lbl">Departamento</span><span class="spec-val">${st.departamento || 'N/D'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Localidad</span><span class="spec-val">${st.localidad || 'N/D'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Altitud</span><span class="spec-val">${st.altitud_m} msnm</span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas</span><span class="spec-val">${st.lat.toFixed(4)}, ${st.lon.toFixed(4)}</span></div>
        <div class="spec-row"><span class="spec-lbl">Hardware</span><span class="spec-val">${tel ? tel.marca_hardware : 'Red Oficial'}</span></div>
      </div>

      <div class="btn-actions-grid">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lon}" target="_blank" class="btn-action primary">
          📍 Cómo llegar (Google Maps)
        </a>
        <button onclick="navigator.clipboard.writeText('${st.lat}, ${st.lon}'); showToast('Coordenadas copiadas');" class="btn-action">
          📋 Copiar Coords
        </button>
      </div>
    </div>
  `;

  const deg = WIND_DIRS[dirVal] ?? 0;
  const needle = document.getElementById('inspCompassNeedle');
  if (needle) needle.style.transform = `rotate(${deg}deg)`;

  // Consultar en paralelo pronóstico Open-Meteo por coordenadas
  fetchOpenMeteoInspector(st);
}

// 2. Inspector de Hidrometría INA (Sensores y Caudal de Ríos)
function renderHidroInspector(h) {
  const content = document.getElementById('inspectorContent');
  
  const alt = h.altura_m ?? 0;
  const isCrecida = alt >= 3.0 || h.nivel_alerta === 'Alerta Crecida';
  const isAlza = h.tendencia === 'crece' || h.nivel_alerta === 'Caudal en Alza';
  const isBajante = h.tendencia === 'baja' || h.nivel_alerta === 'En Bajante';

  const tendCls = isCrecida ? 'crece' : (isAlza ? 'crece' : (isBajante ? 'baja' : 'permanece'));
  const tendIcon = isCrecida ? '🚨 Alerta Crecida' : (h.tendencia === 'crece' ? '🔺 Caudal en Alza' : (h.tendencia === 'baja' ? '🔻 En Bajante' : '⏸️ Estable'));
  const varStr = (h.variacion_m !== null && h.variacion_m !== undefined) ? `${h.variacion_m > 0 ? '+' : ''}${h.variacion_m} m` : '0.00 m';

  // Porcentaje estimado de llenado del lecho fluvial (referencia 3.5m)
  const fillPct = Math.min(100, Math.max(8, Math.round((Math.max(0, alt) / 3.5) * 100)));
  const barColor = isCrecida ? '#ef4444' : (isAlza ? '#f59e0b' : (isBajante ? '#06b6d4' : '#10b981'));

  // Diagnóstico dinámico del comportamiento hidráulico
  let diagClass = '';
  let diagText = '';
  if (isCrecida) {
    diagClass = 'crecida';
    diagText = `🚨 <strong>Alerta de Crecida Activa:</strong> El nivel fluvial (${h.altura_m} m) supera el umbral de seguridad. El caudal estimado (${h.caudal_estimado_m3s} m³/s) genera fuerte presión sobre márgenes y defensas ribereñas con riesgo de anegamiento en zonas bajas de la llanura.`;
  } else if (isAlza) {
    diagClass = 'alza';
    diagText = `📈 <strong>Caudal en Ascenso:</strong> Se registra un incremento de nivel (${varStr}) por aportes pluviales en las altas cuencas de montaña del Aconquija. La onda de crecida se desplaza aguas abajo hacia la cuenca central.`;
  } else if (isBajante) {
    diagClass = 'bajante';
    diagText = `📉 <strong>Régimen en Bajante / Vaciante:</strong> El nivel de agua desciende (${varStr} respecto a la última medición). El caudal drena normalmente hacia los embalses y cuenca baja sin riesgo de desborde.`;
  } else {
    diagClass = '';
    diagText = `✅ <strong>Comportamiento Normal y Estable:</strong> Régimen laminar ordinario dentro de los márgenes habituales del río. El escurrimiento es constante y regular en toda la sección de aforo.`;
  }

  const caudalLitros = h.caudal_estimado_m3s ? Math.round(h.caudal_estimado_m3s * 1000).toLocaleString() : '--';

  content.innerHTML = `
    <div class="card-hidro-detail">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag">INA SIYAH • Telemetría Satelital SAT2</span>
        <span class="trend-badge ${tendCls}">${tendIcon}</span>
      </div>

      <div>
        <div class="hidro-name">${h.rio || h.nombre}</div>
        <p style="font-size:0.75rem; color:#0369a1; margin-top:2px;">
          ${h.tramo ? `Tramo: <strong>${h.tramo}</strong> • ` : ''}Cuenca del Río Salí - Dulce
        </p>
      </div>

      <!-- Métricas Duales de Nivel y Caudal -->
      <div class="hidro-metrics-dual">
        <div class="hidro-kpi-card">
          <span class="hidro-kpi-lbl">💧 Nivel de Agua</span>
          <div class="hidro-kpi-val-group">
            <span class="hidro-kpi-val">${h.altura_m !== null ? h.altura_m : '--'}</span>
            <span class="hidro-kpi-unit">m</span>
          </div>
          <span class="hidro-kpi-sub">Var: <strong>${varStr}</strong> (ant. ${h.altura_precedente_m ?? '--'}m)</span>
        </div>

        <div class="hidro-kpi-card">
          <span class="hidro-kpi-lbl">🌊 Caudal Estimado</span>
          <div class="hidro-kpi-val-group">
            <span class="hidro-kpi-val">${h.caudal_estimado_m3s !== undefined ? h.caudal_estimado_m3s : '--'}</span>
            <span class="hidro-kpi-unit">m³/s</span>
          </div>
          <span class="hidro-kpi-sub">≈ ${caudalLitros} L/seg</span>
        </div>
      </div>

      <!-- Barra de Llenado del Cauce -->
      <div class="channel-gauge-card">
        <div class="channel-gauge-header">
          <span>Ocupación de la Sección del Cauce</span>
          <span>${fillPct}% de Capacidad</span>
        </div>
        <div class="channel-progress-track">
          <div class="channel-progress-fill" style="width: ${fillPct}%; background: ${barColor};"></div>
        </div>
      </div>

      <!-- Diagnóstico Hidrológico -->
      <div class="channel-diagnostic-box ${diagClass}">
        ${diagText}
      </div>

      <!-- Ficha Técnica -->
      <div class="specs-table" style="background:#ffffff;">
        <div class="spec-row"><span class="spec-lbl">Estación de Aforo</span><span class="spec-val">${h.nombre}</span></div>
        <div class="spec-row"><span class="spec-lbl">Comportamiento Fluvial</span><span class="spec-val" style="color:${h.color_alerta || '#10b981'}; font-weight:700;">${h.nivel_alerta || 'Normal'} (${h.tendencia || 'Estable'})</span></div>
        <div class="spec-row"><span class="spec-lbl">Red de Monitoreo</span><span class="spec-val">INA SIYAH Satelital</span></div>
        <div class="spec-row"><span class="spec-lbl">Identificador Series / UNID</span><span class="spec-val">#${h.series_id || 'N/D'} / #${h.unid || 'N/D'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Fecha y Hora Reporte</span><span class="spec-val">${h.fecha ? h.fecha.replace('T', ' ').replace('Z', ' UTC') : 'En línea'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas del Sensor</span><span class="spec-val">${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}</span></div>
      </div>

      <div class="btn-actions-grid">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}" target="_blank" class="btn-action primary">
          🌊 Ver en Google Maps
        </a>
        <button onclick="state.map.flyTo([${h.lat}, ${h.lon}], 14); showToast('Centrado en el sensor fluvial');" class="btn-action">
          📍 Centrar en Mapa
        </button>
      </div>
    </div>
  `;
}

// 3. Inspector de Efector de Salud SIPROSA
function renderSaludInspector(s) {
  const content = document.getElementById('inspectorContent');
  let tipoBadge = 'Centro de Atención Primaria (CAPS)';
  const nomUpper = s.efector.toUpperCase();
  if (nomUpper.includes('HOSPITAL')) tipoBadge = 'Hospital de Salud Pública';
  else if (nomUpper.includes('107') || nomUpper.includes('URGENCIAS')) tipoBadge = 'Base Operativa Emergencias 107';
  else if (nomUpper.includes('POLICLINICA')) tipoBadge = 'Policlínica de Salud';

  content.innerHTML = `
    <div class="card-salud-detail">
      <span class="salud-badge-tipo">${tipoBadge}</span>
      <div class="salud-name">${s.efector}</div>
      <p style="font-size:0.78rem; color:#64748b; margin-top:-6px;">Sistema Provincial de Salud (SIPROSA) • Tucumán</p>

      <div class="specs-table">
        <div class="spec-row"><span class="spec-lbl">Institución</span><span class="spec-val">SIPROSA / Ministerio de Salud</span></div>
        <div class="spec-row"><span class="spec-lbl">Tipo de Efector</span><span class="spec-val">${tipoBadge}</span></div>
        <div class="spec-row"><span class="spec-lbl">Latitud</span><span class="spec-val">${s.latitud.toFixed(6)}</span></div>
        <div class="spec-row"><span class="spec-lbl">Longitud</span><span class="spec-val">${s.longitud.toFixed(6)}</span></div>
      </div>

      <div class="btn-actions-grid">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${s.latitud},${s.longitud}" target="_blank" class="btn-action primary">
          🏥 Cómo llegar al Efector
        </a>
        <button onclick="navigator.clipboard.writeText('${s.latitud}, ${s.longitud}'); showToast('Coordenadas copiadas');" class="btn-action">
          📋 Copiar Coordenadas
        </button>
      </div>
    </div>
  `;
}

// Consulta meteorológica de apoyo para el inspector
async function fetchOpenMeteoInspector(st) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${st.lat}&longitude=${st.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
      `&daily=uv_index_max&timezone=America%2FArgentina%2FBuenos_Aires`;

    const res = await fetch(url);
    if (!res.ok) return;
    const weather = await res.json();
    if (!weather || !weather.current) return;

    // Si la estación no tenía sensor físico in situ, completar con coordenadas
    if (!st.telemetria_oficial || st.telemetria_oficial.temperatura_c === null) {
      const elTemp = document.getElementById('inspHeroTemp');
      if (elTemp) elTemp.textContent = weather.current.temperature_2m.toFixed(1);
      const elHum = document.getElementById('inspHumedad');
      if (elHum) elHum.textContent = `${weather.current.relative_humidity_2m} %`;
      const elPres = document.getElementById('inspPresion');
      if (elPres) elPres.textContent = `${weather.current.surface_pressure} hPa`;
      const elWind = document.getElementById('inspWindSpeed');
      if (elWind) elWind.textContent = `${weather.current.wind_speed_10m} km/h`;
    }

    const elSens = document.getElementById('inspHeroSensacion');
    if (elSens) elSens.textContent = `${weather.current.apparent_temperature.toFixed(1)} °C`;

    const isDay = weather.current.is_day === 1;
    const wInfo = WMO_CODES[weather.current.weather_code] || { desc: 'Parcialmente Nublado', icon: '02d', iconNight: '02n' };
    const iconName = isDay ? wInfo.icon : wInfo.iconNight;

    const elDesc = document.getElementById('inspHeroDesc');
    if (elDesc) elDesc.textContent = wInfo.desc;
    const elIcon = document.getElementById('inspHeroIcon');
    if (elIcon) elIcon.src = `https://openweathermap.org/img/wn/${iconName}@2x.png`;

    if (weather.daily && weather.daily.uv_index_max) {
      const elUV = document.getElementById('inspUV');
      if (elUV) elUV.textContent = `${weather.daily.uv_index_max[0]} UV`;
    }
  } catch (e) {}
}

// 4. Inspector de Módulo Defensa Civil y Refugios
function renderDefensaInspector(d) {
  const content = document.getElementById('inspectorContent');
  content.innerHTML = `
    <div class="card-hidro-detail" style="border-color:#fed7aa; background:linear-gradient(145deg, #fffaf5 0%, #ffedd5 100%);">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag" style="background:#ea580c;">Protección Civil • Tucumán</span>
        <span class="trend-badge" style="background:#ffedd5; color:#c2410c;">🛡️ ${d.estado}</span>
      </div>
      <div>
        <div class="hidro-name">${d.nombre}</div>
        <p style="font-size:0.75rem; color:#c2410c; margin-top:2px;">${d.localidad || ''}, ${d.departamento || ''} • ${d.tipo}</p>
      </div>
      <div class="specs-table" style="background:#ffffff;">
        <div class="spec-row"><span class="spec-lbl">Tipo de Centro</span><span class="spec-val">${d.tipo}</span></div>
        <div class="spec-row"><span class="spec-lbl">Capacidad de Alojamiento</span><span class="spec-val" style="color:#ea580c; font-weight:800;">${d.capacidad_personas} personas</span></div>
        <div class="spec-row"><span class="spec-lbl">Organismo Responsable</span><span class="spec-val">${d.responsable}</span></div>
        <div class="spec-row"><span class="spec-lbl">Línea de Emergencias</span><span class="spec-val"><strong>${d.telefono}</strong></span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas</span><span class="spec-val">${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}</span></div>
      </div>
      <div class="btn-actions-grid">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}" target="_blank" class="btn-action primary" style="background:#ea580c;">
          📍 Cómo llegar al Refugio
        </a>
        <button onclick="navigator.clipboard.writeText('${d.telefono}'); showToast('Teléfono copiado: ' + '${d.telefono}');" class="btn-action">
          📞 Copiar Teléfono
        </button>
      </div>
    </div>
  `;
}

// 5. Inspector de Módulo Rutas y Pasos Críticos
function renderRutasInspector(r) {
  const content = document.getElementById('inspectorContent');
  content.innerHTML = `
    <div class="card-hidro-detail" style="border-color:#fde68a; background:linear-gradient(145deg, #fefce8 0%, #fef3c7 100%);">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag" style="background:#d97706;">Vialidad • Tránsito Crítico</span>
        <span class="trend-badge" style="background:#fef3c7; color:#b45309;">🛣️ ${r.estado_transito}</span>
      </div>
      <div>
        <div class="hidro-name">${r.nombre}</div>
        <p style="font-size:0.75rem; color:#b45309; margin-top:2px;">${r.ruta} • ${r.km}</p>
      </div>
      <div class="channel-diagnostic-box" style="background:#fff; border-left:4px solid ${r.color_estado || '#f59e0b'};">
        <strong>Situación del Paso:</strong> ${r.observacion}
      </div>
      <div class="specs-table" style="background:#ffffff;">
        <div class="spec-row"><span class="spec-lbl">Tipo de Estructura</span><span class="spec-val">${r.tipo}</span></div>
        <div class="spec-row"><span class="spec-lbl">Estado de Calzada</span><span class="spec-val" style="color:${r.color_estado}; font-weight:800;">${r.estado_transito}</span></div>
        <div class="spec-row"><span class="spec-lbl">Ruta y Kilómetro</span><span class="spec-val">${r.ruta} (${r.km})</span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas</span><span class="spec-val">${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}</span></div>
      </div>
      <div class="btn-actions-grid">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}" target="_blank" class="btn-action primary" style="background:#d97706;">
          📍 Ver Punto en Google Maps
        </a>
        <button onclick="state.map.flyTo([${r.lat}, ${r.lon}], 14); showToast('Centrado en el punto vial');" class="btn-action">
          📍 Centrar en Mapa
        </button>
      </div>
    </div>
  `;
}

// 6. Inspector de Módulo InundaRisk Sentinel (FloodRisk & Google FloodHub)
function renderInundacionesInspector(item) {
  const content = document.getElementById('inspectorContent');
  const color = item.color_riesgo || '#dc2626';
  const locs = Array.isArray(item.localidades_afectadas) ? item.localidades_afectadas.join(', ') : item.localidades_afectadas;

  content.innerHTML = `
    <div class="card-hidro-detail" style="border-color:${color}; background:linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%);">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag" style="background:${color}; font-weight:800;">FloodRisk & Google FloodHub</span>
        <span class="trend-badge" style="background:#fff; color:${color}; border:1.5px solid ${color}; font-weight:800;">🌊 ${item.nivel_riesgo}</span>
      </div>
      <div style="margin-top:6px;">
        <div class="hidro-name" style="font-size:1.15rem; color:#0f172a;">${item.nombre}</div>
        <p style="font-size:0.75rem; color:#475569; margin-top:2px;">Cauce Principal: <strong>${item.rio_principal}</strong> · ${item.departamento}</p>
      </div>
      <div class="channel-diagnostic-box" style="background:#fff; border-left:4px solid ${color}; margin-top:8px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <strong>Diagnóstico de Riesgo Hídrico:</strong> ${item.observacion}
      </div>
      <div class="specs-table" style="background:#ffffff; margin-top:8px;">
        <div class="spec-row"><span class="spec-lbl">Recurrencia Satelital</span><span class="spec-val" style="color:${color}; font-weight:800;">${item.frecuencia_satelital}</span></div>
        <div class="spec-row"><span class="spec-lbl">Localidades Afectables</span><span class="spec-val">${locs}</span></div>
        <div class="spec-row"><span class="spec-lbl">Caudal Crítico Estimado</span><span class="spec-val" style="font-weight:700;">${item.caudal_critico_m3s} m³/s</span></div>
        <div class="spec-row"><span class="spec-lbl">Refugio Próximo</span><span class="spec-val">${item.capacidad_evacuacion_cercana}</span></div>
        <div class="spec-row"><span class="spec-lbl">HydroBASINS ID</span><span class="spec-val" style="font-family:monospace; font-size:0.72rem;">${item.hydrobasins_id}</span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas Centroide</span><span class="spec-val">${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}</span></div>
      </div>
      <div class="btn-actions-grid" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        <a href="${item.google_floodhub_url}" target="_blank" class="btn-action primary" style="background:#4285f4; text-align:center; text-decoration:none; font-weight:700;">
          🌐 Monitoreo Google FloodHub
        </a>
        <a href="${item.floodrisk_url}" target="_blank" class="btn-action" style="background:#0f172a; color:#fff; text-align:center; text-decoration:none; font-weight:700;">
          🌊 Ver en FloodRisk.com.ar/crecidas
        </a>
        <button onclick="state.map.flyTo([${item.lat}, ${item.lon}], 14); showToast('Centrado en cuenca de riesgo');" class="btn-action">
          📍 Centrar en Mapa
        </button>
      </div>
    </div>
  `;
}

// Inspector de Bomberos Voluntarios
function renderBomberosInspector(item) {
  const content = document.getElementById('inspectorContent');
  if (!content) return;

  const isPending = item.estado && item.estado.toLowerCase() === 'pendiente';
  const badgeClass = isPending ? 'badge-bombero-pending' : 'badge-bombero-verified';
  const lat = typeof item.latitud === 'number' ? item.latitud : parseFloat(item.latitud);
  const lon = typeof item.longitud === 'number' ? item.longitud : parseFloat(item.longitud);
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  const phoneClean = item.telefono ? item.telefono.split('/')[0].trim() : '100';

  content.innerHTML = `
    <div class="card-hidro-detail" style="border-color:#b91c1c; background:linear-gradient(145deg, #fff5f5 0%, #fef2f2 100%);">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag" style="background:#b91c1c; font-weight:800;">👨‍🚒 Red de Bomberos Voluntarios</span>
        <span class="${badgeClass}">${item.estado || 'VERIFICADO'}</span>
      </div>
      <div style="margin-top:6px;">
        <div class="hidro-name" style="font-size:1.1rem; color:#991b1b; font-weight:800;">${item.nombre}</div>
        <p style="font-size:0.78rem; color:#475569; margin-top:2px;">
          📍 <strong>${item.localidad || 'Tucumán'}</strong> · ${item.direccion || 'Jurisdicción Provincial'}
        </p>
      </div>

      <div class="channel-diagnostic-box" style="background:#fff; border-left:4px solid #b91c1c; margin-top:8px; box-shadow:0 2px 8px rgba(185,28,28,0.08);">
        <strong>Información Oficial:</strong> ${item.observaciones || 'Cuartel activo registrado en el sistema provincial.'}
      </div>

      <div class="specs-table" style="background:#ffffff; margin-top:8px;">
        <div class="spec-row"><span class="spec-lbl">Localidad / Jurisdicción</span><span class="spec-val" style="font-weight:700;">${item.localidad || '--'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Dirección del Cuartel</span><span class="spec-val">${item.direccion || '--'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Estado de Domicilio</span><span class="spec-val" style="font-weight:700; color:${isPending ? '#b45309' : '#15803d'};">${item.estado || 'VERIFICADO'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Teléfono / Emergencia</span><span class="spec-val" style="font-weight:800; color:#b91c1c;">${item.telefono || '100 / 103'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas GPS</span><span class="spec-val" style="font-family:monospace; font-size:0.75rem;">${!isNaN(lat) ? lat.toFixed(4) : '--'}, ${!isNaN(lon) ? lon.toFixed(4) : '--'}</span></div>
      </div>

      <div class="btn-actions-grid" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        <a href="tel:${phoneClean}" class="bombero-phone-btn" style="justify-content:center; font-weight:700;">
          📞 Llamar a Emergencias (${phoneClean})
        </a>
        <a href="${gmapsUrl}" target="_blank" class="btn-action" style="background:#0f172a; color:#fff; text-align:center; text-decoration:none; font-weight:700;">
          🗺️ Navegar en Google Maps
        </a>
        <button onclick="if (state.map && !isNaN(${lat}) && !isNaN(${lon})) { state.map.flyTo([${lat}, ${lon}], 15); showToast('Centrado en cuartel de bomberos'); }" class="btn-action">
          📍 Centrar en Mapa
        </button>
      </div>
    </div>
  `;
}

// Inspector de Focos de Calor y Anomalías Térmicas NASA FIRMS
function renderFocosIncendioInspector(item) {
  const content = document.getElementById('inspectorContent');
  if (!content) return;

  const confLower = item.confidence.toLowerCase();
  const badgeClass = confLower === 'alta' ? 'badge-pyro-high' : (confLower === 'nominal' ? 'badge-pyro-nominal' : 'badge-pyro-low');
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;

  content.innerHTML = `
    <div class="card-hidro-detail" style="border-color:#ea580c; background:linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%);">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag" style="background:#ea580c; font-weight:800;">🔥 NASA FIRMS VIIRS</span>
        <span class="${badgeClass}">Confianza ${item.confidence} (${item.confidence_pct}%)</span>
      </div>
      <div style="margin-top:6px;">
        <div class="hidro-name" style="font-size:1.1rem; color:#c2410c; font-weight:800;">Detección de Foco de Calor en ${item.departamento}</div>
        <p style="font-size:0.78rem; color:#475569; margin-top:2px;">
          📍 Coordenadas GPS: <strong>${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}</strong>
        </p>
      </div>

      <div class="pyro-warning-box">
        <strong>⚠️ Advertencia Institucional:</strong> ${item.warning_disclaimer}
      </div>

      <div class="specs-table" style="background:#ffffff; margin-top:8px;">
        <div class="spec-row"><span class="spec-lbl">Potencia Radiativa (FRP)</span><span class="spec-val" style="font-weight:800; color:#c2410c;">${item.frp_mw} MW</span></div>
        <div class="spec-row"><span class="spec-lbl">Temp Brillo de Canal</span><span class="spec-val" style="font-weight:700;">${item.brightness_temp_c}°C (${item.brightness_temp_k} K)</span></div>
        <div class="spec-row"><span class="spec-lbl">Constelación Satelital</span><span class="spec-val">${item.satellite}</span></div>
        <div class="spec-row"><span class="spec-lbl">Sensor Espectrométrico</span><span class="spec-val">${item.sensor}</span></div>
        <div class="spec-row"><span class="spec-lbl">Fecha y Hora de Pasada</span><span class="spec-val">${item.detection_date} ${item.detection_time}</span></div>
        <div class="spec-row"><span class="spec-lbl">Departamento</span><span class="spec-val" style="font-weight:700;">${item.departamento}</span></div>
        <div class="spec-row"><span class="spec-lbl">Fuente Oficial</span><span class="spec-val">${item.fuente}</span></div>
      </div>

      <div class="btn-actions-grid" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        <a href="${gmapsUrl}" target="_blank" class="btn-action primary" style="background:#ea580c; text-align:center; text-decoration:none; font-weight:700;">
          🗺️ Ver Punto Exacto en Google Maps
        </a>
        <button onclick="state.map.flyTo([${item.latitude}, ${item.longitude}], 15); showToast('Centrado en anomalía térmica');" class="btn-action">
          📍 Centrar en Mapa
        </button>
      </div>
    </div>
  `;
}

// Inspector de Presas y Obras Hidráulicas (ORSEP)
function renderPresasInspector(item) {
  const content = document.getElementById('inspectorContent');
  if (!content) return;

  const isDerivador = (item.tipo || '').toLowerCase().includes('derivador');
  const isPendingCoord = (item.coordenada_estado || '').toLowerCase().includes('pendiente');
  const lat = typeof item.latitud === 'number' ? item.latitud : parseFloat(item.latitud);
  const lon = typeof item.longitud === 'number' ? item.longitud : parseFloat(item.longitud);
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  content.innerHTML = `
    <div class="card-presa-detail">
      <div class="hidro-hero-header" style="justify-content:space-between;">
        <span class="badge-presa-tipo" style="font-size:0.75rem; padding:3px 8px;">🏗️ ${item.tipo}</span>
        ${item.fiscalizado_orsep ? '<span class="badge-orsep-verified" style="font-size:0.75rem; padding:3px 8px;">✓ Fiscalizada por ORSEP</span>' : ''}
      </div>

      <div style="margin-top:8px;">
        <div class="hidro-name" style="font-size:1.18rem; color:#0369a1; font-weight:800;">${item.nombre}</div>
        ${item.alias ? `<div style="font-size:0.85rem; font-weight:700; color:#0c4a6e; margin-top:1px;">Alias: ${item.alias}</div>` : ''}
        <p style="font-size:0.78rem; color:#475569; margin-top:3px;">
          📍 <strong>${item.departamento}</strong> (${item.localidad_referencial}) · Cuenca <strong>${item.cuenca}</strong>
        </p>
      </div>

      <div class="channel-diagnostic-box" style="background:#fff; border-left:4px solid #0284c7; margin-top:8px; box-shadow:0 2px 8px rgba(2,132,199,0.08);">
        <strong>Uso Principal:</strong> ${item.uso || 'Regulación hidrológica e infraestructura hidráulica.'}
      </div>

      <div class="specs-table" style="background:#ffffff; margin-top:8px;">
        <div class="spec-row"><span class="spec-lbl">Complejo Hidráulico</span><span class="spec-val" style="font-weight:700; color:#0369a1;">${item.complejo}</span></div>
        <div class="spec-row"><span class="spec-lbl">Cauce / Río</span><span class="spec-val" style="font-weight:700;">${item.rio}</span></div>
        <div class="spec-row"><span class="spec-lbl">Altura de la Obra</span><span class="spec-val">${item.altura_m ? item.altura_m + ' metros' : 'No especificada'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Capacidad de Embalse</span><span class="spec-val" style="font-weight:700; color:#0284c7;">${item.capacidad_embalse_hm3 ? item.capacidad_embalse_hm3 + ' hm³' : 'Sin embalse / Derivador'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Capacidad del Vertedero</span><span class="spec-val">${item.capacidad_vertedero_m3s ? item.capacidad_vertedero_m3s + ' m³/s' : 'No disponible'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Operador / Concesionario</span><span class="spec-val">${item.operador}</span></div>
        ${item.potencia_mw ? `<div class="spec-row"><span class="spec-lbl">Potencia Hidroeléctrica</span><span class="spec-val">${item.potencia_mw} MW (${item.generacion_media_gwh_anio || '--'} GWh/año)</span></div>` : ''}
        <div class="spec-row"><span class="spec-lbl">Fiscalización Nacional</span><span class="spec-val" style="font-weight:700; color:#15803d;">${item.fiscalizado_orsep ? 'ORSEP (Organismo Regulador de Seguridad de Presas)' : 'No registrada'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Estado de Coordenadas</span><span class="spec-val" style="color:${isPendingCoord ? '#b45309' : '#15803d'}; font-weight:700;">${item.coordenada_estado || 'Referencia'}</span></div>
        <div class="spec-row"><span class="spec-lbl">Coordenadas GPS</span><span class="spec-val" style="font-family:monospace; font-size:0.75rem;">${!isNaN(lat) ? lat.toFixed(6) : '--'}, ${!isNaN(lon) ? lon.toFixed(6) : '--'}</span></div>
      </div>

      ${item.coordenada_nota ? `
        <div style="background:#fffbe6; border:1px solid #ffe58f; border-left:3px solid #faad14; padding:6px 10px; border-radius:6px; font-size:0.7rem; color:#78350f; margin-top:8px;">
          ⚠️ <strong>Nota Cartográfica:</strong> ${item.coordenada_nota}
        </div>
      ` : ''}

      <div class="btn-actions-grid" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        ${item.fuente_url ? `
          <a href="${item.fuente_url}" target="_blank" class="btn-action primary" style="background:#0284c7; text-align:center; text-decoration:none; font-weight:700;">
            🏛️ Consultar Registro Oficial en ORSEP →
          </a>
        ` : ''}
        <a href="${gmapsUrl}" target="_blank" class="btn-action" style="background:#0f172a; color:#fff; text-align:center; text-decoration:none; font-weight:700;">
          🗺️ Navegar en Google Maps
        </a>
        <button onclick="if (state.map && !isNaN(${lat}) && !isNaN(${lon})) { state.map.flyTo([${lat}, ${lon}], 14); showToast('Enfocando obra hidráulica'); }" class="btn-action">
          📍 Centrar en Mapa
        </button>
      </div>
    </div>
  `;
}

// 6. Inspector de Módulos Personalizados Dinámicos
function renderCustomModuleInspector(item) {
  const content = document.getElementById('inspectorContent');
  const props = item.properties || item;
  const rows = Object.entries(props).filter(([k]) => k !== 'geometry' && k !== 'coordinates').map(([k, v]) => `
    <div class="spec-row"><span class="spec-lbl">${k}</span><span class="spec-val">${typeof v === 'object' ? JSON.stringify(v) : v}</span></div>
  `).join('');

  content.innerHTML = `
    <div class="card-hidro-detail">
      <div class="hidro-hero-header">
        <span class="hidro-badge-tag">Módulo Dinámico</span>
        <span class="trend-badge permanece">Capa Activa</span>
      </div>
      <div class="hidro-name">${props.nombre || props.name || props.title || 'Elemento del Módulo'}</div>
      <p style="font-size:0.75rem; color:#64748b;">Módulo importado por el usuario</p>
      <div class="specs-table" style="background:#ffffff; margin-top:8px;">
        ${rows}
      </div>
      ${(item.lat && item.lon) ? `
        <div class="btn-actions-grid" style="margin-top:10px;">
          <button onclick="state.map.flyTo([${item.lat}, ${item.lon}], 15); showToast('Centrado');" class="btn-action primary">
            📍 Centrar en Mapa
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================================
// GESTOR DE INSTALACIÓN DINÁMICA DE MÓDULOS (MARKETPLACE)
// =============================================================
window.switchPluginsTab = function(tabId) {
  if (tabId === 'tabPmUpload' && !isSysadminAuthenticated()) {
    requireSysadminAuth(() => window.switchPluginsTab('tabPmUpload'));
    return;
  }
  document.querySelectorAll('.pm-tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-pm-tab') === tabId);
  });
  document.querySelectorAll('.pm-subview').forEach(v => {
    v.classList.toggle('active', v.id === tabId);
  });
  switchSidebarView('viewPlugins');
};

window.toggleModuleInstallation = async function(modId) {
  const isInstalled = state.installedModules[modId];
  if (!isInstalled && !isSysadminAuthenticated()) {
    requireSysadminAuth(() => window.toggleModuleInstallation(modId));
    return;
  }
  if (modId === 'defensa') {
    if (!state.installedModules['defensa']) {
      await installDefensaModule();
    } else {
      uninstallDefensaModule();
    }
  } else if (modId === 'rutas') {
    if (!state.installedModules['rutas']) {
      await installRutasModule();
    } else {
      uninstallRutasModule();
    }
  }
};

async function installDefensaModule() {
  try {
    const res = await fetch('modulos/defensa_civil.json');
    if (!res.ok) throw new Error('No se pudo cargar el archivo del módulo');
    const data = await res.json();

    const layer = L.layerGroup();
    data.forEach((d, idx) => {
      const html = `
        <div class="pin-container" style="filter:drop-shadow(0 3px 6px rgba(234, 88, 12, 0.3));">
          <div class="pin-badge" style="border-color:#ea580c; color:#c2410c;">
            <span class="pin-dot" style="background:#ea580c;"></span>
            <span>🛡️ ${d.capacidad_personas}p</span>
          </div>
          <div class="pin-needle" style="background:#ea580c;"></div>
        </div>
      `;
      const icon = L.divIcon({ className: 'custom-defensa-pin', html: html, iconSize: [58, 40], iconAnchor: [29, 40] });
      const m = L.marker([d.lat, d.lon], { icon: icon });
      m.bindPopup(`
        <div class="popup-station-card">
          <div style="font-size:0.68rem; font-weight:700; color:#ea580c; text-transform:uppercase;">Defensa Civil • Refugio</div>
          <h3>${d.nombre}</h3>
          <p>Capacidad: <strong>${d.capacidad_personas} personas</strong></p>
          <button onclick="window.inspectEntity('defensa', ${idx})" style="width:100%; background:#ea580c; border:none; color:#fff; padding:5px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer; margin-top:4px;">
            Ver Ficha del Refugio
          </button>
        </div>
      `);
      m.on('click', () => { inspectEntity('defensa', idx); });
      layer.addLayer(m);
    });

    layer.addTo(state.map);
    state.installedModules['defensa'] = { name: 'Defensa Civil y Refugios', layer: layer, data: data, active: true };

    const container = document.getElementById('installedPluginsList');
    const card = document.createElement('div');
    card.className = 'plugin-card vsc-extension-item';
    card.id = 'cardPluginDefensa';
    card.innerHTML = `
      <div class="vsc-ext-main-row">
        <div class="vsc-ext-thumb svg-wrap" style="background:#ffedd5; border-color:#fed7aa;">
          <img src="icon_defensa.svg" alt="Protección Civil & Refugios">
        </div>
        <div class="vsc-ext-details">
          <div class="vsc-ext-header">
            <strong class="vsc-ext-title">Protección Civil & Refugios</strong>
            <span class="vsc-ext-version">v1.2.0</span>
          </div>
          <div class="vsc-ext-publisher-row">
            <span class="vsc-ext-publisher">DGIME - I+T</span>
            <span class="vsc-verified-badge" title="Editor Verificado">✓</span>
            <span class="vsc-ext-meta">${data.length} centros</span>
          </div>
          <p class="vsc-ext-desc">
            Centros comunales de evacuación y bases operativas de Defensa Civil ante crecidas de ríos y anegamientos.
          </p>
          <div class="vsc-ext-actions">
            <label class="plugin-switch" title="Activar / Desactivar en mapa">
              <input type="checkbox" id="chkPluginDefensa" checked>
              <span class="slider"></span>
            </label>
            <span class="plugin-count-badge" style="background:#ffedd5; color:#c2410c;">${data.length} centros</span>
            <span class="vsc-ext-status-tag active">En Mapa</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);

    document.getElementById('chkPluginDefensa').addEventListener('change', e => {
      if (e.target.checked) state.map.addLayer(layer);
      else state.map.removeLayer(layer);
      showToast(e.target.checked ? 'Capa Defensa Civil activada' : 'Capa Defensa Civil oculta');
    });

    const btn = document.getElementById('btnInstallDefensa');
    if (btn) {
      btn.innerHTML = '✓ Instalado (Desinstalar)';
      btn.classList.add('installed');
    }

    updateInstalledCountBadge();
    showToast('Módulo "Defensa Civil" instalado y activo en el mapa');
  } catch (err) {
    showToast('Error al instalar módulo: ' + err.message);
  }
}

function uninstallDefensaModule() {
  const mod = state.installedModules['defensa'];
  if (mod) {
    state.map.removeLayer(mod.layer);
    const card = document.getElementById('cardPluginDefensa');
    if (card) card.remove();
    delete state.installedModules['defensa'];

    const btn = document.getElementById('btnInstallDefensa');
    if (btn) {
      btn.innerHTML = '⬇️ Instalar Módulo';
      btn.classList.remove('installed');
    }
    updateInstalledCountBadge();
    showToast('Módulo "Defensa Civil" desinstalado');
  }
}

async function installRutasModule() {
  try {
    const res = await fetch('modulos/rutas_criticas.json');
    if (!res.ok) throw new Error('No se pudo cargar el archivo del módulo');
    const data = await res.json();

    const layer = L.layerGroup();
    data.forEach((r, idx) => {
      const html = `
        <div class="pin-container" style="filter:drop-shadow(0 3px 6px rgba(217, 119, 6, 0.3));">
          <div class="pin-badge" style="border-color:${r.color_estado || '#d97706'}; color:#b45309;">
            <span class="pin-dot" style="background:${r.color_estado || '#d97706'};"></span>
            <span>🛣️ ${r.ruta.replace('Ruta ', '')}</span>
          </div>
          <div class="pin-needle" style="background:${r.color_estado || '#d97706'};"></div>
        </div>
      `;
      const icon = L.divIcon({ className: 'custom-rutas-pin', html: html, iconSize: [66, 40], iconAnchor: [33, 40] });
      const m = L.marker([r.lat, r.lon], { icon: icon });
      m.bindPopup(`
        <div class="popup-station-card">
          <div style="font-size:0.68rem; font-weight:700; color:#d97706; text-transform:uppercase;">Vialidad • Tránsito Crítico</div>
          <h3>${r.nombre}</h3>
          <p>Estado: <strong style="color:${r.color_estado};">${r.estado_transito}</strong></p>
          <button onclick="window.inspectEntity('rutas', ${idx})" style="width:100%; background:#d97706; border:none; color:#fff; padding:5px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer; margin-top:4px;">
            Ver Situación del Paso
          </button>
        </div>
      `);
      m.on('click', () => { inspectEntity('rutas', idx); });
      layer.addLayer(m);
    });

    layer.addTo(state.map);
    state.installedModules['rutas'] = { name: 'Rutas y Pasos Críticos', layer: layer, data: data, active: true };

    const container = document.getElementById('installedPluginsList');
    const card = document.createElement('div');
    card.className = 'plugin-card vsc-extension-item';
    card.id = 'cardPluginRutas';
    card.innerHTML = `
      <div class="vsc-ext-main-row">
        <div class="vsc-ext-thumb svg-wrap" style="background:#fef3c7; border-color:#fde68a;">
          <img src="icon_rutas.svg" alt="Vialidad & Rutas Críticas">
        </div>
        <div class="vsc-ext-details">
          <div class="vsc-ext-header">
            <strong class="vsc-ext-title">Vialidad & Rutas Críticas</strong>
            <span class="vsc-ext-version">v1.0.4</span>
          </div>
          <div class="vsc-ext-publisher-row">
            <span class="vsc-ext-publisher">DGIME - I+T</span>
            <span class="vsc-verified-badge" title="Editor Verificado">✓</span>
            <span class="vsc-ext-meta">${data.length} puntos críticos</span>
          </div>
          <p class="vsc-ext-desc">
            Puentes sobre ríos, pasos bajo nivel y tramos con alerta de socavamiento en RN157, RN38 y RP307.
          </p>
          <div class="vsc-ext-actions">
            <label class="plugin-switch" title="Activar / Desactivar en mapa">
              <input type="checkbox" id="chkPluginRutas" checked>
              <span class="slider"></span>
            </label>
            <span class="plugin-count-badge" style="background:#fef3c7; color:#b45309;">${data.length} puntos</span>
            <span class="vsc-ext-status-tag active">En Mapa</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);

    document.getElementById('chkPluginRutas').addEventListener('change', e => {
      if (e.target.checked) state.map.addLayer(layer);
      else state.map.removeLayer(layer);
      showToast(e.target.checked ? 'Capa Rutas activada' : 'Capa Rutas oculta');
    });

    const btn = document.getElementById('btnInstallRutas');
    if (btn) {
      btn.innerHTML = '✓ Instalado (Desinstalar)';
      btn.classList.add('installed');
    }

    updateInstalledCountBadge();
    showToast('Módulo "Rutas y Pasos Críticos" instalado y activo en el mapa');
  } catch (err) {
    showToast('Error al instalar módulo: ' + err.message);
  }
}

function uninstallRutasModule() {
  const mod = state.installedModules['rutas'];
  if (mod) {
    state.map.removeLayer(mod.layer);
    const card = document.getElementById('cardPluginRutas');
    if (card) card.remove();
    delete state.installedModules['rutas'];

    const btn = document.getElementById('btnInstallRutas');
    if (btn) {
      btn.innerHTML = '⬇️ Instalar Módulo';
      btn.classList.remove('installed');
    }
    updateInstalledCountBadge();
    showToast('Módulo "Rutas y Pasos Críticos" desinstalado');
  }
}

function updateInstalledCountBadge() {
  const baseCount = 5;
  const installedDynamicCount = Object.keys(state.installedModules).length;
  const total = baseCount + installedDynamicCount;
  const b1 = document.getElementById('countInstalledBadge');
  if (b1) b1.textContent = total;
}

// Instalador dinámico de archivos GeoJSON subidos por el usuario
window.installCustomModuleData = function(name, color, rawData) {
  try {
    let parsed = null;
    if (typeof rawData === 'string') {
      parsed = JSON.parse(rawData);
    } else {
      parsed = rawData;
    }

    const modId = 'custom_' + Date.now();
    const layer = L.layerGroup();
    let countItems = 0;

    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      parsed.features.forEach((feat, i) => {
        if (feat.geometry && feat.geometry.type === 'Point') {
          const coords = feat.geometry.coordinates;
          const lat = coords[1];
          const lon = coords[0];
          countItems++;
          const m = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
          });
          m.bindPopup(`<strong>${feat.properties.name || feat.properties.nombre || name}</strong><br><button onclick='window.inspectEntity("custom", ${JSON.stringify(feat.properties)})'>Ver Detalles</button>`);
          m.on('click', () => { inspectEntity('custom', Object.assign({ lat, lon }, feat.properties)); });
          layer.addLayer(m);
        }
      });
    } else if (Array.isArray(parsed)) {
      parsed.forEach((item, i) => {
        const lat = item.lat || item.latitud || item.latitude;
        const lon = item.lon || item.longitud || item.lng || item.longitude;
        if (lat && lon) {
          countItems++;
          const m = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
          });
          m.bindPopup(`<strong>${item.name || item.nombre || name}</strong><br><button onclick='window.inspectEntity("custom", ${JSON.stringify(item)})'>Ver Detalles</button>`);
          m.on('click', () => { inspectEntity('custom', item); });
          layer.addLayer(m);
        }
      });
    }

    if (countItems === 0) {
      showToast('No se encontraron puntos con coordenadas válidas en el archivo');
      return;
    }

    layer.addTo(state.map);
    state.installedModules[modId] = { name: name, layer: layer, data: parsed, active: true };

    // Añadir a lista de instalados
    const container = document.getElementById('installedPluginsList');
    const card = document.createElement('div');
    card.className = 'plugin-card vsc-extension-item';
    card.id = 'card_' + modId;
    card.innerHTML = `
      <div class="vsc-ext-main-row">
        <div class="vsc-ext-thumb custom-color-thumb" style="background:${color}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem;">
          📦
        </div>
        <div class="vsc-ext-details">
          <div class="vsc-ext-header">
            <strong class="vsc-ext-title">${name}</strong>
            <span class="vsc-ext-version">v1.0.0</span>
          </div>
          <div class="vsc-ext-publisher-row">
            <span class="vsc-ext-publisher">DGIME - I+T</span>
            <span class="vsc-verified-badge" title="Editor Verificado">✓</span>
            <span class="vsc-ext-meta">Capa Externa GeoJSON</span>
          </div>
          <p class="vsc-ext-desc">
            Módulo personalizado importado desde archivo por el usuario con ${countItems} elementos geográficos.
          </p>
          <div class="vsc-ext-actions">
            <label class="plugin-switch" title="Activar / Desactivar en mapa">
              <input type="checkbox" id="chk_${modId}" checked>
              <span class="slider"></span>
            </label>
            <span class="plugin-count-badge" style="background:#f1f5f9;">${countItems} elementos</span>
            <span class="vsc-ext-status-tag active">En Mapa</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);

    document.getElementById('chk_' + modId).addEventListener('change', e => {
      if (state.installedModules[modId]) {
        state.installedModules[modId].active = e.target.checked;
      }
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      if (e.target.checked) state.map.addLayer(layer);
      else state.map.removeLayer(layer);
    });

    updateInstalledCountBadge();
    window.switchPluginsTab('tabPmInstalled');
    showToast(`Módulo "${name}" instalado con ${countItems} elementos`);
  } catch (err) {
    showToast('Error al procesar archivo: ' + err.message);
  }
};

// =============================================================
// GESTIÓN DE CHECKBOXES / PLUGINS MODULARES (TIPO VSCODE)
// =============================================================
function updatePluginUIStatus(chkId, isActive) {
  const el = document.getElementById(chkId);
  if (el) {
    el.checked = isActive;
    const card = el.closest('.plugin-card') || el.closest('.vsc-extension-item');
    if (card) {
      card.classList.toggle('active', isActive);
      const tag = card.querySelector('.vsc-ext-status-tag');
      if (tag) {
        tag.textContent = isActive ? 'En Mapa' : 'Desactivado';
        tag.classList.toggle('active', isActive);
      }
    }
  }
}
window.updatePluginUIStatus = updatePluginUIStatus;

function setupPluginCheckboxes() {
  // Plugin 1: Estaciones Meteorológicas
  document.getElementById('chkPluginMeteo').addEventListener('change', e => {
    state.pluginsActive.meteo = e.target.checked;
    updatePluginUIStatus('chkPluginMeteo', e.target.checked);
    if (state.mapLayersHidden && e.target.checked) {
      state.mapLayersHidden = false;
      updateClearButtonUI();
    }
    if (e.target.checked) {
      state.map.addLayer(state.layers.meteo);
      showToast('Plugin Meteorología activado (39 estaciones)');
    } else {
      state.map.removeLayer(state.layers.meteo);
      showToast('Plugin Meteorología desactivado');
    }
    updateLegendDisplay();
    saveUserPreferences();
  });

  // Plugin 2: Hidrometría INA
  document.getElementById('chkPluginHidro').addEventListener('change', e => {
    state.pluginsActive.hidro = e.target.checked;
    updatePluginUIStatus('chkPluginHidro', e.target.checked);
    if (state.mapLayersHidden && e.target.checked) {
      state.mapLayersHidden = false;
      updateClearButtonUI();
    }
    if (e.target.checked) {
      state.map.addLayer(state.layers.hidro);
      showToast(`Plugin Hidrometría INA activado (${state.hidroList.length || 13} aforos)`);
    } else {
      state.map.removeLayer(state.layers.hidro);
      showToast('Plugin Hidrometría INA desactivado');
    }
    updateLegendDisplay();
    saveUserPreferences();
  });

  // Plugin 3: Efectores de Salud SIPROSA
  document.getElementById('chkPluginSalud').addEventListener('change', e => {
    state.pluginsActive.salud = e.target.checked;
    updatePluginUIStatus('chkPluginSalud', e.target.checked);
    if (state.mapLayersHidden && e.target.checked) {
      state.mapLayersHidden = false;
      updateClearButtonUI();
    }
    if (e.target.checked) {
      state.map.addLayer(state.layers.salud);
      showToast('Plugin Salud SIPROSA activado (367 efectores)');
    } else {
      state.map.removeLayer(state.layers.salud);
      showToast('Plugin Salud SIPROSA desactivado');
    }
    updateLegendDisplay();
    saveUserPreferences();
  });

  // Plugin 4: Red Hidrográfica (Ríos)
  document.getElementById('chkPluginRios').addEventListener('change', e => {
    state.pluginsActive.rivers = e.target.checked;
    updatePluginUIStatus('chkPluginRios', e.target.checked);
    if (state.mapLayersHidden && e.target.checked) {
      state.mapLayersHidden = false;
      updateClearButtonUI();
    }
    if (e.target.checked) {
      if (state.layers.rivers) state.map.addLayer(state.layers.rivers);
      showToast('Capa de Ríos activada');
    } else {
      if (state.layers.rivers) state.map.removeLayer(state.layers.rivers);
      showToast('Capa de Ríos oculta');
    }
    updateLegendDisplay();
    saveUserPreferences();
  });

  // Plugin 5: Masas de Calor 24h
  document.getElementById('chkPluginCalor').addEventListener('change', e => {
    state.pluginsActive.calor = e.target.checked;
    updatePluginUIStatus('chkPluginCalor', e.target.checked);
    if (state.mapLayersHidden && e.target.checked) {
      state.mapLayersHidden = false;
      updateClearButtonUI();
    }
    if (e.target.checked) {
      updateHeatmapForHour(state.currentHeatHour);
      showToast('Mapa de Calor 24h activado');
    } else {
      if (state.heatPlaying) toggleHeatPlay();
      if (state.layers.heat) {
        state.map.removeLayer(state.layers.heat);
        state.layers.heat = null;
      }
      showToast('Mapa de Calor desactivado');
    }
    saveUserPreferences();
  });

  // Plugin 6: Vialidad y Rutas Críticas
  const chkRutas = document.getElementById('chkPluginRutas');
  if (chkRutas) {
    chkRutas.addEventListener('change', e => {
      state.pluginsActive.rutas = e.target.checked;
      updatePluginUIStatus('chkPluginRutas', e.target.checked);
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      if (e.target.checked) {
        if (state.layers.rutas) state.map.addLayer(state.layers.rutas);
        showToast('Capa Vialidad y Rutas Críticas activada');
      } else {
        if (state.layers.rutas) state.map.removeLayer(state.layers.rutas);
        showToast('Capa Rutas Críticas oculta');
      }
      updateLegendDisplay();
      saveUserPreferences();
    });
  }

  // Plugin 7: Defensa Civil y Refugios
  const chkDefensa = document.getElementById('chkPluginDefensaCivil');
  if (chkDefensa) {
    chkDefensa.addEventListener('change', e => {
      state.pluginsActive.defensaCivil = e.target.checked;
      updatePluginUIStatus('chkPluginDefensaCivil', e.target.checked);
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      if (e.target.checked) {
        if (state.layers.defensaCivil) state.map.addLayer(state.layers.defensaCivil);
        showToast('Capa Defensa Civil y Refugios activada');
      } else {
        if (state.layers.defensaCivil) state.map.removeLayer(state.layers.defensaCivil);
        showToast('Capa Defensa Civil oculta');
      }
      updateLegendDisplay();
      saveUserPreferences();
    });
  }

  // Plugin 8: InundaRisk Sentinel (FloodRisk & Google FloodHub)
  const chkInundaciones = document.getElementById('chkPluginInundaciones');
  if (chkInundaciones) {
    chkInundaciones.addEventListener('change', e => {
      state.pluginsActive.inundaciones = e.target.checked;
      updatePluginUIStatus('chkPluginInundaciones', e.target.checked);
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      if (e.target.checked) {
        if (state.layers.inundaciones) state.map.addLayer(state.layers.inundaciones);
        showToast('Plugin InundaRisk Sentinel activado (12 zonas de riesgo)');
      } else {
        if (state.layers.inundaciones) state.map.removeLayer(state.layers.inundaciones);
        showToast('Capa InundaRisk Sentinel oculta');
      }
      updateLegendDisplay();
      saveUserPreferences();
    });
  }

  // Subfiltros de Meteorología
  document.querySelectorAll('[data-filter-org]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-org]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterMeteoOrg = btn.getAttribute('data-filter-org');
      renderMeteoLayer();
    });
  });

  // Subfiltros de Hidrometría (Sensores de Ríos)
  document.querySelectorAll('[data-filter-hidro]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-hidro]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterHidroTendencia = btn.getAttribute('data-filter-hidro');
      renderHidroLayer();
    });
  });

  // Subfiltros de Salud
  document.querySelectorAll('[data-filter-salud]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-salud]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterSaludTipo = btn.getAttribute('data-filter-salud');
      renderSaludLayer();
    });
  });

  // Subfiltros de Inundaciones (FloodRisk)
  document.querySelectorAll('[data-filter-inundacion]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-inundacion]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterInundacionRiesgo = btn.getAttribute('data-filter-inundacion');
      renderInundacionesLayer();
    });
  });

  // Plugin 9: Bomberos Sentinel (Red Provincial de Cuarteles y Rescate)
  const chkBomberos = document.getElementById('chkPluginBomberos');
  if (chkBomberos) {
    chkBomberos.addEventListener('change', async e => {
      state.pluginsActive.bomberos = e.target.checked;
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      const card = document.getElementById('cardPluginBomberos');
      if (card) {
        const tag = card.querySelector('.vsc-ext-status-tag');
        if (tag) {
          tag.textContent = e.target.checked ? 'En Mapa' : 'Desactivado';
          tag.classList.toggle('active', e.target.checked);
        }
      }
      if (e.target.checked) {
        if (!state.bomberosList || state.bomberosList.length === 0) {
          await loadBomberosData();
        }
        renderBomberosLayer();
        if (state.layers.bomberos && !state.map.hasLayer(state.layers.bomberos)) {
          state.map.addLayer(state.layers.bomberos);
        }
        showToast(`Plugin Bomberos Sentinel activado (${state.bomberosList.length || 26} cuarteles)`);
      } else {
        if (state.layers.bomberos && state.map.hasLayer(state.layers.bomberos)) {
          state.map.removeLayer(state.layers.bomberos);
        }
        showToast('Capa Bomberos Sentinel oculta');
      }
      updateLegendDisplay();
      saveUserPreferences();
    });
  }

  // Subfiltros de Bomberos Sentinel
  document.querySelectorAll('[data-filter-bombero]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-bombero]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterBomberoEstado = btn.getAttribute('data-filter-bombero');
      renderBomberosLayer();
    });
  });

  // Plugin 10: PyroScan Sentinel (Focos de Calor NASA FIRMS)
  const chkIncendios = document.getElementById('chkPluginIncendios');
  if (chkIncendios) {
    chkIncendios.addEventListener('change', e => {
      state.pluginsActive.incendios = e.target.checked;
      updatePluginUIStatus('chkPluginIncendios', e.target.checked);
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      if (e.target.checked) {
        renderFocosIncendioLayer();
        showToast('Plugin PyroScan Sentinel activado (NASA FIRMS)');
      } else {
        if (state.layers.incendios) state.map.removeLayer(state.layers.incendios);
        if (state.layers.focosHeatmap) state.map.removeLayer(state.layers.focosHeatmap);
        showToast('Capa PyroScan Sentinel oculta');
      }
      saveUserPreferences();
    });
  }

  // Subfiltros de PyroScan (Focos de Calor NASA FIRMS)
  document.querySelectorAll('[data-filter-pyro]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-filter-pyro]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const filterVal = e.currentTarget.getAttribute('data-filter-pyro');
      if (filterVal === 'heatmap') {
        state.pyroDisplayMode = 'heatmap';
      } else {
        state.pyroDisplayMode = 'points';
        state.filterPyroConfidence = filterVal;
      }
      renderFocosIncendioLayer();
    });
  });

  // Botón de Sincronización Manual NASA FIRMS
  const btnSyncFirms = document.getElementById('btnSyncFirms');
  if (btnSyncFirms) {
    btnSyncFirms.addEventListener('click', async () => {
      showToast('Consultando API satelital de NASA FIRMS...');
      try {
        const res = await fetch('api.php?action=fetch_firms_data');
        if (res.ok) {
          const json = await res.json();
          showToast(`Telemetría FIRMS actualizada: ${json.total_focos} focos registrados`);
          const txtUpdate = document.getElementById('txtFirmsLastUpdate');
          if (txtUpdate) txtUpdate.textContent = `Última sync: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
      } catch (err) {
        showToast('Error al conectar con NASA FIRMS');
      }
    });
  }

  // Plugin 11: Presas y Riesgo Hidrológico (ORSEP)
  const chkPresas = document.getElementById('chkPluginPresas');
  if (chkPresas) {
    chkPresas.addEventListener('change', async e => {
      state.pluginsActive.presas = e.target.checked;
      if (state.mapLayersHidden && e.target.checked) {
        state.mapLayersHidden = false;
        updateClearButtonUI();
      }
      const card = document.getElementById('cardPluginPresas');
      if (card) {
        const tag = card.querySelector('.vsc-ext-status-tag');
        if (tag) {
          tag.textContent = e.target.checked ? 'En Mapa' : 'Desactivado';
          tag.classList.toggle('active', e.target.checked);
        }
      }
      if (e.target.checked) {
        if (!state.presasList || state.presasList.length === 0) {
          await loadPresasData();
        }
        renderPresasLayer();
        if (state.layers.presas && !state.map.hasLayer(state.layers.presas)) {
          state.map.addLayer(state.layers.presas);
        }
        showToast(`Plugin Presas y Riesgo Hidrológico activado (${state.presasList.length || 5} obras)`);
      } else {
        if (state.layers.presas && state.map.hasLayer(state.layers.presas)) {
          state.map.removeLayer(state.layers.presas);
        }
        showToast('Capa Presas y Riesgo Hidrológico oculta');
      }
      updateLegendDisplay();
      saveUserPreferences();
    });
  }

  // Subfiltros de Presas y Riesgo Hidrológico
  document.querySelectorAll('[data-filter-presa]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-presa]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterPresaTipo = btn.getAttribute('data-filter-presa');
      renderPresasLayer();
    });
  });
}

function updateHidroMetricsUI() {
  if (!state.hidroList || state.hidroList.length === 0) return;

  const tucumanHidroList = state.hidroList.filter(h => {
    if (h.es_tucuman === false || (h.provincia && h.provincia !== 'Tucumán')) return false;
    const lat = h.lat || h.latitud;
    const lon = h.lon || h.longitud;
    if (lat && lon) return (lat >= -28.02 && lat <= -26.04) && (lon >= -66.18 && lon <= -64.48);
    return true;
  });

  // Conteo en tarjeta de plugin
  const badgeCard = document.getElementById('badgeCountHidro');
  if (badgeCard) badgeCard.textContent = `${tucumanHidroList.length} aforos tucumanos`;

  // Métricas agregadas
  let sumCaudal = 0;
  let maxLvl = -999;
  let alertCount = 0;

  tucumanHidroList.forEach(h => {
    if (h.caudal_estimado_m3s) sumCaudal += h.caudal_estimado_m3s;
    if (h.altura_m !== null && h.altura_m > maxLvl) maxLvl = h.altura_m;
    if (h.altura_m >= 3.0 || h.tendencia === 'crece' || (h.nivel_alerta && h.nivel_alerta.includes('Alerta'))) {
      alertCount++;
    }
  });

  const elCaudal = document.getElementById('statCaudalTotal');
  if (elCaudal) elCaudal.textContent = `${sumCaudal.toFixed(1)} m³/s`;

  const elMax = document.getElementById('statNivelMax');
  if (elMax && maxLvl > -999) elMax.textContent = `${maxLvl.toFixed(2)} m`;

  const elAlert = document.getElementById('statHidroAlertCount');
  if (elAlert) {
    elAlert.textContent = `${state.hidroList.length} estaciones INA • ${alertCount > 0 ? alertCount + ' en vigilancia/alerta' : 'Sin alertas críticas'}`;
  }

  // Lista interactiva de los principales ríos con mayor caudal en la vista Métricas
  const listEl = document.getElementById('hidroTopRiversList');
  if (listEl) {
    const sorted = [...state.hidroList].sort((a, b) => (b.caudal_estimado_m3s || 0) - (a.caudal_estimado_m3s || 0)).slice(0, 5);
    listEl.innerHTML = sorted.map(h => {
      const origIdx = state.hidroList.indexOf(h);
      const tendIcon = h.tendencia === 'crece' ? '🔺' : (h.tendencia === 'baja' ? '🔻' : '⏸️');
      return `
        <div class="top-river-item" onclick="window.inspectEntity('hidro', ${origIdx})" title="Inspeccionar ${h.nombre}">
          <span class="top-river-name">${h.rio || h.nombre}</span>
          <div class="top-river-stats">
            <span>${h.altura_m ?? '--'}m ${tendIcon}</span>
            <strong style="color:#0284c7;">${h.caudal_estimado_m3s ?? 0} m³/s</strong>
          </div>
        </div>
      `;
    }).join('');
  }
}

function updateLegendDisplay() {
  const legHidro = document.getElementById('legHidro');
  const legSalud = document.getElementById('legSalud');
  const legRutas = document.getElementById('legRutas');
  const legDefensa = document.getElementById('legDefensa');
  const legCalor = document.getElementById('legCalorScale');
  if (legHidro) legHidro.classList.toggle('hidden', !state.pluginsActive.hidro);
  if (legSalud) legSalud.classList.toggle('hidden', !state.pluginsActive.salud);
  if (legRutas) legRutas.classList.toggle('hidden', !state.pluginsActive.rutas);
  if (legDefensa) legDefensa.classList.toggle('hidden', !state.pluginsActive.defensaCivil);
  if (legCalor) legCalor.classList.toggle('hidden', !state.pluginsActive.calor);
}

// =============================================================
// REPRODUCTOR DE MASAS DE CALOR 24H
// =============================================================
function preloadHourlyForecasts() {
  state.stations.forEach(st => {
    const baseTemp = (st.telemetria_oficial && st.telemetria_oficial.temperatura_c !== null)
      ? st.telemetria_oficial.temperatura_c
      : (22 - (st.altitud_m / 180));

    const hourlyTemps = [];
    for (let h = 0; h < 24; h++) {
      const cycle = Math.sin(((h - 9) / 24) * 2 * Math.PI);
      const tempH = baseTemp + (cycle * 6.5);
      hourlyTemps.push(Math.round(tempH * 10) / 10);
    }
    state.hourlyHeatData.set(st.id, hourlyTemps);
  });
}

function updateHeatmapForHour(hour) {
  state.currentHeatHour = hour;

  const heatPoints = [];
  state.stations.forEach(st => {
    const temps = state.hourlyHeatData.get(st.id);
    const t = temps ? temps[hour] : 18;
    const intensity = Math.max(0.15, Math.min(1.0, (t - 8) / 20));
    heatPoints.push([st.lat, st.lon, intensity]);
    heatPoints.push([st.lat + 0.015, st.lon + 0.015, intensity * 0.85]);
    heatPoints.push([st.lat - 0.015, st.lon - 0.015, intensity * 0.85]);
  });

  if (state.layers.heat) {
    state.layers.heat.setLatLngs(heatPoints);
  } else if (typeof L.heatLayer === 'function') {
    state.layers.heat = L.heatLayer(heatPoints, {
      radius: 46,
      blur: 32,
      maxZoom: 14,
      max: 1.0,
      gradient: {
        0.15: '#2563eb',
        0.35: '#06b6d4',
        0.55: '#10b981',
        0.75: '#f59e0b',
        0.95: '#ef4444'
      }
    }).addTo(state.map);
  }

  const hourPadded = hour.toString().padStart(2, '0');
  const elTag = document.getElementById('heatHourTag');
  if (elTag) elTag.textContent = `${hourPadded}:00 hs`;
  const elHourText = document.getElementById('heatCurrentHourText');
  if (elHourText) elHourText.textContent = `${hourPadded}:00 hs`;
  const elLegHour = document.getElementById('legHeatCurrentHour');
  if (elLegHour) elLegHour.textContent = `${hourPadded}:00 hs`;
  const elSlider = document.getElementById('heatRangeSlider');
  if (elSlider) elSlider.value = hour;
}

function toggleHeatPlay() {
  state.heatPlaying = !state.heatPlaying;
  const playIcon = document.getElementById('playIcon');
  const lblPlay = document.getElementById('lblPlayHeat');

  // Asegurar que el plugin de calor esté encendido
  const chkCalor = document.getElementById('chkPluginCalor');
  if (!chkCalor.checked) {
    chkCalor.checked = true;
    state.pluginsActive.calor = true;
    updateHeatmapForHour(state.currentHeatHour);
  }

  if (state.heatPlaying) {
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    lblPlay.textContent = 'Pausar Ciclo';
    state.heatPlayTimer = setInterval(() => {
      let nextHour = (state.currentHeatHour + 1) % 24;
      updateHeatmapForHour(nextHour);
    }, 800);
  } else {
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    lblPlay.textContent = 'Reproducir Ciclo 24h';
    clearInterval(state.heatPlayTimer);
    state.heatPlayTimer = null;
  }
}

// =============================================================
// LOCALIZACIÓN DIRECTA EN EL MAPA DESDE BÚSQUEDA
// =============================================================
window.locateEntityFromSearch = function(type, idOrIndex) {
  // 1. Colapsar el panel lateral para permitir al usuario ver el mapa completo de inmediato
  const sidebar = document.getElementById('sidebarLeft');
  if (sidebar) {
    sidebar.classList.add('collapsed');
  }
  document.querySelectorAll('.vsc-tab-icon').forEach(t => t.classList.remove('active'));

  // 2. Notificar a Leaflet para recalculación inmediata del tamaño
  if (state.map) {
    state.map.invalidateSize();
    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 250);
  }

  // 3. Localizar entidad según tipo
  if (type === 'salud') {
    highlightEfectorOnMap(idOrIndex);
  } else if (type === 'meteo') {
    if (!state.map.hasLayer(state.layers.meteo)) {
      state.map.addLayer(state.layers.meteo);
      state.pluginsActive.meteo = true;
      updatePluginUIStatus('chkPluginMeteo', true);
      updateLegendDisplay();
      saveUserPreferences();
    }
    const st = state.stations.find(s => s.id === idOrIndex);
    if (st) {
      state.map.flyTo([st.lat, st.lon], 15, { animate: true, duration: 1 });
      showToast(`📍 Estación localizada: ${st.nombre}`);
    }
  } else if (type === 'hidro') {
    if (!state.map.hasLayer(state.layers.hidro)) {
      state.map.addLayer(state.layers.hidro);
      state.pluginsActive.hidro = true;
      updatePluginUIStatus('chkPluginHidro', true);
      updateLegendDisplay();
      saveUserPreferences();
    }
    const h = state.hidroList[idOrIndex];
    if (h) {
      state.map.flyTo([h.lat, h.lon], 15, { animate: true, duration: 1 });
      showToast(`💧 Aforo localizado: ${h.rio || h.nombre}`);
    }
  } else {
    inspectEntity(type, idOrIndex, true);
  }
};

// =============================================================
// BÚSQUEDA UNIVERSAL
// =============================================================
function performUniversalSearch() {
  const query = state.universalSearchQuery.toLowerCase().trim();
  const listContainer = document.getElementById('searchResultsList');
  if (!listContainer) return;

  if (!query) {
    listContainer.innerHTML = '<div style="color:#64748b; font-size:0.75rem; padding:12px; text-align:center;">Escribe para buscar estaciones meteorológicas, aforos de ríos o efectores de salud.</div>';
    return;
  }

  const results = [];

  // Buscar en Estaciones Meteorológicas
  if (state.universalSearchCat === 'all' || state.universalSearchCat === 'meteo') {
    state.stations.forEach(st => {
      if (st.nombre.toLowerCase().includes(query) || (st.departamento && st.departamento.toLowerCase().includes(query)) || (st.localidad && st.localidad.toLowerCase().includes(query))) {
        results.push({
          type: 'meteo',
          id: st.id,
          title: st.nombre,
          sub: `${st.organismo} • ${st.localidad || ''} (${st.departamento || ''})`,
          badge: 'Clima',
          badgeClass: 'meteo'
        });
      }
    });
  }

  // Buscar en Hidrometría / Sensores de Ríos
  if (state.universalSearchCat === 'all' || state.universalSearchCat === 'hidro') {
    state.hidroList.forEach((h, idx) => {
      const matchQuery = h.nombre.toLowerCase().includes(query) ||
                         (h.rio && h.rio.toLowerCase().includes(query)) ||
                         (h.tramo && h.tramo.toLowerCase().includes(query)) ||
                         (query === 'rio' || query === 'río' || query === 'caudal' || query === 'crecida' || query === 'alerta');
      if (matchQuery) {
        const tendIcon = h.tendencia === 'crece' ? '🔺' : (h.tendencia === 'baja' ? '🔻' : '⏸️');
        results.push({
          type: 'hidro',
          id: idx,
          title: h.rio || h.nombre,
          sub: `${h.tramo ? h.tramo + ' • ' : ''}Nivel: ${h.altura_m ?? '--'}m ${tendIcon} • Caudal: ${h.caudal_estimado_m3s ?? '--'} m³/s`,
          badge: h.nivel_alerta || 'Río INA',
          badgeClass: 'hidro'
        });
      }
    });
  }

  // Buscar en Efectores de Salud SIPROSA
  if (state.universalSearchCat === 'all' || state.universalSearchCat === 'salud') {
    const normQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    state.saludList.forEach((s, idx) => {
      const normEfector = (s.efector || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normEfector.includes(normQuery)) {
        results.push({
          type: 'salud',
          id: idx,
          title: s.efector,
          sub: 'SIPROSA Tucumán',
          badge: 'Salud',
          badgeClass: 'salud'
        });
      }
    });
  }

  // Buscar en Vialidad y Rutas Críticas
  state.rutasList.forEach((r, idx) => {
    if (r.nombre.toLowerCase().includes(query) || r.ruta.toLowerCase().includes(query) || (r.tipo && r.tipo.toLowerCase().includes(query))) {
      results.push({
        type: 'rutas',
        id: idx,
        title: r.nombre,
        sub: `${r.ruta} (${r.km}) • Estado: ${r.estado_transito}`,
        badge: 'Vialidad',
        badgeClass: 'meteo'
      });
    }
  });

  // Buscar en Defensa Civil y Refugios
  state.defensaCivilList.forEach((d, idx) => {
    if (d.nombre.toLowerCase().includes(query) || (d.localidad && d.localidad.toLowerCase().includes(query)) || (d.departamento && d.departamento.toLowerCase().includes(query))) {
      results.push({
        type: 'defensaCivil',
        id: idx,
        title: d.nombre,
        sub: `${d.tipo} (${d.departamento}) • Capacidad: ${d.capacidad_personas}p`,
        badge: 'Defensa Civil',
        badgeClass: 'salud'
      });
    }
  });

  // Buscar en InundaRisk Sentinel (FloodRisk & Google FloodHub)
  state.inundacionesList.forEach((item, idx) => {
    if (item.nombre.toLowerCase().includes(query) || (item.rio_principal && item.rio_principal.toLowerCase().includes(query)) || (item.departamento && item.departamento.toLowerCase().includes(query)) || query.includes('inundac') || query.includes('flood') || query.includes('crecida')) {
      results.push({
        type: 'inundaciones',
        id: idx,
        title: item.nombre,
        sub: `${item.rio_principal} (${item.departamento}) • ${item.nivel_riesgo}`,
        badge: 'FloodRisk',
        badgeClass: 'hidro'
      });
    }
  });

  // Buscar en Bomberos Voluntarios (Cuarteles y Rescate)
  state.bomberosList.forEach((b, idx) => {
    if (
      b.nombre.toLowerCase().includes(query) ||
      (b.localidad && b.localidad.toLowerCase().includes(query)) ||
      (b.direccion && b.direccion.toLowerCase().includes(query)) ||
      (b.observaciones && b.observaciones.toLowerCase().includes(query)) ||
      query.includes('bomb') ||
      query.includes('cuartel') ||
      query.includes('fuego') ||
      query.includes('rescate')
    ) {
      results.push({
        type: 'bomberos',
        id: idx,
        title: b.nombre,
        sub: `📍 ${b.localidad} · ${b.direccion} • Estado: ${b.estado || 'Verificado'}`,
        badge: 'Bomberos',
        badgeClass: 'salud'
      });
    }
  });

  // Buscar en PyroScan Sentinel (NASA FIRMS / VIIRS Focos de Calor)
  state.focosIncendioList.forEach((item, idx) => {
    if ((item.departamento && item.departamento.toLowerCase().includes(query)) || item.satellite.toLowerCase().includes(query) || (item.id && item.id.toLowerCase().includes(query)) || query.includes('incend') || query.includes('foco') || query.includes('calor') || query.includes('firms') || query.includes('viirs') || query.includes('fuego')) {
      results.push({
        type: 'incendios',
        id: idx,
        title: `Foco de Calor en ${item.departamento} (${item.frp_mw} MW)`,
        sub: `NASA FIRMS ${item.satellite} • Confianza ${item.confidence} (${item.confidence_pct}%) • Temp: ${item.brightness_temp_c}°C`,
        badge: 'NASA FIRMS',
        badgeClass: 'meteo'
      });
    }
  });

  // Buscar en Presas y Riesgo Hidrológico (ORSEP)
  state.presasList.forEach((p, idx) => {
    if (
      p.nombre.toLowerCase().includes(query) ||
      (p.alias && p.alias.toLowerCase().includes(query)) ||
      (p.complejo && p.complejo.toLowerCase().includes(query)) ||
      (p.rio && p.rio.toLowerCase().includes(query)) ||
      (p.cuenca && p.cuenca.toLowerCase().includes(query)) ||
      (p.departamento && p.departamento.toLowerCase().includes(query)) ||
      (p.operador && p.operador.toLowerCase().includes(query)) ||
      query.includes('presa') ||
      query.includes('dique') ||
      query.includes('embalse') ||
      query.includes('derivador') ||
      query.includes('orsep') ||
      query.includes('cadillal') ||
      query.includes('escaba') ||
      query.includes('batiruana') ||
      query.includes('reales') ||
      query.includes('horqueta')
    ) {
      results.push({
        type: 'presas',
        id: idx,
        title: `${p.nombre} (${p.tipo})`,
        sub: `Complejo ${p.complejo} · ${p.rio} (${p.departamento}) · ORSEP`,
        badge: 'ORSEP',
        badgeClass: 'hidro'
      });
    }
  });

  if (results.length === 0) {
    listContainer.innerHTML = '<div style="color:#64748b; font-size:0.75rem; padding:12px; text-align:center;">No se encontraron resultados para esta búsqueda.</div>';
    return;
  }

  listContainer.innerHTML = results.slice(0, 40).map(r => `
    <div class="search-res-item" onclick="window.locateEntityFromSearch('${r.type}', '${r.id}')">
      <div class="search-res-title">
        <h5>${r.title}</h5>
        <p>${r.sub}</p>
      </div>
      <span class="search-res-badge ${r.badgeClass}">${r.badge}</span>
    </div>
  `).join('');
}

// =============================================================
// NAVEGACIÓN Y EVENTOS GENERALES
// =============================================================
function updateClearButtonUI() {
  const btnClear = document.getElementById('btnClearMap');
  const btnVscClear = document.getElementById('btnVscClear');

  if (state.mapLayersHidden) {
    // ESTADO: MAPA LIMPIO / MARCAS OCULTAS -> BOTÓN EN ROJO
    if (btnClear) {
      btnClear.classList.remove('visible-state-green');
      btnClear.classList.add('hidden-state-red');
      const span = btnClear.querySelector('span');
      if (span) span.textContent = 'Mostrar Capas';
      btnClear.title = 'Capas ocultas temporalmente. Haz clic para volver a ver las marcas en el mapa';
    }
    if (btnVscClear) {
      btnVscClear.classList.remove('vsc-btn-green');
      btnVscClear.classList.add('vsc-btn-red');
      btnVscClear.title = 'Capas ocultas temporalmente (Clic para volver a verlas)';
    }
  } else {
    // ESTADO: MAPA CON CAPAS ACTIVAS VISIBLES -> BOTÓN EN VERDE
    if (btnClear) {
      btnClear.classList.remove('hidden-state-red');
      btnClear.classList.add('visible-state-green');
      const span = btnClear.querySelector('span');
      if (span) span.textContent = 'Limpiar Mapa';
      btnClear.title = 'Limpiar mapa: oculta las marcas de las capas activas sin desactivar los plugins';
    }
    if (btnVscClear) {
      btnVscClear.classList.remove('vsc-btn-red');
      btnVscClear.classList.add('vsc-btn-green');
      btnVscClear.title = 'Limpiar mapa (Ocultar marcas de las capas activas)';
    }
  }
}
window.updateClearButtonUI = updateClearButtonUI;

function toggleMapVisibility() {
  state.mapLayersHidden = !state.mapLayersHidden;

  if (state.mapLayersHidden) {
    // 1. Cerrar popups e inspectores abiertos
    if (state.map) state.map.closePopup();

    // 2. Ocultar del mapa todas las capas visibles SIN alterar los plugins activos ni desmarcar checkboxes
    if (state.layers.meteo && state.map.hasLayer(state.layers.meteo)) {
      state.map.removeLayer(state.layers.meteo);
    }
    if (state.layers.hidro && state.map.hasLayer(state.layers.hidro)) {
      state.map.removeLayer(state.layers.hidro);
    }
    if (state.layers.salud && state.map.hasLayer(state.layers.salud)) {
      state.map.removeLayer(state.layers.salud);
    }
    if (state.layers.rivers && state.map.hasLayer(state.layers.rivers)) {
      state.map.removeLayer(state.layers.rivers);
    }
    if (state.layers.heat && state.map.hasLayer(state.layers.heat)) {
      state.map.removeLayer(state.layers.heat);
    }
    if (state.layers.rutas && state.map.hasLayer(state.layers.rutas)) {
      state.map.removeLayer(state.layers.rutas);
    }
    if (state.layers.defensaCivil && state.map.hasLayer(state.layers.defensaCivil)) {
      state.map.removeLayer(state.layers.defensaCivil);
    }
    if (state.layers.inundaciones && state.map.hasLayer(state.layers.inundaciones)) {
      state.map.removeLayer(state.layers.inundaciones);
    }
    if (state.layers.bomberos && state.map.hasLayer(state.layers.bomberos)) {
      state.map.removeLayer(state.layers.bomberos);
    }
    if (state.layers.incendios && state.map.hasLayer(state.layers.incendios)) {
      state.map.removeLayer(state.layers.incendios);
    }
    if (state.layers.focosHeatmap && state.map.hasLayer(state.layers.focosHeatmap)) {
      state.map.removeLayer(state.layers.focosHeatmap);
    }
    if (state.layers.presas && state.map.hasLayer(state.layers.presas)) {
      state.map.removeLayer(state.layers.presas);
    }

    // Módulos dinámicos instalados
    Object.keys(state.installedModules).forEach(modKey => {
      const mod = state.installedModules[modKey];
      if (mod && mod.layer && state.map.hasLayer(mod.layer)) {
        state.map.removeLayer(mod.layer);
      }
    });

    // Actualizar estilo a ROJO
    updateClearButtonUI();
    showToast('🧹 Mapa despejado: marcas ocultas temporalmente (los plugins siguen activos)');
  } else {
    // 3. Volver a mostrar en el mapa SOLO lo que el usuario tiene activado
    if (state.pluginsActive.meteo && state.layers.meteo && !state.map.hasLayer(state.layers.meteo)) {
      state.map.addLayer(state.layers.meteo);
    }
    if (state.pluginsActive.hidro && state.layers.hidro && !state.map.hasLayer(state.layers.hidro)) {
      state.map.addLayer(state.layers.hidro);
    }
    if (state.pluginsActive.salud && state.layers.salud && !state.map.hasLayer(state.layers.salud)) {
      state.map.addLayer(state.layers.salud);
    }
    if (state.pluginsActive.rivers && state.layers.rivers && !state.map.hasLayer(state.layers.rivers)) {
      state.map.addLayer(state.layers.rivers);
    }
    if (state.pluginsActive.calor) {
      updateHeatmapForHour(state.currentHeatHour);
    }
    if (state.pluginsActive.rutas && state.layers.rutas && !state.map.hasLayer(state.layers.rutas)) {
      state.map.addLayer(state.layers.rutas);
    }
    if (state.pluginsActive.defensaCivil && state.layers.defensaCivil && !state.map.hasLayer(state.layers.defensaCivil)) {
      state.map.addLayer(state.layers.defensaCivil);
    }
    if (state.pluginsActive.inundaciones && state.layers.inundaciones && !state.map.hasLayer(state.layers.inundaciones)) {
      state.map.addLayer(state.layers.inundaciones);
    }
    if (state.pluginsActive.bomberos && state.layers.bomberos && !state.map.hasLayer(state.layers.bomberos)) {
      state.map.addLayer(state.layers.bomberos);
    }
    if (state.pluginsActive.incendios && state.layers.incendios && !state.map.hasLayer(state.layers.incendios)) {
      state.map.addLayer(state.layers.incendios);
    }
    if (state.pluginsActive.presas && state.layers.presas && !state.map.hasLayer(state.layers.presas)) {
      state.map.addLayer(state.layers.presas);
    }

    // Módulos dinámicos instalados
    Object.keys(state.installedModules).forEach(modKey => {
      const mod = state.installedModules[modKey];
      if (mod && mod.active && mod.layer && !state.map.hasLayer(mod.layer)) {
        state.map.addLayer(mod.layer);
      }
    });

    updateLegendDisplay();
    // Actualizar estilo a VERDE
    updateClearButtonUI();
    showToast('👁️ Marcas restauradas en el mapa');
  }
}
window.toggleMapVisibility = toggleMapVisibility;
window.clearMap = toggleMapVisibility; // Alias por compatibilidad retroactiva

// =============================================================
// DESACTIVAR TODOS LOS PLUGINS Y MÓDULOS DEL MAPA
// =============================================================
function deactivateAllPlugins() {
  // 1. Detener parpadeo de efectores y balizas si existen
  clearEfectorHighlight();

  // 2. Detener reproductor de calor si está corriendo
  if (state.heatPlaying && typeof toggleHeatPlay === 'function') {
    toggleHeatPlay();
  }

  // 3. Cerrar popups del mapa e inspectores
  if (state.map) state.map.closePopup();
  const emptyState = document.getElementById('inspectorEmptyState');
  const inspContent = document.getElementById('inspectorContent');
  if (emptyState) emptyState.classList.remove('hidden');
  if (inspContent) inspContent.classList.add('hidden');
  state.selectedEntity = null;

  // 4. Apagar todos los estados de plugins en memoria
  Object.keys(state.pluginsActive).forEach(k => {
    state.pluginsActive[k] = false;
  });

  // 5. Apagar TODOS los interruptores deslizantes (switches/checkboxes) sin excepción
  document.querySelectorAll('.plugin-switch input[type="checkbox"], input[id^="chkPlugin"], .plugin-card input[type="checkbox"], .vsc-extension-item input[type="checkbox"]').forEach(chk => {
    chk.checked = false;
  });

  // 6. Desactivar tarjetas y actualizar etiquetas de estado visuales
  document.querySelectorAll('.plugin-card, .vsc-extension-item').forEach(card => {
    card.classList.remove('active');
    const tag = card.querySelector('.vsc-ext-status-tag');
    if (tag) {
      tag.textContent = 'Desactivado';
      tag.classList.remove('active');
    }
  });

  // 7. Desactivar checkboxes de módulos dinámicos instalados
  document.querySelectorAll('#installedModulesList input[type="checkbox"]').forEach(chk => {
    chk.checked = false;
  });

  // 5. Remover TODAS las capas y marcas del mapa incondicionalmente
  if (state.map) {
    state.map.eachLayer(layer => {
      // Proteger mapas base y el límite poligonal de Tucumán
      if (layer instanceof L.TileLayer) return;
      if (layer === state.boundaryLayer) return;
      try {
        state.map.removeLayer(layer);
      } catch (e) {}
    });
  }

  // 6. Remover referencias a capas en state.layers
  if (state.layers) {
    ['meteo', 'hidro', 'salud', 'rivers', 'rutas', 'defensaCivil', 'inundaciones', 'bomberos', 'incendios', 'focosHeatmap', 'presas'].forEach(k => {
      const lyr = state.layers[k];
      if (lyr && state.map && state.map.hasLayer(lyr)) {
        try { state.map.removeLayer(lyr); } catch (e) {}
      }
    });
    if (state.layers.heat) {
      try { state.map.removeLayer(state.layers.heat); } catch (e) {}
      state.layers.heat = null;
    }
    if (state.layers.simuladorBuffer) state.layers.simuladorBuffer.clearLayers();
    if (state.layers.timelineStorm) state.layers.timelineStorm.clearLayers();
  }

  // 7. Desactivar módulos dinámicos
  if (state.installedModules) {
    Object.keys(state.installedModules).forEach(modKey => {
      const mod = state.installedModules[modKey];
      if (mod) {
        mod.active = false;
      }
    });

    // Desmarcar checkboxes de módulos dinámicos en la lista
    document.querySelectorAll('#installedModulesList input[type="checkbox"]').forEach(chk => {
      chk.checked = false;
    });
  }

  // 6. Resetear estado de capas ocultas del botón limpiar
  state.mapLayersHidden = false;
  updateClearButtonUI();

  // 7. Actualizar la leyenda flotante
  updateLegendDisplay();

  // 8. Persistir preferencias en localStorage
  saveUserPreferences();

  showToast('🔌 Todos los módulos y plugins han sido desactivados');
}
window.deactivateAllPlugins = deactivateAllPlugins;

function recenterMap() {
  if (state.boundaryLayer) {
    state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [35, 35], maxZoom: 10, animate: true });
  } else {
    state.map.setView([-26.95, -65.35], 9, { animate: true });
  }
  showToast('🗺️ Mapa centrado en la Provincia de Tucumán');
}
window.recenterMap = recenterMap;

window.viewPluginOnMap = function(pluginKey) {
  switchSidebarView('viewCapasMapa');
  const mapping = {
    'meteo': 'chkPluginMeteo',
    'hidro': 'chkPluginHidro',
    'salud': 'chkPluginSalud',
    'rios': 'chkPluginRios',
    'calor': 'chkPluginCalor',
    'rutas': 'chkPluginRutas',
    'defensaCivil': 'chkPluginDefensaCivil'
  };
  const chkId = mapping[pluginKey];
  if (chkId) {
    const chk = document.getElementById(chkId);
    if (chk && !chk.checked) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change'));
    }
  }
  showToast('Visualizando módulo en el mapa');
};

function openSidebar() {
  document.getElementById('sidebarLeft').classList.remove('collapsed');
}

function switchSidebarView(viewId) {
  if (viewId === 'viewInstallModule' && !isSysadminAuthenticated()) {
    requireSysadminAuth(() => switchSidebarView('viewInstallModule'));
    return;
  }
  openSidebar();

  // Sincronizar iconos en la Activity Bar de VSC
  document.querySelectorAll('.vsc-tab-icon').forEach(btn => {
    const isTarget = btn.getAttribute('data-view') === viewId;
    btn.classList.toggle('active', isTarget);
  });

  // Sincronizar botones nav internos
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  // Mostrar vista correspondiente
  document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

function setupUIEvents() {
  const sidebar = document.getElementById('sidebarLeft');

  // 1. Iconos de la Activity Bar (Estilo VSCode)
  document.querySelectorAll('.vsc-tab-icon[data-view]').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');
      const isCollapsed = sidebar.classList.contains('collapsed');
      const isAlreadyActive = tab.classList.contains('active');

      if (!isCollapsed && isAlreadyActive) {
        // Al cliquear el icono activo, repliega el Side Bar (igual que VSCode)
        sidebar.classList.add('collapsed');
        tab.classList.remove('active');
      } else {
        sidebar.classList.remove('collapsed');
        switchSidebarView(targetView);
      }
    });
  });

  // Botón de ajustes en Activity Bar
  const btnSettings = document.getElementById('btnVscSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      showToast('Capas Base activas: OpenStreetMap (OSM) y ESRI Satelital');
    });
  }

  // 2. Pestañas internas del Gestor de Plugins (Instalados / Catálogo / + Instalar)
  document.querySelectorAll('.pm-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.switchPluginsTab(btn.getAttribute('data-pm-tab'));
    });
  });

  // 3. Filtrado en vivo de extensiones
  const inputSearchP = document.getElementById('inputSearchPlugins');
  if (inputSearchP) {
    inputSearchP.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#installedPluginsList .plugin-card, .catalog-extension-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // 4. Carga de archivo personalizado (Drag & Drop y botón Examinar)
  const fileInput = document.getElementById('inputFileModule');
  const btnBrowse = document.getElementById('btnBrowseFile');
  const dropZone = document.getElementById('dropZoneModule');

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isSysadminAuthenticated()) {
        requireSysadminAuth(() => fileInput.click());
        return;
      }
      fileInput.click();
    });
  }
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
      if (e.target !== btnBrowse) {
        if (!isSysadminAuthenticated()) {
          requireSysadminAuth(() => fileInput.click());
          return;
        }
        fileInput.click();
      }
    });
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (!isSysadminAuthenticated()) {
          requireSysadminAuth(() => handleModuleFileUpload(file));
          return;
        }
        handleModuleFileUpload(file);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleModuleFileUpload(e.target.files[0]);
      }
    });
  }

  // 5. Botón de confirmación de instalación personalizada
  const btnConfirmCustom = document.getElementById('btnRunCustomInstall');
  if (btnConfirmCustom) {
    btnConfirmCustom.addEventListener('click', async () => {
      if (!isSysadminAuthenticated()) {
        requireSysadminAuth(() => btnConfirmCustom.click());
        return;
      }

      const name = document.getElementById('inputCustomName').value.trim() || 'Nueva Capa';
      const url = document.getElementById('inputCustomUrl').value.trim();
      const color = document.querySelector('input[name="moduleColor"]:checked')?.value || '#8b5cf6';

      if (url) {
        try {
          showToast('Descargando GeoJSON desde URL...');
          const res = await fetch(url);
          const data = await res.json();
          window.installCustomModuleData(name, color, data);
        } catch (err) {
          showToast('Error al descargar datos: ' + err.message);
        }
      } else if (fileInput && fileInput.files.length > 0) {
        handleModuleFileUpload(fileInput.files[0]);
      } else {
        showToast('Por favor selecciona un archivo o ingresa una URL de GeoJSON');
      }
    });
  }

  function handleModuleFileUpload(file) {
    if (!isSysadminAuthenticated()) {
      requireSysadminAuth(() => handleModuleFileUpload(file));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const name = document.getElementById('inputCustomName').value.trim() || file.name.replace(/\.[^/.]+$/, '');
      const color = document.querySelector('input[name="moduleColor"]:checked')?.value || '#8b5cf6';
      window.installCustomModuleData(name, color, content);
    };
    reader.readAsText(file);
  }

  document.getElementById('btnCloseSidebar').addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    document.querySelectorAll('.vsc-tab-icon').forEach(t => t.classList.remove('active'));
  });

  document.getElementById('btnOpenSidebar').addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    switchSidebarView('viewCapasMapa');
  });

  // Selector Departamental con auto-zoom
  const selDept = document.getElementById('selectDepartamento');
  if (selDept) {
    selDept.addEventListener('change', (e) => {
      const dept = e.target.value;
      state.selectedDepartamento = dept;
      if (dept === 'all') {
        recenterMap();
      } else if (DEPARTAMENTOS_GEO[dept]) {
        const geo = DEPARTAMENTOS_GEO[dept];
        state.map.flyTo(geo.center, geo.zoom, { animate: true, duration: 1.2 });
        showToast(`Enfocando departamento ${dept}`);
      }
      updateVulnerabilityBadge(dept);
      saveUserPreferences();
    });
  }

  // Botón Boletín de Situación Provincial
  const btnBol = document.getElementById('btnBoletinSituacion');
  if (btnBol) btnBol.addEventListener('click', openSituationReport);

  // Botones para limpiar el mapa (arriba del de centrar)
  const btnClear = document.getElementById('btnClearMap');
  if (btnClear) btnClear.addEventListener('click', toggleMapVisibility);

  const btnVscClear = document.getElementById('btnVscClear');
  if (btnVscClear) btnVscClear.addEventListener('click', toggleMapVisibility);

  // Botones para desactivar todos los plugins (debajo del de limpiar)
  const btnDeact = document.getElementById('btnDeactivatePlugins');
  if (btnDeact) btnDeact.addEventListener('click', deactivateAllPlugins);

  const btnVscDeact = document.getElementById('btnVscDeactivate');
  if (btnVscDeact) btnVscDeact.addEventListener('click', deactivateAllPlugins);

  // Inicializar estado visual del botón (Verde = visible)
  updateClearButtonUI();

  // Botones para centrar el mapa en Tucumán (abajo del de limpiar)
  const btnRecenter = document.getElementById('btnRecenterMap');
  if (btnRecenter) btnRecenter.addEventListener('click', recenterMap);

  const btnVscRecenter = document.getElementById('btnVscRecenter');
  if (btnVscRecenter) btnVscRecenter.addEventListener('click', recenterMap);

  // Deslizador de Grosor del Contorno Provincial de Tucumán
  const sliderBoundary = document.getElementById('sliderBoundaryThickness');
  const lblBoundary = document.getElementById('lblBoundaryThickness');
  if (sliderBoundary) {
    if (state.boundaryWeight) {
      sliderBoundary.value = state.boundaryWeight;
      if (lblBoundary) lblBoundary.textContent = `${state.boundaryWeight.toFixed(1)}px`;
    }
    sliderBoundary.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.boundaryWeight = val;
      if (lblBoundary) lblBoundary.textContent = `${val.toFixed(1)}px`;
      if (state.boundaryLayer) {
        state.boundaryLayer.setStyle({ weight: val });
      }
      saveUserPreferences();
    });
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchSidebarView(btn.getAttribute('data-view'));
    });
  });

  // Pestañas del Manual Interactivo
  document.querySelectorAll('.manual-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchManualTab(btn.getAttribute('data-manual-tab'));
    });
  });

  // Abrir Modal de Infografía Panorámica
  const btnPano = document.getElementById('btnOpenInfografiaModal');
  if (btnPano) btnPano.addEventListener('click', openInfografiaModal);

  // Cerrar modales con clic en fondo oscuro
  const modalInfografia = document.getElementById('modalInfografia');
  if (modalInfografia) {
    modalInfografia.addEventListener('click', (e) => {
      if (e.target === modalInfografia) closeInfografiaModal();
    });
  }

  const modalBoletin = document.getElementById('modalBoletin');
  if (modalBoletin) {
    modalBoletin.addEventListener('click', (e) => {
      if (e.target === modalBoletin) modalBoletin.classList.add('hidden');
    });
  }

  // Controles del Modal de SysAdmin
  const btnCloseSys = document.getElementById('btnCloseSysadminModal');
  if (btnCloseSys) btnCloseSys.addEventListener('click', closeSysadminModal);

  const btnCancelSys = document.getElementById('btnCancelSysadminPin');
  if (btnCancelSys) btnCancelSys.addEventListener('click', closeSysadminModal);

  const btnTogglePin = document.getElementById('btnToggleSysadminPin');
  const inputPin = document.getElementById('inputSysadminPin');
  if (btnTogglePin && inputPin) {
    btnTogglePin.addEventListener('click', () => {
      inputPin.type = inputPin.type === 'password' ? 'text' : 'password';
    });
  }

  const modalSysadmin = document.getElementById('modalSysadminAuth');
  if (modalSysadmin) {
    modalSysadmin.addEventListener('click', (e) => {
      if (e.target === modalSysadmin) closeSysadminModal();
    });
  }

  // 1. Botón Video-Wall COE
  const btnVW = document.getElementById('btnVideoWall');
  if (btnVW) btnVW.addEventListener('click', toggleVideoWallMode);

  // 2. Botón Sonido Alertas Tácticas
  const btnSnd = document.getElementById('btnSoundToggle');
  if (btnSnd) btnSnd.addEventListener('click', toggleSound);

  // 3. Paleta de Comandos (Ctrl + K)
  const btnCP = document.getElementById('btnCommandPaletteTrigger');
  if (btnCP) btnCP.addEventListener('click', openCommandPalette);

  const btnEscPal = document.getElementById('btnEscPalette');
  if (btnEscPal) btnEscPal.addEventListener('click', closeCommandPalette);

  const modalPalette = document.getElementById('modalCommandPalette');
  if (modalPalette) {
    modalPalette.addEventListener('click', (e) => {
      if (e.target === modalPalette) closeCommandPalette();
    });
  }

  const inputPal = document.getElementById('inputCommandPalette');
  if (inputPal) {
    inputPal.addEventListener('input', (e) => {
      state.palette.selectedIndex = 0;
      renderPaletteResults(e.target.value, state.palette.filter);
    });
    inputPal.addEventListener('keydown', (e) => {
      const matches = state.palette.currentMatches || [];
      if (matches.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.palette.selectedIndex = (state.palette.selectedIndex + 1) % matches.length;
        renderPaletteResults(inputPal.value, state.palette.filter);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.palette.selectedIndex = (state.palette.selectedIndex - 1 + matches.length) % matches.length;
        renderPaletteResults(inputPal.value, state.palette.filter);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectPaletteIndex(state.palette.selectedIndex);
      }
    });
  }

  // Chips de filtro de la Paleta
  document.querySelectorAll('.palette-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.palette-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.palette.filter = chip.getAttribute('data-pfilter');
      state.palette.selectedIndex = 0;
      renderPaletteResults(inputPal ? inputPal.value : '', state.palette.filter);
    });
  });

  // 4. Simulador Táctico de Crecidas
  const btnSimTrig = document.getElementById('btnSimuladorTrigger');
  if (btnSimTrig) btnSimTrig.addEventListener('click', openSimuladorModal);

  const btnCloseSim = document.getElementById('btnCloseSimulador');
  if (btnCloseSim) btnCloseSim.addEventListener('click', closeSimuladorModal);

  const modalSim = document.getElementById('modalSimulador');
  if (modalSim) {
    modalSim.addEventListener('click', (e) => {
      if (e.target === modalSim) closeSimuladorModal();
    });
  }

  const selSimC = document.getElementById('selectSimCuenca');
  if (selSimC) selSimC.addEventListener('change', runCrecidaSimulation);

  const sldSimC = document.getElementById('sliderSimCota');
  if (sldSimC) sldSimC.addEventListener('input', runCrecidaSimulation);

  const btnSimApp = document.getElementById('btnSimApply');
  if (btnSimApp) btnSimApp.addEventListener('click', applySimulationToMap);

  const btnSimRst = document.getElementById('btnSimReset');
  if (btnSimRst) btnSimRst.addEventListener('click', resetSimulation);

  // 5. Time Machine 48 Horas
  const btnPlayTl = document.getElementById('btnPlayTimeline');
  if (btnPlayTl) btnPlayTl.addEventListener('click', toggleTimelinePlay);

  const btnSpdTl = document.getElementById('btnSpeedTimeline');
  if (btnSpdTl) btnSpdTl.addEventListener('click', cycleTimelineSpeed);

  const btnLiveTl = document.getElementById('btnTimelineLive');
  if (btnLiveTl) btnLiveTl.addEventListener('click', resetTimelineLive);

  const sldTl = document.getElementById('timelineSlider');
  if (sldTl) {
    sldTl.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!state.timeline.steps || state.timeline.steps.length === 0) return;
      let closestIdx = 0;
      let minDiff = Infinity;
      state.timeline.steps.forEach((s, idx) => {
        const diff = Math.abs(s.offset_horas - val);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      applyTimelineStep(closestIdx, false);
    });
  }

  // Atajo global Ctrl+K / Cmd+K y Escape
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    } else if (e.key === 'Escape') {
      closeInfografiaModal();
      closeSysadminModal();
      closeCommandPalette();
      closeSimuladorModal();
      if (modalBoletin) modalBoletin.classList.add('hidden');
    }
  });

  setupPluginCheckboxes();

  // Controles de calor
  document.getElementById('btnPlayHeat').addEventListener('click', toggleHeatPlay);
  document.getElementById('heatRangeSlider').addEventListener('input', e => {
    if (state.heatPlaying) toggleHeatPlay();
    updateHeatmapForHour(parseInt(e.target.value, 10));
  });

  // Búsqueda universal
  const inputSearch = document.getElementById('inputUniversalSearch');
  if (inputSearch) {
    inputSearch.addEventListener('input', e => {
      state.universalSearchQuery = e.target.value;
      performUniversalSearch();
    });

    inputSearch.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = state.universalSearchQuery.toLowerCase().trim();
        if (!q) return;

        const normQ = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Si coincide con algún efector de salud, resaltarlo y hacerlo parpadear directamente
        const sIndex = state.saludList.findIndex(s => {
          if (!s || !s.efector) return false;
          return s.efector.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normQ);
        });
        if (sIndex !== -1) {
          window.locateEntityFromSearch('salud', sIndex);
          return;
        }

        // Si no es salud o hay otro resultado en la lista, activar el primer elemento encontrado
        const firstItem = document.querySelector('#searchResultsList .search-res-item');
        if (firstItem) {
          firstItem.click();
        }
      }
    });
  }

  document.querySelectorAll('.scat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.universalSearchCat = btn.getAttribute('data-cat');
      performUniversalSearch();
    });
  });

  // Botón Estación más cercana
  document.getElementById('btnMiUbicacion').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocalización no disponible');
      return;
    }
    showToast('Buscando estación más cercana...');
    navigator.geolocation.getCurrentPosition(pos => {
      let closest = null;
      let minDist = Infinity;
      state.stations.forEach(st => {
        const d = calculateDistance(pos.coords.latitude, pos.coords.longitude, st.lat, st.lon);
        if (d < minDist) { minDist = d; closest = st; }
      });
      if (closest) {
        showToast(`Más cercana: ${closest.nombre} (${minDist.toFixed(1)} km)`);
        inspectEntity('meteo', closest.id);
      }
    }, () => {
      const def = state.stations.find(s => s.departamento === 'Capital') || state.stations[0];
      if (def) inspectEntity('meteo', def.id);
    });
  });

  // Botón Sincronizar
  document.getElementById('btnActualizar').addEventListener('click', async () => {
    const icon = document.getElementById('syncIcon');
    if (icon) icon.classList.add('spin');
    showToast('Sincronizando telemetría oficial de todas las redes...');
    await loadStationsData(true);
    await loadHidroData();
    await loadRutasData();
    await loadDefensaCivilData();
    await loadInundacionesData();
    await loadBomberosData();
    await loadFocosIncendioData();
    preloadHourlyForecasts();
    if (icon) icon.classList.remove('spin');
    showToast('Redes meteorológicas, hidrométricas y focos FIRMS sincronizados');
  });
}

function updateHeaderKPIs(meta) {
  if (!meta) return;
  const elTotal = document.getElementById('statTotalEstaciones');
  const elAvg = document.getElementById('statTempPromedio');
  const elRango = document.getElementById('statRangoTermico');
  if (elTotal) elTotal.textContent = meta.total_estaciones || state.stations.length;
  if (elAvg && meta.temperatura_promedio_c !== null) elAvg.textContent = `${meta.temperatura_promedio_c} °C`;
  if (elRango && meta.temperatura_min_c !== null && meta.temperatura_max_c !== null) {
    elRango.textContent = `${meta.temperatura_min_c}° / ${meta.temperatura_max_c}° C`;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  const text = document.getElementById('toastText');
  text.textContent = msg;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// =============================================================
// BOLETÍN EJECUTIVO DE SITUACIÓN PROVINCIAL (IMPRIMIBLE / PDF)
// =============================================================
async function openSituationReport() {
  const modal = document.getElementById('modalBoletin');
  const body = document.getElementById('boletinContent');
  if (!modal || !body) return;

  // Mostrar modal con spinner mientras se cargan los datos
  modal.classList.remove('hidden');
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;">
      <div style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#0284c7;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <span style="color:#64748b;font-size:0.9rem;font-weight:600;">Cargando datos del boletín...</span>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;

  // Cargar datos faltantes en paralelo
  const loaders = [];
  if (!state.hidroList || state.hidroList.length === 0) loaders.push(loadHidroData());
  if (!state.rutasList || state.rutasList.length === 0) loaders.push(loadRutasData());
  if (!state.inundacionesList || state.inundacionesList.length === 0) loaders.push(loadInundacionesData());
  if (!state.focosIncendioList || state.focosIncendioList.length === 0) loaders.push(loadFocosIncendioData());
  if (!state.presasList || state.presasList.length === 0) loaders.push(loadPresasData());
  if (loaders.length > 0) await Promise.allSettled(loaders);

  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const horaStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Cálculos meteorológicos
  const totalMeteo = state.stations.length;
  let sumTemp = 0, countTemp = 0, maxT = -99, minT = 99;
  state.stations.forEach(s => {
    const t = s.telemetria_oficial?.temperatura_c;
    if (t !== null && t !== undefined) {
      sumTemp += t;
      countTemp++;
      if (t > maxT) maxT = t;
      if (t < minT) minT = t;
    }
  });
  const avgTemp = countTemp > 0 ? (sumTemp / countTemp).toFixed(1) : '18.0';

  // Cálculos hidrométricos (Filtrar exclusivamente ríos y arroyos dentro del territorio provincial de Tucumán)
  const tucumanHidroList = state.hidroList.filter(h => {
    if (h.es_tucuman === true || h.provincia === 'Tucumán') return true;
    const lat = h.lat || h.latitud;
    const lon = h.lon || h.longitud;
    if (lat && lon) {
      return (lat >= -28.02 && lat <= -26.04) && (lon >= -66.18 && lon <= -64.48);
    }
    return false;
  });

  let sumCaudal = 0;
  tucumanHidroList.forEach(h => {
    if (h.caudal_estimado_m3s) sumCaudal += h.caudal_estimado_m3s;
  });

  body.innerHTML = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase; font-weight:700;">Estado de Situación Territorial</div>
        <h4 style="font-size:1.15rem; color:#0f172a; margin:3px 0 0 0; font-weight:800;">${fechaStr} • ${horaStr} hs</h4>
      </div>
      <div style="text-align:right;">
        <span style="background:#dcfce7; color:#166534; font-weight:800; font-size:0.75rem; padding:4px 10px; border-radius:20px; border:1px solid #86efac;">
          ● Monitoreo Oficial Activo
        </span>
      </div>
    </div>

    <div>
      <div class="boletin-section-title">🌤️ 1. Síntesis Meteorológica (Red AgroClima Tucumán)</div>
      <table class="boletin-table">
        <tr>
          <th>Estaciones Operativas</th>
          <th>Temp. Promedio</th>
          <th>Temperatura Máxima</th>
          <th>Temperatura Mínima</th>
        </tr>
        <tr>
          <td><strong>${totalMeteo} estaciones</strong> (EEAOC / INTA / SMN)</td>
          <td><strong style="color:#0284c7;">${avgTemp} °C</strong></td>
          <td><strong style="color:#e11d48;">${maxT > -99 ? maxT + ' °C' : '--'}</strong></td>
          <td><strong style="color:#2563eb;">${minT < 99 ? minT + ' °C' : '--'}</strong></td>
        </tr>
      </table>
    </div>

    <div>
      <div class="boletin-section-title">🌊 2. Estado de la Red Fluvial de la Provincia de Tucumán (INA SIYAH)</div>
      <p style="font-size:0.76rem; color:#64748b; margin:0 0 8px 0;">
        Caudal instantáneo monitoreado en territorio tucumano: <strong style="color:#0284c7;">${sumCaudal.toFixed(1)} m³/s</strong> en <strong>${tucumanHidroList.length} ríos, arroyos y aforos satelitales</strong> dentro de la Provincia de Tucumán.
      </p>
      <table class="boletin-table">
        <tr>
          <th>Río / Arroyo (Tucumán)</th>
          <th>Departamento / Ubicación</th>
          <th>Nivel Actual</th>
          <th>Caudal Estimado</th>
          <th>Tendencia / Alerta</th>
        </tr>
        ${[...tucumanHidroList].sort((a, b) => {
          const alertA = (a.tendencia === 'crece' || (a.nivel_alerta && a.nivel_alerta.includes('Alerta'))) ? 1 : 0;
          const alertB = (b.tendencia === 'crece' || (b.nivel_alerta && b.nivel_alerta.includes('Alerta'))) ? 1 : 0;
          return alertB - alertA;
        }).map(h => `
          <tr>
            <td><strong>${h.rio || h.nombre}</strong></td>
            <td style="font-size:0.72rem; color:#475569;">${h.departamento || h.tramo || h.localidad || 'Tucumán'}</td>
            <td><strong>${h.altura_m !== null ? h.altura_m + ' m' : '--'}</strong></td>
            <td><strong style="color:#0284c7;">${h.caudal_estimado_m3s ? h.caudal_estimado_m3s + ' m³/s' : '--'}</strong></td>
            <td>
              <span style="background:${h.tendencia === 'crece' ? '#fee2e2' : (h.nivel_alerta && h.nivel_alerta.includes('Alerta') ? '#fef3c7' : '#f0fdf4')}; color:${h.tendencia === 'crece' ? '#991b1b' : (h.nivel_alerta && h.nivel_alerta.includes('Alerta') ? '#92400e' : '#166534')}; padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.7rem;">
                ${h.nivel_alerta || (h.tendencia === 'crece' ? '🔺 En Alza' : (h.tendencia === 'baja' ? '🔻 En Bajante' : 'Estable'))}
              </span>
            </td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div>
      <div class="boletin-section-title">🌊 3. InundaRisk Sentinel - Monitoreo de Crecidas (FloodRisk & Google FloodHub)</div>
      <table class="boletin-table">
        <tr>
          <th>Cuenca / Zona de Riesgo</th>
          <th>Cauce Principal</th>
          <th>Nivel de Riesgo</th>
          <th>Recurrencia Satelital</th>
        </tr>
        ${state.inundacionesList.map(item => `
          <tr>
            <td><strong>${item.nombre}</strong> (${item.departamento})</td>
            <td>${item.rio_principal}</td>
            <td>
              <span style="background:${item.color_riesgo || '#dc2626'}; color:#fff; padding:2px 8px; border-radius:10px; font-weight:800; font-size:0.7rem;">
                ${item.nivel_riesgo}
              </span>
            </td>
            <td style="font-size:0.72rem; color:#475569;">${item.frecuencia_satelital}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div>
      <div class="boletin-section-title">🛣️ 4. Pasos Viales y Rutas Críticas (Vialidad)</div>
      <table class="boletin-table">
        <tr>
          <th>Ruta / Tramo</th>
          <th>Tipo de Estructura</th>
          <th>Estado de Transitabilidad</th>
          <th>Observación Operativa</th>
        </tr>
        ${state.rutasList.map(r => `
          <tr>
            <td><strong>${r.nombre}</strong> (${r.ruta})</td>
            <td>${r.tipo}</td>
            <td><strong style="color:${r.color_estado || '#0f172a'};">${r.estado_transito}</strong></td>
            <td style="font-size:0.72rem; color:#475569;">${r.observacion}</td>
          </tr>
        `).join('')}
      </table>
    </div>


    <div>
      <div class="boletin-section-title">🔥 5. PyroScan Sentinel - Detección de Focos de Calor (NASA FIRMS)</div>
      <p style="font-size:0.72rem; color:#722ed1; background:#fffbe6; border:1px solid #ffe58f; padding:6px 10px; border-radius:6px; margin:0 0 8px 0;">
        ⚠️ Detecciones satelitales de anomalías térmicas infrarrojas (VIIRS/MODIS). Requiere verificación en terreno.
      </p>
      <table class="boletin-table">
        <tr>
          <th>ID Detección</th>
          <th>Departamento</th>
          <th>Satélite / Sensor</th>
          <th>Confianza</th>
          <th>FRP (Potencia)</th>
        </tr>
        ${state.focosIncendioList.slice(0, 8).map(f => `
          <tr>
            <td><strong>${f.id}</strong></td>
            <td>${f.departamento}</td>
            <td>${f.satellite}</td>
            <td><strong>${f.confidence} (${f.confidence_pct}%)</strong></td>
            <td><strong style="color:#ea580c;">${f.frp_mw} MW</strong> (${f.brightness_temp_c}°C)</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div>
      <div class="boletin-section-title">🏗️ 6. Complejos Hidroeléctricos, Presas y Obras Hidráulicas (ORSEP)</div>
      <table class="boletin-table">
        <tr>
          <th>Obra / Nombre</th>
          <th>Tipo / Complejo</th>
          <th>Río / Departamento</th>
          <th>Altura / Embalse</th>
          <th>Vertedero / Operador</th>
        </tr>
        ${state.presasList.map(p => `
          <tr>
            <td><strong>${p.nombre}</strong> ${p.alias ? `(${p.alias})` : ''}</td>
            <td>${p.tipo} · <strong>${p.complejo}</strong></td>
            <td>${p.rio} (${p.departamento})</td>
            <td>${p.altura_m ? p.altura_m + ' m' : '--'} · <strong style="color:#0284c7;">${p.capacidad_embalse_hm3 ? p.capacidad_embalse_hm3 + ' hm³' : 'Derivador'}</strong></td>
            <td>${p.capacidad_vertedero_m3s ? p.capacidad_vertedero_m3s + ' m³/s' : '--'} · ${p.operador}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="boletin-footer-legal">
      <span>Emitido automáticamente por el Geovisor Modular de Tucumán · DGIME - I+T</span>
      <span>Crisóstomo Álvarez 1165 · Tucumán, Argentina · Línea de Emergencias: 103 / 100</span>
    </div>
  `;

  modal.classList.remove('hidden');
}
window.openSituationReport = openSituationReport;

// =========================================================================
// MANUAL INTERACTIVO CON INFOGRAFÍA & MODAL PANORÁMICO
// =========================================================================
function switchManualTab(tabKey) {
  document.querySelectorAll('.manual-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-manual-tab') === tabKey);
  });

  const contentMap = {
    tabFlujo: 'tabContentFlujo',
    tabSemaforo: 'tabContentSemaforo',
    tabPlugins: 'tabContentPlugins',
    tabHerramientas: 'tabContentHerramientas'
  };

  document.querySelectorAll('.manual-tab-content').forEach(c => c.classList.remove('active'));
  const targetId = contentMap[tabKey];
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) el.classList.add('active');
  }
}

function openInfografiaModal() {
  const modal = document.getElementById('modalInfografia');
  if (modal) modal.classList.remove('hidden');
}

function closeInfografiaModal() {
  const modal = document.getElementById('modalInfografia');
  if (modal) modal.classList.add('hidden');
}

window.switchManualTab = switchManualTab;
window.openInfografiaModal = openInfografiaModal;
window.closeInfografiaModal = closeInfografiaModal;

// =========================================================================
// SEGURIDAD Y CONTROL DE ACCESO SYSADMIN (DGIME - I+T)
// =========================================================================
let _pendingSysadminCallback = null;

function isSysadminAuthenticated() {
  const token = sessionStorage.getItem('sysadmin_auth_token');
  return Boolean(token && token.length > 20);
}

function requireSysadminAuth(onSuccessCallback) {
  if (isSysadminAuthenticated()) {
    if (typeof onSuccessCallback === 'function') onSuccessCallback();
    return;
  }

  _pendingSysadminCallback = onSuccessCallback;
  const modal = document.getElementById('modalSysadminAuth');
  const alertEl = document.getElementById('sysadminAuthAlert');
  const pinInput = document.getElementById('inputSysadminPin');

  if (alertEl) alertEl.classList.add('hidden');
  if (pinInput) {
    pinInput.value = '';
    pinInput.type = 'password';
  }

  if (modal) {
    modal.classList.remove('hidden');
    setTimeout(() => { if (pinInput) pinInput.focus(); }, 150);
  }
}

function closeSysadminModal() {
  const modal = document.getElementById('modalSysadminAuth');
  if (modal) modal.classList.add('hidden');
  _pendingSysadminCallback = null;
}

async function submitSysadminAuth() {
  const pinInput = document.getElementById('inputSysadminPin');
  const alertEl = document.getElementById('sysadminAuthAlert');
  const alertText = document.getElementById('sysadminAlertText');
  const submitBtn = document.getElementById('btnSubmitSysadminPin');

  if (!pinInput) return;
  const pin = pinInput.value.trim();

  if (!pin) {
    if (alertEl && alertText) {
      alertText.textContent = 'Ingrese la clave de SysAdmin.';
      alertEl.classList.remove('hidden');
    }
    pinInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';
  }

  try {
    const response = await fetch('api.php?action=verify_sysadmin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: pin })
    });
    const data = await response.json();

    if (data && data.success) {
      sessionStorage.setItem('sysadmin_auth_token', data.token);
      showToast('🔓 Acceso de SysAdmin concedido');
      closeSysadminModal();

      if (typeof _pendingSysadminCallback === 'function') {
        const cb = _pendingSysadminCallback;
        _pendingSysadminCallback = null;
        cb();
      }
    } else {
      if (alertEl && alertText) {
        alertText.textContent = (data && data.message) ? data.message : 'Clave de SysAdmin incorrecta. Acceso denegado.';
        alertEl.classList.remove('hidden');
      }
      pinInput.value = '';
      pinInput.focus();
    }
  } catch (err) {
    if (alertEl && alertText) {
      alertText.textContent = 'Error de conexión con el servidor de autenticación.';
      alertEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🔓 Verificar y Acceder</span>';
    }
  }
}

window.isSysadminAuthenticated = isSysadminAuthenticated;
window.requireSysadminAuth = requireSysadminAuth;
window.submitSysadminAuth = submitSysadminAuth;
window.closeSysadminModal = closeSysadminModal;

// =========================================================================
// MÓDULO 1: AUDIO ALERTA TÁCTICO (WEB AUDIO API)
// =========================================================================
let audioCtx = null;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTacticalTone(type = 'confirm') {
  if (!state.soundEnabled) return;
  try {
    initAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'confirm') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'critical') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.12);
      osc.frequency.setValueAtTime(880, now + 0.24);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.start(now);
      osc.stop(now + 0.42);
    }
  } catch (e) {}
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  try {
    localStorage.setItem('geovisor_sound_enabled', state.soundEnabled ? 'true' : 'false');
  } catch (e) {}
  const label = document.getElementById('soundToggleLabel');
  if (label) {
    label.textContent = state.soundEnabled ? 'Audio ON' : 'Audio OFF';
  }
  showToast(state.soundEnabled ? '🔊 Alertas de audio activadas' : '🔇 Alertas de audio silenciadas');
  if (state.soundEnabled) playTacticalTone('confirm');
}

// =========================================================================
// MÓDULO 2: ÍNDICE COMPUESTO DE VULNERABILIDAD POR DEPARTAMENTO
// =========================================================================
function calculateDepartmentVulnerability(deptName) {
  if (!deptName || deptName === 'all') {
    return { score: 4.8, nivel: 'media', label: 'Provincial: 4.8/10 (Monitoreo Activo)' };
  }

  let score = 2.5;

  const riosInDept = state.hidroList.filter(h => {
    return h.nombre.toLowerCase().includes(deptName.toLowerCase()) ||
           (deptName === 'Chicligasta' && (h.id.includes('gastona') || h.id.includes('chico'))) ||
           (deptName === 'Graneros' && h.id.includes('marapa')) ||
           (deptName === 'Simoca' && (h.id.includes('gastona') || h.id.includes('sali'))) ||
           (deptName === 'Capital' && h.id.includes('sali')) ||
           (deptName === 'Río Chico' && (h.id.includes('barrientos') || h.id.includes('chico')));
  });

  riosInDept.forEach(r => {
    if (r.estado === 'Alerta' || (r.altura_m && r.altura_m > 3.0)) score += 3.5;
    else if (r.tendencia === 'Crecida' || r.tendencia === 'En alza') score += 2.0;
  });

  const rutasInDept = state.rutasList.filter(rt => {
    return (deptName === 'Chicligasta' && rt.nombre.includes('Gastona')) ||
           (deptName === 'Monteros' && rt.nombre.includes('Los Sosa')) ||
           (deptName === 'Graneros' && rt.nombre.includes('Lamadrid')) ||
           (deptName === 'Leales' && rt.nombre.includes('Salí')) ||
           (deptName === 'Río Chico' && rt.nombre.includes('Barrientos'));
  });

  rutasInDept.forEach(rt => {
    if (rt.color_estado === '#ef4444') score += 3.0;
    else if (rt.color_estado === '#f59e0b') score += 1.5;
  });

  score = Math.min(9.9, Math.max(1.2, parseFloat(score.toFixed(1))));

  let nivel = 'baja';
  let label = `Vulnerabilidad: ${score}/10 (Baja)`;

  if (score >= 7.0) {
    nivel = 'alta';
    label = `Vulnerabilidad: ${score}/10 (Crítica)`;
  } else if (score >= 4.5) {
    nivel = 'media';
    label = `Vulnerabilidad: ${score}/10 (Moderada)`;
  }

  return { score, nivel, label };
}

function updateVulnerabilityBadge(deptName) {
  const badge = document.getElementById('badgeVulnerabilidad');
  const dot = document.getElementById('vulnDot');
  const text = document.getElementById('vulnScoreText');
  if (!badge || !dot || !text) return;

  const data = calculateDepartmentVulnerability(deptName);
  text.textContent = data.label;
  dot.className = `vuln-dot ${data.nivel}`;
}

// =========================================================================
// MÓDULO 3: TIME MACHINE 48 HORAS (LÍNEA DE TIEMPO PROVINCIAL REACTIVA)
// =========================================================================
const DEFAULT_TIMELINE_STEPS = [
  {
    offset_horas: -12,
    hora_etiqueta: "Hace 12h (09:00 Ayer)",
    factor_temperatura: -3.5,
    alerta_general: "VERDE",
    resumen_clima: "Cielos despejados a parcialmente nublados. Caudal regular en todas las cuencas.",
    rios: {
      "rio-sali": { nivel_m: 1.20, caudal_m3s: 38, estado: "Normal", color: "#0284c7" },
      "rio-gastona": { nivel_m: 1.60, caudal_m3s: 24, estado: "Normal", color: "#0284c7" },
      "rio-marapa": { nivel_m: 1.40, caudal_m3s: 18, estado: "Normal", color: "#0284c7" },
      "rio-lules": { nivel_m: 0.90, caudal_m3s: 12, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 0.75, caudal_m3s: 9, estado: "Normal", color: "#0284c7" }
    },
    rutas_afectadas: []
  },
  {
    offset_horas: -6,
    hora_etiqueta: "Hace 6h (15:00 Ayer)",
    factor_temperatura: 2.8,
    alerta_general: "VERDE",
    resumen_clima: "Aumento térmico en llanura central. Ingreso de nubosidad por el sudoeste.",
    rios: {
      "rio-sali": { nivel_m: 1.35, caudal_m3s: 42, estado: "Normal", color: "#0284c7" },
      "rio-gastona": { nivel_m: 1.85, caudal_m3s: 29, estado: "Normal", color: "#0284c7" },
      "rio-marapa": { nivel_m: 1.55, caudal_m3s: 21, estado: "Normal", color: "#0284c7" },
      "rio-lules": { nivel_m: 1.05, caudal_m3s: 15, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 0.85, caudal_m3s: 11, estado: "Normal", color: "#0284c7" }
    },
    rutas_afectadas: []
  },
  {
    offset_horas: -3,
    hora_etiqueta: "Hace 3h (18:00)",
    factor_temperatura: 0.5,
    alerta_general: "NARANJA",
    resumen_clima: "Tormentas convectivas en alta cuenca del Aconquija. Precipitaciones de 35mm en 1h.",
    rios: {
      "rio-sali": { nivel_m: 1.65, caudal_m3s: 58, estado: "Normal", color: "#0284c7" },
      "rio-gastona": { nivel_m: 2.65, caudal_m3s: 52, estado: "Crecida", color: "#f59e0b" },
      "rio-marapa": { nivel_m: 2.10, caudal_m3s: 36, estado: "Normal", color: "#0284c7" },
      "rio-lules": { nivel_m: 1.40, caudal_m3s: 22, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 1.25, caudal_m3s: 18, estado: "Normal", color: "#0284c7" }
    },
    rutas_afectadas: ["ruta-01"]
  },
  {
    offset_horas: 0,
    hora_etiqueta: "⏱️ EN VIVO (Tiempo Real)",
    factor_temperatura: 0.0,
    alerta_general: "NARANJA",
    resumen_clima: "Precipitaciones activas en cuenca sur y pedemonte. Río Gastona y Quebrada de Los Sosa bajo monitoreo.",
    rios: {
      "rio-sali": { nivel_m: 1.85, caudal_m3s: 65, estado: "Normal", color: "#0284c7" },
      "rio-gastona": { nivel_m: 3.10, caudal_m3s: 78, estado: "Crecida", color: "#f59e0b" },
      "rio-marapa": { nivel_m: 2.70, caudal_m3s: 49, estado: "Normal", color: "#0284c7" },
      "rio-lules": { nivel_m: 1.65, caudal_m3s: 26, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 1.45, caudal_m3s: 21, estado: "Normal", color: "#0284c7" }
    },
    rutas_afectadas: ["ruta-01", "ruta-02"]
  },
  {
    offset_horas: 3,
    hora_etiqueta: "Pronóstico +3h",
    factor_temperatura: -1.2,
    alerta_general: "ROJO",
    resumen_clima: "Pico de onda de crecida descendiendo hacia Río Gastona y Río Marapa. Riesgo de anegamiento en Lamadrid.",
    rios: {
      "rio-sali": { nivel_m: 2.20, caudal_m3s: 82, estado: "Crecida", color: "#f59e0b" },
      "rio-gastona": { nivel_m: 3.85, caudal_m3s: 115, estado: "Alerta", color: "#ef4444" },
      "rio-marapa": { nivel_m: 3.45, caudal_m3s: 95, estado: "Alerta", color: "#ef4444" },
      "rio-lules": { nivel_m: 1.85, caudal_m3s: 32, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 1.95, caudal_m3s: 31, estado: "Crecida", color: "#f59e0b" }
    },
    rutas_afectadas: ["ruta-01", "ruta-02", "ruta-04"]
  },
  {
    offset_horas: 6,
    hora_etiqueta: "Pronóstico +6h",
    factor_temperatura: -2.0,
    alerta_general: "ROJO",
    resumen_clima: "Caudal máximo en Lamadrid y Simoca. Evacuaciones preventivas coordinadas por Defensa Civil.",
    rios: {
      "rio-sali": { nivel_m: 2.65, caudal_m3s: 110, estado: "Crecida", color: "#f59e0b" },
      "rio-gastona": { nivel_m: 4.20, caudal_m3s: 138, estado: "Alerta Desborde", color: "#ef4444" },
      "rio-marapa": { nivel_m: 3.90, caudal_m3s: 122, estado: "Alerta Desborde", color: "#ef4444" },
      "rio-lules": { nivel_m: 1.70, caudal_m3s: 28, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 2.15, caudal_m3s: 36, estado: "Crecida", color: "#f59e0b" }
    },
    rutas_afectadas: ["ruta-01", "ruta-02", "ruta-04"]
  },
  {
    offset_horas: 12,
    hora_etiqueta: "Pronóstico +12h",
    factor_temperatura: 1.5,
    alerta_general: "NARANJA",
    resumen_clima: "Cese de lluvias en cordillera. Inicio de escurrimiento descendente en cuenca del Río Salí hacia Embalse Frontal.",
    rios: {
      "rio-sali": { nivel_m: 2.45, caudal_m3s: 98, estado: "Crecida", color: "#f59e0b" },
      "rio-gastona": { nivel_m: 3.20, caudal_m3s: 84, estado: "Crecida", color: "#f59e0b" },
      "rio-marapa": { nivel_m: 3.10, caudal_m3s: 79, estado: "Crecida", color: "#f59e0b" },
      "rio-lules": { nivel_m: 1.30, caudal_m3s: 19, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 1.40, caudal_m3s: 20, estado: "Normal", color: "#0284c7" }
    },
    rutas_afectadas: ["ruta-01", "ruta-04"]
  },
  {
    offset_horas: 24,
    hora_etiqueta: "Pronóstico +24h (Mañana)",
    factor_temperatura: 3.2,
    alerta_general: "VERDE",
    resumen_clima: "Normalización de cauces y descenso de niveles. Tareas de despeje vial y retorno asistido de evacuados.",
    rios: {
      "rio-sali": { nivel_m: 1.70, caudal_m3s: 55, estado: "Normal", color: "#0284c7" },
      "rio-gastona": { nivel_m: 2.10, caudal_m3s: 38, estado: "Normal", color: "#0284c7" },
      "rio-marapa": { nivel_m: 1.95, caudal_m3s: 32, estado: "Normal", color: "#0284c7" },
      "rio-lules": { nivel_m: 1.00, caudal_m3s: 14, estado: "Normal", color: "#0284c7" },
      "arroyo-barrientos": { nivel_m: 0.95, caudal_m3s: 12, estado: "Normal", color: "#0284c7" }
    },
    rutas_afectadas: []
  }
];

async function loadTimelineData() {
  state.timeline.steps = DEFAULT_TIMELINE_STEPS;
  try {
    const res = await fetch('api.php?action=get_timeline');
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.pasos) && json.pasos.length > 0) {
        state.timeline.steps = json.pasos;
      }
    }
  } catch (err) {
    console.warn('Usando series temporales por defecto:', err);
  }
}

function applyTimelineStep(index, updateSlider = true) {
  if (!state.timeline.steps || state.timeline.steps.length === 0) return;
  const step = state.timeline.steps[index];
  if (!step) return;

  state.timeline.currentIndex = index;

  const slider = document.getElementById('timelineSlider');
  if (slider && updateSlider) slider.value = step.offset_horas;

  const badge = document.getElementById('timelineCurrentTimeBadge');
  if (badge) {
    badge.textContent = step.hora_etiqueta;
    if (step.offset_horas === 0) {
      badge.style.color = '#0284c7';
    } else if (step.alerta_general === 'ROJO') {
      badge.style.color = '#ef4444';
    } else if (step.alerta_general === 'NARANJA') {
      badge.style.color = '#f59e0b';
    } else {
      badge.style.color = '#10b981';
    }
  }

  const summary = document.getElementById('timelineSummaryText');
  if (summary) summary.textContent = step.resumen_clima;

  const ticker = document.getElementById('videoWallTickerContent');
  if (ticker) {
    ticker.innerHTML = `<span>${step.hora_etiqueta} · ${step.resumen_clima} · Alerta: ${step.alerta_general} · ${step.rutas_afectadas ? step.rutas_afectadas.length : 0} Pasos Viales bajo Vigilancia.</span>`;
  }

  // 1. Alertas Acústicas
  if (step.alerta_general === 'ROJO') {
    playTacticalTone('critical');
  } else if (step.alerta_general === 'NARANJA' && step.offset_horas !== 0) {
    playTacticalTone('warning');
  }

  // 2. CAMBIO VISUAL EN EL MAPA: Actualizar Líneas de Ríos en tiempo real
  if (state.layers.rivers && typeof state.layers.rivers.setStyle === 'function') {
    state.layers.rivers.setStyle(f => {
      const name = (f.properties && f.properties.nombre) ? f.properties.nombre.toLowerCase() : '';
      let color = '#0284c7';
      let weight = 2.2;
      let opacity = 0.85;

      if (step.rios) {
        if (name.includes('gastona') && step.rios['rio-gastona']) {
          color = step.rios['rio-gastona'].color;
          weight = step.rios['rio-gastona'].estado.includes('Alerta') ? 5.5 : 3.8;
          opacity = 1;
        } else if (name.includes('marapa') && step.rios['rio-marapa']) {
          color = step.rios['rio-marapa'].color;
          weight = step.rios['rio-marapa'].estado.includes('Alerta') ? 5.5 : 3.8;
          opacity = 1;
        } else if (name.includes('salí') || name.includes('sali')) {
          if (step.rios['rio-sali']) {
            color = step.rios['rio-sali'].color;
            weight = step.rios['rio-sali'].estado.includes('Crecida') ? 4.2 : 2.5;
            opacity = 1;
          }
        } else if (name.includes('lules') && step.rios['rio-lules']) {
          color = step.rios['rio-lules'].color;
          weight = 3;
        } else if (name.includes('barrientos') && step.rios['arroyo-barrientos']) {
          color = step.rios['arroyo-barrientos'].color;
          weight = 3.2;
        }
      }
      return { color, weight, opacity };
    });
  }

  // 3. CAMBIO VISUAL EN EL MAPA: Capa Dinámica de Tormentas y Desbordes
  if (!state.layers.timelineStorm) {
    state.layers.timelineStorm = L.featureGroup().addTo(state.map);
  }
  state.layers.timelineStorm.clearLayers();

  if (step.offset_horas === -3) {
    // Tormenta Convectiva en Cordillera (Aconquija)
    const storm = L.circle([-26.92, -65.68], {
      radius: 22000,
      color: '#7c3aed',
      weight: 2.5,
      fillColor: '#7c3aed',
      fillOpacity: 0.35,
      dashArray: '4, 4'
    }).bindTooltip('⛈️ Celda de Tormenta Convectiva en Aconquija (35mm/h)', { permanent: true, direction: 'top', className: 'tooltip-storm' });
    state.layers.timelineStorm.addLayer(storm);
  } else if (step.offset_horas === 0) {
    // Frente activo en pedemonte central
    const rain = L.circle([-27.12, -65.55], {
      radius: 28000,
      color: '#0284c7',
      weight: 2.5,
      fillColor: '#0284c7',
      fillOpacity: 0.28
    }).bindTooltip('🌧️ Frente de Precipitaciones en Pedemonte Sur', { permanent: true, direction: 'top', className: 'tooltip-rain' });
    state.layers.timelineStorm.addLayer(rain);
  } else if (step.offset_horas === 3) {
    // Onda de crecida Gastona y Marapa
    const alertGastona = L.circle([-27.35, -65.45], {
      radius: 14000,
      color: '#f59e0b',
      weight: 3,
      fillColor: '#f59e0b',
      fillOpacity: 0.35,
      dashArray: '5, 5'
    }).bindTooltip('⚠️ Onda de Crecida Descendiendo: Río Gastona (+3.85m)', { permanent: true, direction: 'top' });
    const alertMarapa = L.circle([-27.65, -65.35], {
      radius: 12000,
      color: '#ef4444',
      weight: 3,
      fillColor: '#ef4444',
      fillOpacity: 0.35,
      dashArray: '5, 5'
    }).bindTooltip('🚨 Alerta Crecida Crítica: Río Marapa (+3.45m)', { permanent: true, direction: 'top' });
    state.layers.timelineStorm.addLayer(alertGastona);
    state.layers.timelineStorm.addLayer(alertMarapa);
  } else if (step.offset_horas === 6) {
    // Desborde inminente en Lamadrid y Atahona
    const desborde1 = L.circle([-27.63, -65.25], {
      radius: 18000,
      color: '#ef4444',
      weight: 4,
      fillColor: '#ef4444',
      fillOpacity: 0.45,
      dashArray: '6, 6'
    }).bindTooltip('🚨 ALERTA MÁXIMA DESBORDE: Lamadrid (+4.20m Cota Límite)', { permanent: true, direction: 'top' });
    const desborde2 = L.circle([-27.35, -65.35], {
      radius: 16000,
      color: '#ef4444',
      weight: 4,
      fillColor: '#ef4444',
      fillOpacity: 0.42,
      dashArray: '6, 6'
    }).bindTooltip('🚨 Desborde Río Gastona / Atahona RN157', { permanent: true, direction: 'top' });
    state.layers.timelineStorm.addLayer(desborde1);
    state.layers.timelineStorm.addLayer(desborde2);
  } else if (step.offset_horas === 12) {
    const drainage = L.circle([-27.45, -65.05], {
      radius: 15000,
      color: '#0284c7',
      weight: 2.5,
      fillColor: '#0284c7',
      fillOpacity: 0.22
    }).bindTooltip('💧 Escurrimiento Descendente hacia Dique Frontal', { permanent: true, direction: 'top' });
    state.layers.timelineStorm.addLayer(drainage);
  }

  // 4. CAMBIO VISUAL EN EL MAPA: Actualizar Pines de Estaciones Meteorológicas
  if (state.layers.meteo) {
    const factor = step.factor_temperatura || 0;
    state.layers.meteo.eachLayer(marker => {
      const el = marker.getElement();
      if (el && marker.baseTemp !== undefined) {
        const span = el.querySelector('.pin-badge span:last-child');
        if (span) {
          span.textContent = (marker.baseTemp + factor).toFixed(1) + '°';
        }
      }
    });
  }

  // 5. CAMBIO VISUAL EN EL MAPA: Actualizar Rutas Afectadas
  if (state.layers.rutas && step.rutas_afectadas) {
    state.layers.rutas.eachLayer(marker => {
      const el = marker.getElement();
      if (el && marker.rutaId) {
        const isAfectada = step.rutas_afectadas.includes(marker.rutaId);
        const badge = el.querySelector('.pin-badge');
        if (badge) {
          if (isAfectada) {
            badge.style.borderColor = '#ef4444';
            badge.style.background = '#fef2f2';
            badge.style.color = '#dc2626';
            badge.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.6)';
          } else {
            badge.style.borderColor = '#f59e0b';
            badge.style.background = '#ffffff';
            badge.style.color = '#9a3412';
            badge.style.boxShadow = 'none';
          }
        }
      }
    });
  }
}

function toggleTimelinePlay() {
  state.timeline.isPlaying = !state.timeline.isPlaying;
  const btn = document.getElementById('btnPlayTimeline');
  const icon = document.getElementById('iconPlayTimeline');

  if (state.timeline.isPlaying) {
    if (btn) btn.classList.add('playing');
    if (icon) icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    playTacticalTone('confirm');
    showToast('▶ Reproduciendo evolución hidro-meteorológica 48h...');

    // Reproducir paso actual y avanzar
    state.timeline.timer = setInterval(() => {
      let next = state.timeline.currentIndex + 1;
      if (next >= state.timeline.steps.length) next = 0;
      applyTimelineStep(next, true);
    }, 2400 / state.timeline.speed);
  } else {
    if (btn) btn.classList.remove('playing');
    if (icon) icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    if (state.timeline.timer) clearInterval(state.timeline.timer);
    state.timeline.timer = null;
    showToast('⏸ Reproducción pausada');
  }
}

function cycleTimelineSpeed() {
  const speeds = [1, 2, 4];
  const currentIdx = speeds.indexOf(state.timeline.speed);
  state.timeline.speed = speeds[(currentIdx + 1) % speeds.length];
  const btn = document.getElementById('btnSpeedTimeline');
  if (btn) btn.textContent = state.timeline.speed + 'x';
  if (state.timeline.isPlaying) {
    clearInterval(state.timeline.timer);
    state.timeline.timer = setInterval(() => {
      let next = state.timeline.currentIndex + 1;
      if (next >= state.timeline.steps.length) next = 0;
      applyTimelineStep(next, true);
    }, 2400 / state.timeline.speed);
  }
}

function resetTimelineLive() {
  if (state.timeline.isPlaying) toggleTimelinePlay();
  const liveIndex = state.timeline.steps.findIndex(s => s.offset_horas === 0);
  applyTimelineStep(liveIndex >= 0 ? liveIndex : 0, true);
  showToast('⏱️ Restaurado a Telemetría en Tiempo Real');
  playTacticalTone('confirm');
}

// =========================================================================
// MÓDULO 4: PALETA DE COMANDOS UNIVERSAL (CTRL + K)
// =========================================================================
function openCommandPalette() {
  const modal = document.getElementById('modalCommandPalette');
  const input = document.getElementById('inputCommandPalette');
  if (!modal || !input) return;

  state.palette.isOpen = true;
  state.palette.selectedIndex = 0;
  modal.classList.remove('hidden');
  input.value = '';
  setTimeout(() => input.focus(), 100);
  buildPaletteItems();
  renderPaletteResults('', 'all');
  playTacticalTone('confirm');
}

function closeCommandPalette() {
  const modal = document.getElementById('modalCommandPalette');
  if (modal) modal.classList.add('hidden');
  state.palette.isOpen = false;
}

function buildPaletteItems() {
  const items = [];

  items.push(
    { tipo: 'comando', id: 'cmd-boletin', titulo: '📄 Generar Boletín Ejecutivo de Situación', sub: 'Exportación a PDF / Impresión oficial para el COE', action: () => openSituationReport() },
    { tipo: 'comando', id: 'cmd-limpiar', titulo: '🧹 Limpiar / Alternar Marcas del Mapa', sub: 'Oculta o muestra las marcas sin apagar los módulos', action: () => toggleMapVisibility() },
    { tipo: 'comando', id: 'cmd-deactivate-plugins', titulo: '🔌 Desactivar Todos los Plugins y Módulos', sub: 'Fuerza el apagado total de capas y módulos del mapa', action: () => deactivateAllPlugins() },
    { tipo: 'comando', id: 'cmd-centrar', titulo: '🎯 Centrar Mapa en la Provincia de Tucumán', sub: 'Coordenadas (-26.95, -65.35) zoom 9', action: () => recenterMap() },
    { tipo: 'comando', id: 'cmd-simulador', titulo: '🌊 Abrir Simulador Táctico de Crecidas Fluviales', sub: 'Cálculo de impacto y derivación a centros de evacuación', action: () => openSimuladorModal() },
    { tipo: 'comando', id: 'cmd-videowall', titulo: '🖥️ Alternar Modo Sala de Situación / Video-Wall', sub: 'Pantalla completa y ticker continuo de alertas', action: () => toggleVideoWallMode() },
    { tipo: 'comando', id: 'cmd-audio', titulo: '🔊 Alternar Alertas Acústicas Tácticas', sub: 'Activa o silencia los tonos de aviso de emergencia', action: () => toggleSound() },
    { tipo: 'comando', id: 'cmd-infografia', titulo: '🗺️ Abrir Infografía Panorámica Completa', sub: 'Diagrama arquitectónico y protocolo de emergencias', action: () => openInfografiaModal() },
    { tipo: 'comando', id: 'cmd-sysadmin', titulo: '🔒 Autenticación de SysAdmin', sub: 'Autorización de seguridad para instalar o modificar módulos GIS', action: () => requireSysadminAuth(() => showToast('Privilegios de SysAdmin Habilitados')) }
  );

  Object.keys(DEPARTAMENTOS_GEO).forEach(dept => {
    const geo = DEPARTAMENTOS_GEO[dept];
    const vuln = calculateDepartmentVulnerability(dept);
    items.push({
      tipo: 'depto',
      id: 'dept-' + dept,
      titulo: '📍 Departamento ' + dept,
      sub: `Encuadre territorial · ${vuln.label}`,
      action: () => {
        const select = document.getElementById('selectDepartamento');
        if (select) select.value = dept;
        state.selectedDepartamento = dept;
        state.map.flyTo(geo.center, geo.zoom, { animate: true, duration: 1.2 });
        updateVulnerabilityBadge(dept);
        saveUserPreferences();
      }
    });
  });

  state.rutasList.forEach(r => {
    items.push({
      tipo: 'ruta',
      id: r.id,
      titulo: '🛣️ ' + r.nombre,
      sub: `${r.tipo} · ${r.estado_transito}`,
      action: () => {
        state.map.flyTo([r.lat, r.lon], 14, { animate: true });
        inspectEntity({ tipo: 'ruta', id: r.id, data: r });
      }
    });
  });

  state.defensaCivilList.forEach(d => {
    items.push({
      tipo: 'defensa',
      id: d.id,
      titulo: '⛺ ' + d.nombre,
      sub: `${d.departamento} · Capacidad: ${d.capacidad_personas} pers. · Tel: ${d.telefono}`,
      action: () => {
        state.map.flyTo([d.lat, d.lon], 14, { animate: true });
        inspectEntity({ tipo: 'defensa_civil', id: d.id, data: d });
      }
    });
  });

  state.hidroList.forEach(h => {
    items.push({
      tipo: 'rio',
      id: h.id,
      titulo: '🌊 ' + h.nombre,
      sub: `Altura: ${h.altura_m}m · Caudal: ${h.caudal_m3s}m³/s · Tendencia: ${h.tendencia}`,
      action: () => {
        state.map.flyTo([h.lat, h.lon], 13, { animate: true });
        inspectEntity({ tipo: 'hidro', id: h.id, data: h });
      }
    });
  });

  state.saludList.forEach((s, idx) => {
    items.push({
      tipo: 'salud',
      id: 'salud-' + idx,
      titulo: '🏥 ' + s.efector,
      sub: `Efector de Salud SIPROSA · Tucumán`,
      action: () => {
        inspectEntity('salud', idx);
      }
    });
  });

  state.palette.items = items;
}

function renderPaletteResults(query = '', filter = 'all') {
  const container = document.getElementById('commandPaletteResults');
  if (!container) return;

  const q = query.toLowerCase().trim();
  let matches = state.palette.items.filter(item => {
    if (filter !== 'all' && item.tipo !== filter) return false;
    if (!q) return true;
    return item.titulo.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q);
  });

  matches = matches.slice(0, 30);

  if (matches.length === 0) {
    container.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b; font-size:0.8rem;">No se encontraron resultados para la búsqueda.</div>';
    return;
  }

  container.innerHTML = matches.map((item, idx) => {
    const isSelected = idx === state.palette.selectedIndex;
    return `
      <div class="palette-item ${isSelected ? 'selected' : ''}" data-idx="${idx}" onclick="window.selectPaletteIndex(${idx})">
        <div class="palette-item-body">
          <div class="palette-item-title">
            <span>${item.titulo}</span>
            <span class="palette-item-tag">${item.tipo.toUpperCase()}</span>
          </div>
          <div class="palette-item-sub">${item.sub}</div>
        </div>
      </div>
    `;
  }).join('');

  state.palette.currentMatches = matches;
}

function selectPaletteIndex(idx) {
  if (!state.palette.currentMatches || !state.palette.currentMatches[idx]) return;
  const match = state.palette.currentMatches[idx];
  closeCommandPalette();
  if (typeof match.action === 'function') match.action();
}

// =========================================================================
// MÓDULO 5: MODO SALA DE SITUACIÓN / VIDEO-WALL (COE)
// =========================================================================
function toggleVideoWallMode() {
  state.videoWall.active = !state.videoWall.active;
  document.body.classList.toggle('videowall-active', state.videoWall.active);

  const btnVW = document.getElementById('btnVideoWall');
  if (btnVW) {
    btnVW.classList.toggle('active', state.videoWall.active);
  }

  const ticker = document.getElementById('videoWallTickerBar');
  if (ticker) ticker.classList.toggle('hidden', !state.videoWall.active);

  const label = document.getElementById('labelVideoWall');
  if (label) {
    label.textContent = state.videoWall.active ? 'Salir Video-Wall' : 'Video-Wall';
  }

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 200);

  if (state.videoWall.active) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    showToast('🖥️ Modo Video-Wall COE Activado');
    playTacticalTone('confirm');

    const alertDepts = ['Chicligasta', 'Simoca', 'Graneros', 'Monteros', 'Capital'];
    state.videoWall.patrolTimer = setInterval(() => {
      if (!state.videoWall.active) return;
      const dept = alertDepts[state.videoWall.patrolIndex % alertDepts.length];
      state.videoWall.patrolIndex++;
      if (DEPARTAMENTOS_GEO[dept]) {
        const geo = DEPARTAMENTOS_GEO[dept];
        state.map.flyTo(geo.center, geo.zoom, { animate: true, duration: 2.0 });
        updateVulnerabilityBadge(dept);
        const sel = document.getElementById('selectDepartamento');
        if (sel) sel.value = dept;
      }
    }, 25000);
  } else {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (state.videoWall.patrolTimer) clearInterval(state.videoWall.patrolTimer);
    showToast('Modo Video-Wall finalizado');
  }
}

// =========================================================================
// MÓDULO 6: SIMULADOR TÁCTICO DE CRECIDAS FLUVIALES (100% JSON)
// =========================================================================
function openSimuladorModal() {
  const modal = document.getElementById('modalSimulador');
  if (modal) {
    modal.classList.remove('hidden');
    runCrecidaSimulation();
    playTacticalTone('confirm');
  }
}

function closeSimuladorModal() {
  const modal = document.getElementById('modalSimulador');
  if (modal) modal.classList.add('hidden');
}

function runCrecidaSimulation() {
  const cuencaSelect = document.getElementById('selectSimCuenca');
  const cotaSlider = document.getElementById('sliderSimCota');
  if (!cuencaSelect || !cotaSlider) return;

  const cuencaId = cuencaSelect.value;
  const cota = parseFloat(cotaSlider.value);

  const cotaLabel = document.getElementById('simCotaVal');
  if (cotaLabel) cotaLabel.textContent = `+${cota.toFixed(1)} metros`;

  const CUENCAS_GEO = {
    'rio-gastona': { lat: -27.4325, lon: -65.2714, baseArea: 12.0, nombre: 'Río Gastona' },
    'rio-marapa': { lat: -27.6572, lon: -65.2447, baseArea: 16.5, nombre: 'Río Marapa' },
    'rio-sali': { lat: -27.1333, lon: -65.3156, baseArea: 22.0, nombre: 'Río Salí' },
    'arroyo-barrientos': { lat: -27.4378, lon: -65.6189, baseArea: 8.5, nombre: 'Arroyo Barrientos' },
    'rio-lules': { lat: -26.9167, lon: -65.3333, baseArea: 7.0, nombre: 'Río Lules' }
  };

  const cuenca = CUENCAS_GEO[cuencaId] || CUENCAS_GEO['rio-gastona'];
  const radioKm = 1.2 + cota * 0.9;
  const areaKm2 = parseFloat((cuenca.baseArea * (1 + cota * 0.65)).toFixed(1));

  const affectedSalud = state.saludList.filter(s => {
    const d = calculateDistanceKm(cuenca.lat, cuenca.lon, s.lat, s.lon);
    return d <= radioKm;
  });

  const affectedRutas = state.rutasList.filter(r => {
    const d = calculateDistanceKm(cuenca.lat, cuenca.lon, r.lat, r.lon);
    return d <= radioKm * 1.5;
  });

  let closestRefugio = null;
  let minRefugioDist = Infinity;
  state.defensaCivilList.forEach(df => {
    const d = calculateDistanceKm(cuenca.lat, cuenca.lon, df.lat, df.lon);
    if (d < minRefugioDist) {
      minRefugioDist = d;
      closestRefugio = df;
    }
  });

  const elArea = document.getElementById('simKpiArea');
  if (elArea) elArea.textContent = `${areaKm2} km²`;

  const elSalud = document.getElementById('simKpiSalud');
  if (elSalud) elSalud.textContent = `${affectedSalud.length} Efectores`;

  const elRutas = document.getElementById('simKpiRutas');
  if (elRutas) elRutas.textContent = `${affectedRutas.length} Pasos Viales`;

  const elRefugio = document.getElementById('simKpiRefugio');
  if (elRefugio && closestRefugio) {
    elRefugio.textContent = `${closestRefugio.capacidad_personas} Plazas`;
  }

  const listEl = document.getElementById('simAffectedList');
  if (listEl) {
    let html = '';
    affectedSalud.forEach(s => {
      const d = calculateDistanceKm(cuenca.lat, cuenca.lon, s.lat, s.lon).toFixed(1);
      html += `
        <div class="sim-item-row">
          <span>🏥 <strong>${s.nombre}</strong> (${s.localidad || 'S/D'})</span>
          <span style="color:#ef4444; font-weight:750;">a ${d} km de la cuenca</span>
        </div>
      `;
    });
    affectedRutas.forEach(r => {
      html += `
        <div class="sim-item-row">
          <span>🛣️ <strong>${r.nombre}</strong></span>
          <span style="color:#d97706; font-weight:750;">Peligro de Corte</span>
        </div>
      `;
    });
    if (affectedSalud.length === 0 && affectedRutas.length === 0) {
      html = '<div style="padding:8px; color:#64748b; font-size:0.75rem;">No se detectan efectores directos dentro de esta cota de crecida.</div>';
    }
    listEl.innerHTML = html;
  }

  const refBox = document.getElementById('simRefugioBox');
  if (refBox && closestRefugio) {
    refBox.innerHTML = `
      <div style="font-size:0.78rem; color:#166534; font-weight:750; margin-bottom:4px;">🛡️ Refugio Asignado para Evacuaciones de la Zona:</div>
      <div style="font-size:0.85rem; font-weight:850; color:#0f172a;">${closestRefugio.nombre}</div>
      <div style="font-size:0.72rem; color:#475569; margin-top:2px;">
        Capacidad: <strong>${closestRefugio.capacidad_personas} personas</strong> · Localidad: <strong>${closestRefugio.localidad}</strong> · Tel: <strong>${closestRefugio.telefono}</strong>
      </div>
    `;
  }

  state.simuladorData = { cuenca, cota, radioKm, affectedSalud, affectedRutas, closestRefugio };
}

function applySimulationToMap() {
  if (!state.simuladorData) return;
  const { cuenca, radioKm } = state.simuladorData;

  closeSimuladorModal();

  if (state.layers.simuladorBuffer) {
    state.layers.simuladorBuffer.clearLayers();
  } else {
    state.layers.simuladorBuffer = L.featureGroup().addTo(state.map);
  }

  const circle = L.circle([cuenca.lat, cuenca.lon], {
    radius: radioKm * 1000,
    color: '#ef4444',
    weight: 2.5,
    fillColor: '#ef4444',
    fillOpacity: 0.25,
    dashArray: '6, 6'
  }).bindPopup(`<strong>Zona de Desborde Simulado</strong><br>${cuenca.nombre}<br>Radio de Afectación: ${radioKm.toFixed(1)} km`);

  state.layers.simuladorBuffer.addLayer(circle);
  state.map.flyTo([cuenca.lat, cuenca.lon], 12, { animate: true, duration: 1.5 });
  circle.openPopup();

  showToast(`🌊 Simulación proyectada en ${cuenca.nombre}`);
  playTacticalTone('warning');
}

function resetSimulation() {
  if (state.layers.simuladorBuffer) {
    state.layers.simuladorBuffer.clearLayers();
  }
  showToast('Cauces normales restablecidos');
  playTacticalTone('confirm');
}

window.toggleSound = toggleSound;
window.toggleVideoWallMode = toggleVideoWallMode;
window.openCommandPalette = openCommandPalette;
window.closeCommandPalette = closeCommandPalette;
window.selectPaletteIndex = selectPaletteIndex;
window.openSimuladorModal = openSimuladorModal;
window.closeSimuladorModal = closeSimuladorModal;
window.toggleTimelinePlay = toggleTimelinePlay;
window.cycleTimelineSpeed = cycleTimelineSpeed;
window.resetTimelineLive = resetTimelineLive;

// ============================================================================
// 15. CONTROL DE AUTENTICACIÓN SYSADMIN (CLAVE PROTEGIDA EN SERVIDOR)
// ============================================================================
let pendingSysadminAction = null;

function isSysadminAuthenticated() {
  return Boolean(state.sysadminAuthenticated);
}

function requireSysadminAuth(onSuccess) {
  if (isSysadminAuthenticated()) {
    if (typeof onSuccess === 'function') onSuccess();
    return;
  }
  pendingSysadminAction = onSuccess;
  openSysadminModal();
}

function openSysadminModal() {
  const modal = document.getElementById('modalSysadminAuth');
  const input = document.getElementById('inputSysadminPin');
  const alertBox = document.getElementById('sysadminAuthAlert');
  if (alertBox) alertBox.classList.add('hidden');
  if (input) {
    input.value = '';
    input.type = 'password';
  }
  if (modal) {
    modal.classList.remove('hidden');
    setTimeout(() => {
      if (input) input.focus();
    }, 120);
  }
}

function closeSysadminModal() {
  const modal = document.getElementById('modalSysadminAuth');
  if (modal) modal.classList.add('hidden');
  pendingSysadminAction = null;
}

async function submitSysadminAuth() {
  const input = document.getElementById('inputSysadminPin');
  const alertBox = document.getElementById('sysadminAuthAlert');
  const alertText = document.getElementById('sysadminAlertText');
  const btnSubmit = document.getElementById('btnSubmitSysadminPin');

  const keyVal = input ? input.value.trim() : '';
  if (!keyVal) {
    if (alertBox && alertText) {
      alertText.textContent = 'Ingrese la clave de autorización de SysAdmin.';
      alertBox.classList.remove('hidden');
    }
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>⏳ Validando en Servidor...</span>';
  }

  try {
    const res = await fetch('api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_sysadmin', password: keyVal })
    });
    const result = await res.json();

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>🔓 Verificar y Acceder</span>';
    }

    if (result.success) {
      state.sysadminAuthenticated = true;
      state.sysadminToken = result.token;
      if (alertBox) alertBox.classList.add('hidden');
      closeSysadminModal();
      showToast('🛡️ ' + (result.message || 'Privilegios de SysAdmin habilitados'));
      playTacticalTone('confirm');

      if (typeof pendingSysadminAction === 'function') {
        const action = pendingSysadminAction;
        pendingSysadminAction = null;
        action();
      }
    } else {
      playTacticalTone('critical');
      if (alertBox && alertText) {
        alertText.textContent = result.message || 'Clave de SysAdmin incorrecta. Acceso denegado.';
        alertBox.classList.remove('hidden');
      }
      if (input) {
        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 1200);
        input.select();
      }
    }
  } catch (err) {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>🔓 Verificar y Acceder</span>';
    }
    if (alertBox && alertText) {
      alertText.textContent = 'Error de comunicación con el servidor.';
      alertBox.classList.remove('hidden');
    }
  }
}

window.isSysadminAuthenticated = isSysadminAuthenticated;
window.requireSysadminAuth = requireSysadminAuth;
window.openSysadminModal = openSysadminModal;
window.closeSysadminModal = closeSysadminModal;
window.submitSysadminAuth = submitSysadminAuth;

window.toggleModuleInstallation = function(type) {
  if (state.installedModules && state.installedModules[type]) {
    if (type === 'defensa') uninstallDefensaModule();
    else if (type === 'rutas') uninstallRutasModule();
  } else {
    requireSysadminAuth(() => {
      if (type === 'defensa') installDefensaModule();
      else if (type === 'rutas') installRutasModule();
    });
  }
};

// =============================================================
// CONSOLA INFERIOR TÁCTICA: BARRAS RETRÁCTILES INDEPENDIENTES
// Permite colapsar o desplegar la barra de herramientas y la línea
// de tiempo (Time Machine 48h) de forma individual o simultánea.
// =============================================================
function setupBottomDockToggles() {
  const toolsBar = document.getElementById('mapBottomToolsBar');
  const timelineBar = document.getElementById('globalTimelineBar');
  const tabTools = document.getElementById('tabDockTools');
  const tabTimeline = document.getElementById('tabDockTimeline');
  const btnToggleAll = document.getElementById('btnDockToggleAll');
  const labelToggleAll = document.getElementById('labelToggleAll');
  const btnMinTools = document.getElementById('btnMinimizeToolsBar');
  const btnMinTimeline = document.getElementById('btnMinimizeTimelineBar');

  if (!toolsBar || !timelineBar) return;

  function updateDockState(savePref = true) {
    const toolsHidden = toolsBar.classList.contains('retracted');
    const timelineHidden = timelineBar.classList.contains('retracted');

    if (tabTools) {
      tabTools.classList.toggle('active', !toolsHidden);
      const ind = tabTools.querySelector('.dock-pill-indicator');
      if (ind) ind.textContent = toolsHidden ? '▴' : '▾';
    }

    if (tabTimeline) {
      tabTimeline.classList.toggle('active', !timelineHidden);
      const ind = tabTimeline.querySelector('.dock-pill-indicator');
      if (ind) ind.textContent = timelineHidden ? '▴' : '▾';
    }

    if (labelToggleAll) {
      const allHidden = toolsHidden && timelineHidden;
      labelToggleAll.textContent = allHidden ? '▲ Mostrar Barras' : '▼ Ocultar Todo';
    }

    // Reposicionamiento dinámico de la leyenda del mapa
    const legend = document.getElementById('mapLegendBar');
    if (legend) {
      if (toolsHidden && timelineHidden) {
        legend.style.bottom = '55px';
      } else if (toolsHidden || timelineHidden) {
        legend.style.bottom = '95px';
      } else {
        legend.style.bottom = '128px';
      }
    }

    if (savePref) {
      try {
        localStorage.setItem('dgime_bottom_dock', JSON.stringify({
          tools: !toolsHidden,
          timeline: !timelineHidden
        }));
      } catch (e) {}
    }
  }

  // Cargar preferencia previa si existe
  try {
    const saved = localStorage.getItem('dgime_bottom_dock');
    if (saved) {
      const pref = JSON.parse(saved);
      if (pref.tools === false) toolsBar.classList.add('retracted');
      if (pref.timeline === false) timelineBar.classList.add('retracted');
    }
  } catch (e) {}

  if (tabTools) {
    tabTools.addEventListener('click', () => {
      toolsBar.classList.toggle('retracted');
      const isHidden = toolsBar.classList.contains('retracted');
      updateDockState();
      playTacticalTone(isHidden ? 'warning' : 'confirm');
      showToast(isHidden ? 'Barra de herramientas oculta' : 'Barra de herramientas visible');
    });
  }

  if (btnMinTools) {
    btnMinTools.addEventListener('click', (e) => {
      e.stopPropagation();
      toolsBar.classList.add('retracted');
      updateDockState();
      playTacticalTone('warning');
      showToast('Barra de herramientas oculta');
    });
  }

  if (tabTimeline) {
    tabTimeline.addEventListener('click', () => {
      timelineBar.classList.toggle('retracted');
      const isHidden = timelineBar.classList.contains('retracted');
      updateDockState();
      playTacticalTone(isHidden ? 'warning' : 'confirm');
      showToast(isHidden ? 'Reproductor temporal oculto' : 'Reproductor temporal visible');
    });
  }

  if (btnMinTimeline) {
    btnMinTimeline.addEventListener('click', (e) => {
      e.stopPropagation();
      timelineBar.classList.add('retracted');
      updateDockState();
      playTacticalTone('warning');
      showToast('Reproductor temporal oculto');
    });
  }

  if (btnToggleAll) {
    btnToggleAll.addEventListener('click', () => {
      const allHidden = toolsBar.classList.contains('retracted') && timelineBar.classList.contains('retracted');
      if (allHidden) {
        toolsBar.classList.remove('retracted');
        timelineBar.classList.remove('retracted');
        showToast('Barras tácticas desplegadas');
        playTacticalTone('confirm');
      } else {
        toolsBar.classList.add('retracted');
        timelineBar.classList.add('retracted');
        showToast('Barras tácticas retraídas (Vista despejada)');
        playTacticalTone('warning');
      }
      updateDockState();
    });
  }

  // Sincronizar estado visual al arranque
  updateDockState(false);
}

window.setupBottomDockToggles = setupBottomDockToggles;




