# Programa CRECIDA - etapa oficial primaria

Objetivo: pasar del MVP visual a una primera version oficial, usable por responsables reales, con trazabilidad, seguridad y canales de notificacion.

## Alcance recomendado

- Tablero operativo online para alerta vigente.
- Usuarios con roles: sala provincial, 107, Higiene y Seguridad, Defensa Civil, municipio y consulta.
- Base de datos persistente para alertas, confirmaciones, escalamiento y auditoria.
- Carga manual auditada de alertas como respaldo institucional.
- Integracion progresiva con fuente oficial SMN/SINAME cuando exista acceso autorizado.
- Notificaciones por app y WhatsApp; SMS queda como contingencia de etapa siguiente.
- Reporte simple por alerta: enviados, confirmados, pendientes, escalados y tiempos.

## APIs e integraciones

| Integracion | Necesidad | Estado recomendado |
| --- | --- | --- |
| Georef Argentina | Mapa y jurisdicciones | Usar datos precargados; no requiere costo runtime |
| SMN / SINAME | Fuente oficial de alertas | Gestion institucional; iniciar con carga manual auditada |
| WhatsApp Business | Mensajes automaticos | Requiere alta, plantillas y costo por uso |
| Firebase Cloud Messaging | Push dentro de la app | Bajo costo, util para MVP |
| Firebase Auth / Identity Platform | Login y MFA | Recomendado para roles reales |
| PostgreSQL + PostGIS | Datos, geometria y auditoria | Necesario para etapa oficial |
| SMS | Contingencia alerta roja | Etapa 2, segun presupuesto |

## Presupuesto orientativo

Construccion inicial: USD 8.000 a USD 18.000.

Costo mensual operativo inicial: USD 80 a USD 600, variable por mensajes, base de datos, trafico y soporte.

## Fases

1. Semana 1: validar roles, responsables, jurisdicciones y circuito real de escalamiento.
2. Semanas 2-3: backend, base de datos, login y auditoria persistente.
3. Semanas 4-5: carga de alertas, confirmaciones reales y tablero conectado.
4. Semanas 6-7: WhatsApp/push, plantillas, permisos y pruebas con usuarios designados.
5. Semanas 8-10: piloto controlado, ajustes operativos y decision de escalamiento.

## Decisiones que destraban el desarrollo

- Quien sera el responsable institucional del sistema.
- Que organismos entran en el piloto primario.
- Si la alerta oficial se carga manualmente al inicio o se espera acceso a API.
- Cuales son los canales autorizados para notificar.
- Cual es el plazo de confirmacion antes de escalar.
- Que nivel de privacidad tendran reportes, usuarios y bitacora.
