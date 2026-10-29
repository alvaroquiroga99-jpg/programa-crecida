/* =====================================================================
 * Programa CRECIDA — Adaptador de fuente oficial INA (SIyAH)
 * ---------------------------------------------------------------------
 * Reemplaza la fuente caída de DGIME (api.php). Lee DIRECTO del GeoServer
 * público del INA (Sistema de Información y Alerta Hidrológico), sin token
 * y con CORS abierto, así que la app lo consulta en vivo desde el navegador.
 *
 * Fuente: https://alerta.ina.gob.ar/geoserver/ows
 *   capa public2:ultimas_alturas_con_timeseries (últimas alturas por estación)
 *
 * Expone window.CRECIDA_fetchINA() -> Promise<array> ya normalizado con la
 * MISMA forma que usaba el viejo api.php y filtrado a Tucumán, para que
 * app.js y motor.js lo consuman sin cambios de lógica.
 * ===================================================================== */

(function () {
  "use strict";

  const WFS = "https://alerta.ina.gob.ar/geoserver/ows";
  const TYPE = "public2:ultimas_alturas_con_timeseries";

  // Límite generoso de Tucumán (incluye estaciones de borde).
  const TUC = { minLat: -28.10, maxLat: -26.00, minLon: -66.15, maxLon: -64.25 };

  function construirUrl() {
    const hoy = new Date();
    const fin = hoy.toISOString().slice(0, 10);
    const ini = new Date(hoy.getTime() - 10 * 864e5).toISOString().slice(0, 10);
    const vp = `timeStart:${ini};timeEnd:${fin};`;
    return (
      `${WFS}?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=${encodeURIComponent(TYPE)}` +
      `&viewParams=${encodeURIComponent(vp)}` +
      `&maxFeatures=2000&outputFormat=application%2Fjson`
    );
  }

  // Estado textual a partir de umbrales REALES del INA (sin inventar cotas).
  function estadoTexto(valor, umbral, evac) {
    const v = Number(valor);
    const u = Number(umbral) || 0;
    const e = Number(evac) || 0;
    if (e > 0 && Number.isFinite(v) && v >= e) return "Evacuación";
    if (u > 0 && Number.isFinite(v) && v >= u) return "Alerta crecida";
    return "Normal";
  }

  // El INA a veces no trae "rio"; lo derivamos del nombre ("Gastona - ...").
  function rioDeNombre(p) {
    if (p.rio) return String(p.rio);
    const n = p.nombre || "";
    const i = n.indexOf(" - ");
    return i > 0 ? "Río " + n.slice(0, i).trim() : "Río sin dato";
  }

  // --- Solo estaciones DENTRO de Tucumán (29/10) ----------------------------------
  // Antes se filtraba con un rectángulo y entraban estaciones de Catamarca y Santiago del
  // Estero (p. ej. "Del Campo - Cabo San Miguel"). Ahora se usa el polígono de cada
  // departamento y se agrega a cada estación el departamento donde está.
  const DEPTOS_OFICIALES = ["Burruyacú", "Capital", "Chicligasta", "Cruz Alta", "Famaillá", "Graneros",
    "Juan Bautista Alberdi", "La Cocha", "Leales", "Lules", "Monteros", "Río Chico", "Simoca",
    "Tafí del Valle", "Tafí Viejo", "Trancas", "Yerba Buena"];
  const nrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  let poligonos = null;
  async function cargarPoligonos() {
    if (poligonos) return poligonos;
    try {
      const g = await (await fetch("data/departamentos.geojson")).json();
      poligonos = (g.features || []).map((f) => ({
        nombre: DEPTOS_OFICIALES.find((d) => nrm(d) === nrm(f.properties && f.properties.departamento)) || (f.properties && f.properties.departamento) || "",
        anillos: f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]),
      }));
    } catch (e) { poligonos = []; }
    return poligonos;
  }
  function dentro(lon, lat, anillo) {
    let ins = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const xi = anillo[i][0], yi = anillo[i][1], xj = anillo[j][0], yj = anillo[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function departamentoDe(lon, lat, polys) {
    const p = polys.find((x) => x.anillos.some((a) => dentro(lon, lat, a)));
    return p ? p.nombre : null;
  }
  window.CRECIDA_departamentoDe = async (lon, lat) => departamentoDe(lon, lat, await cargarPoligonos());

  window.CRECIDA_fetchINA = async function () {
    const polys = await cargarPoligonos();
    const res = await fetch(construirUrl(), { cache: "no-store" });
    if (!res.ok) throw new Error("INA WFS HTTP " + res.status);
    const geo = await res.json();
    const feats = Array.isArray(geo.features) ? geo.features : [];

    return feats
      .map((f) => {
        const p = f.properties || {};
        const g = f.geometry || {};
        const c = Array.isArray(g.coordinates) ? g.coordinates : [];
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        const umbral = Number(p.nivel_de_alerta) || 0;
        const evac = Number(p.nivel_de_evacuacion) || 0;
        return {
          nombre: p.nombre || rioDeNombre(p) || "Estación INA",
          rio: rioDeNombre(p),
          tramo: "",
          altura_m: Number(p.valor),
          valor_precedente: Number(p.valor_precedente),
          caudal_m3s: NaN,
          tendencia: p.tendencia || "permanece",
          nivel_alerta: estadoTexto(p.valor, umbral, evac),
          nivel_alerta_umbral: umbral,
          nivel_evacuacion: evac,
          fecha: p.fecha || "",
          lat: lat,
          lon: lon,
          fuente: "INA · SIyAH (alerta.ina.gob.ar)",
        };
      })
      .filter(
        (s) =>
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lon) &&
          s.lat >= TUC.minLat &&
          s.lat <= TUC.maxLat &&
          s.lon >= TUC.minLon &&
          s.lon <= TUC.maxLon,
      )
      .map((s) => Object.assign(s, { departamento: polys.length ? departamentoDe(s.lon, s.lat, polys) : null }))
      // Con polígonos cargados, quedan solo las estaciones que están dentro de Tucumán.
      .filter((s) => !polys.length || !!s.departamento);
  };

  window.CRECIDA_INA_URL = construirUrl();
})();
