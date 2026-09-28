# Programa CRECIDA - Firebase

## Recomendacion

Usar Firebase como base principal:

- Firebase Hosting para publicar la app.
- Firebase Auth para super admin, admins y usuarios operativos.
- Cloud Firestore para alertas, responsables, confirmaciones y bitacora.
- Cloud Functions como proxy/cache de APIs externas.
- Cloud Storage para reportes PDF y adjuntos futuros.

## Proyecto sugerido

Nombre: `programa-crecida` o `crecida-dgime`

Dominio futuro recomendado: `crecida.dgime.site`

## Pasos de despliegue

1. Crear proyecto en Firebase Console.
2. Activar Authentication con email/password.
3. Crear Firestore en modo production.
4. Copiar la configuracion web en `firebase-config.js`.
5. Ajustar `.firebaserc` con el ID real del proyecto.
6. Ejecutar:

```bash
npm install
npm run build
npx firebase login
npx firebase deploy
```

## Roles previstos

- `SUPER_ADMIN`: control total. Reservado para Alvaro Dario Quiroga.
- `ADMIN`: gestiona datos operativos, usuarios, alertas y destinatarios dentro de su alcance.
- `USUARIO_OPERATIVO`: recibe comunicaciones, confirma recepcion y reporta estado.
- `VISUALIZADOR`: consulta solamente.

Los roles definitivos deben cargarse como custom claims de Firebase Auth desde backend/admin.

## APIs externas detectadas en el geovisor DGIME

Endpoints:

- `api.php?action=get_stations`
- `api.php?action=refresh`
- `api.php?action=get_hidro`
- `api.php?action=get_rutas`
- `api.php?action=get_defensa_civil`
- `api.php?action=get_inundaciones`
- `api.php?action=get_bomberos`
- `api.php?action=get_focos_incendio`
- `api.php?action=fetch_firms_data`
- `api.php?action=get_presas`
- `api.php?action=get_timeline`
- `api.php?action=verify_sysadmin`

JSON de respaldo:

- `estaciones_data.json`
- `hidro_ina.json`
- `geolocalizacion.json`
- `tucuman_rios.json`
- `tucuman_boundary.json`
- `modulos/rutas_criticas.json`
- `modulos/defensa_civil.json`
- `modulos/inundaciones.json`
- `modulos/bomberos.json`
- `modulos/focos_incendio.json`
- `modulos/presas_tucuman.json`

## Estrategia

No consumir todo directo desde el navegador. Primero usar Cloud Functions como proxy/cache:

- Evita problemas de CORS.
- Protege claves o tokens si aparecen.
- Permite normalizar datos.
- Permite cache de 10 a 15 minutos.
- Permite auditar fuente y fecha de sincronizacion.
