/* =====================================================================
 * Programa CRECIDA — Reglas de cuenca (BORRADOR PARA VALIDAR)
 * ---------------------------------------------------------------------
 * Mapea cada aforo del INA (dentro de Tucumán) con los departamentos
 * que quedan AGUAS ABAJO y podrían verse afectados si ese río crece.
 *
 * IMPORTANTE (Álvaro):
 *   - "departamentos" es un BORRADOR geográfico, hecho para que el motor
 *     funcione hoy. Revisalo con tu conocimiento de las cuencas.
 *   - "tt_horas" = tiempo de tránsito estimado de la crecida hasta ese
 *     departamento (las horas de anticipación reales). Queda en null =
 *     POR VALIDAR. Cuando lo cargues, el sistema podrá decir "tenés X h".
 *   - "match" se compara (sin distinguir mayúsculas) contra el nombre
 *     del aforo que devuelve el INA.
 * ===================================================================== */

window.CRECIDA_REGLAS = [
  // --- Cuenca Salí (eje central de la provincia) ---
  { match: "Salí - Simoca",      rio: "Río Salí",    departamentos: ["Simoca"],                          tt_horas: null },
  { match: "Salí - RP Nº323",    rio: "Río Salí",    departamentos: ["Monteros", "Simoca"],              tt_horas: null },
  { match: "Salí - Alta Gracia", rio: "Río Salí",    departamentos: ["Capital", "Cruz Alta"],            tt_horas: null },

  // --- Afluentes del sur (Gastona, Marapa, Chico, Seco) ---
  { match: "Gastona",            rio: "Río Gastona", departamentos: ["Chicligasta", "Simoca"],           tt_horas: null },
  { match: "Marapa",             rio: "Río Marapa",  departamentos: ["Graneros", "La Cocha"],            tt_horas: null },
  { match: "Chico - RN",         rio: "Río Chico",   departamentos: ["Río Chico", "Juan Bautista Alberdi", "Graneros"], tt_horas: null },
  { match: "Seco - RN",          rio: "Río Seco",    departamentos: ["Juan Bautista Alberdi", "Chicligasta"], tt_horas: null },

  // --- Pedemonte y oeste (Los Sosa) ---
  { match: "Los Sosa",           rio: "Río Los Sosa", departamentos: ["Monteros"],                       tt_horas: null },

  // --- Norte (El Tala, Vipos) ---
  { match: "El Tala",            rio: "Río El Tala", departamentos: ["Trancas"],                         tt_horas: null },
  { match: "Vipos",              rio: "Río Vipos",   departamentos: ["Trancas", "Tafí Viejo"],           tt_horas: null },

  // --- Oeste / valles (revisar con cuidado) ---
  { match: "Del Campo",          rio: "Río Del Campo", departamentos: ["Tafí del Valle"],               tt_horas: null },
];
