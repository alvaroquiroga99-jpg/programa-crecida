# Arquitectura del MVP - Programa CRECIDA

## Objetivo

Detectar una alerta oficial, ubicarla territorialmente en Tucumán, avisar a los responsables correctos y registrar quién confirmó recepción.

## Flujo operativo

1. SMN/SINAME publica una alerta o aviso a muy corto plazo.
2. Cloud Scheduler ejecuta una consulta periódica.
3. Cloud Run valida si la alerta es nueva, vigente y oficial.
4. PostgreSQL + PostGIS cruza el polígono de alerta con departamentos, municipios y puntos críticos.
5. Pub/Sub crea tareas de notificación por canal.
6. WhatsApp Business API y Firebase Cloud Messaging envían los avisos.
7. Los responsables confirman recepción.
8. Si no confirman dentro del plazo, el sistema escala a Defensa Civil provincial y 107 Central.
9. Cada paso queda guardado en auditoría.

## Infraestructura recomendada

| Componente | Servicio |
| --- | --- |
| Frontend PWA | Firebase Hosting o Cloud Run |
| Autenticación | Firebase Authentication / Identity Platform |
| MFA | Obligatorio para usuarios operativos críticos |
| Backend API | Cloud Run |
| Base de datos | Cloud SQL PostgreSQL |
| Geografía | PostGIS |
| Programación automática | Cloud Scheduler |
| Cola y reintentos | Pub/Sub |
| Secretos | Secret Manager |
| Logs y auditoría cloud | Cloud Logging / Audit Logs |
| Notificaciones app | Firebase Cloud Messaging |
| WhatsApp | Meta WhatsApp Business API o proveedor autorizado |
| SMS contingencia | Proveedor SMS a definir |

## Reglas de seguridad del MVP

- Ningún cliente accede directo a la base de datos.
- Todas las llamadas pasan por API autenticada.
- MFA obligatorio para administración, Defensa Civil provincial y 107 Central.
- Roles por organismo y jurisdicción.
- Secretos fuera del código.
- Auditoría inmodificable desde la interfaz.
- Backups automáticos y recuperación a punto en el tiempo.
- Alta disponibilidad en producción.
- Canales alternativos para alertas rojas.

## Roles iniciales

- Administrador del sistema.
- Defensa Civil provincial.
- 107 Central.
- Responsable local.
- Salud / Higiene y Seguridad.
- Visualizador.

## Decisión de base de datos

La base debe ser relacional y geográfica. Por eso la recomendación es PostgreSQL con PostGIS.

El cruce clave del sistema es:

```sql
select j.name
from jurisdictions j
join alert_areas aa on st_intersects(j.geom, aa.geom)
where aa.alert_id = :alert_id;
```

Esto evita cargar manualmente qué localidades fueron afectadas. La alerta trae un polígono, la base calcula el impacto.

## Próximo desarrollo

1. Convertir el prototipo estático en app con backend.
2. Crear login y roles.
3. Crear API de alertas.
4. Conectar detector SMN en modo lectura.
5. Guardar alertas reales en PostgreSQL.
6. Activar notificaciones de prueba.
7. Agregar confirmación de recepción.
8. Activar escalamiento automático.
9. Hacer prueba cerrada con usuarios internos.
10. Pasar a entorno productivo con alta disponibilidad.
