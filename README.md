# Programa CRECIDA

MVP inicial para revisar el flujo operativo de alerta temprana y coordinación con 107, Defensa Civil, Salud/Higiene y Seguridad y municipios.

CRECIDA significa: Conocer, Reconocer, Ejecutar, Cuidar, Integrar, Demostrar y Actualizar.

## Qué incluye

- Tablero operativo de alerta vigente.
- Mapa SVG de Tucumán con los 17 departamentos.
- Separación entre riesgo territorial y respuesta operativa.
- Confirmación de recepción por jurisdicción y organismo.
- Escalamiento por falta de respuesta.
- Destinatarios por canal.
- Plantilla de WhatsApp automático.
- Bitácora de auditoría.
- Modelo inicial de base de datos PostgreSQL/PostGIS.
- Documento de arquitectura para pedir presupuesto técnico.

## Archivos principales

- `index.html`: pantalla principal.
- `styles.css`: diseño responsive.
- `app.js`: datos demo e interacción.
- `map-data.js`: geometría simplificada de departamentos.
- `schema.sql`: modelo inicial de base de datos.
- `ARCHITECTURE.md`: arquitectura recomendada del MVP.
- `tools/build-map-data.js`: regenerador del mapa desde GeoJSON oficial.

## Próximo paso técnico

Convertir esta maqueta en una aplicación real:

1. Backend seguro en Cloud Run.
2. PostgreSQL Cloud SQL con PostGIS.
3. Autenticación con MFA.
4. Detector de alertas SMN/SINAME.
5. Notificaciones WhatsApp/push.
6. Confirmación y escalamiento persistentes.
