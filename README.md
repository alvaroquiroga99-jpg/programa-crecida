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
- Plan de etapa oficial primaria con APIs, fases y presupuesto orientativo.

## Archivos principales

- `index.html`: pantalla principal.
- `styles.css`: diseño responsive.
- `app.js`: datos demo e interacción.
- `map-data.js`: geometría simplificada de departamentos.
- `schema.sql`: modelo inicial de base de datos.
- `ARCHITECTURE.md`: arquitectura recomendada del MVP.
- `PLAN_ETAPA_OFICIAL.md`: alcance sugerido para pasar a piloto oficial.
- `tools/build-map-data.js`: regenerador del mapa desde GeoJSON oficial.

## Próximo paso técnico

Convertir esta maqueta en una aplicación real:

1. Validar responsables reales, roles y circuito de escalamiento.
2. Backend seguro en Cloud Run.
3. PostgreSQL Cloud SQL con PostGIS.
4. Autenticación con MFA.
5. Carga manual auditada e integración SMN/SINAME cuando exista acceso.
6. Notificaciones WhatsApp/push.
7. Confirmación y escalamiento persistentes.
