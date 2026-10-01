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

  window.CRECIDA_fetchINA = async function () {
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
      );
  };

  window.CRECIDA_INA_URL = construirUrl();
})();
