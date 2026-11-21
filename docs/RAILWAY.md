# Despliegue en Railway

La aplicación es **un único servicio** (API e interfaz). Usa además un **servicio PostgreSQL** aparte y un **almacenamiento persistente** para fotos, planos, informes y copias. Ese almacenamiento puede ser un Volumen o un Bucket.

## 1. Crear el proyecto

1. Sube este repositorio a GitHub.
2. En Railway, crea un proyecto con **New Project → Deploy from GitHub repo** y elige el repositorio. Railway detecta Node y usa `railway.json`:
   - *build*: `npm run build`, que compila la interfaz;
   - *start*: `npm start`, que aplica las migraciones pendientes y arranca;
   - *healthcheck*: `/api/salud`, que comprueba también la conexión a la base de datos.
3. Añade la base de datos con **+ New → Database → PostgreSQL**. Queda como un servicio independiente con sus propias copias.

## 2. Variables del servicio de la aplicación

En **Variables** del servicio web:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia al servicio de base de datos) |
| `JWT_SECRET` | una cadena larga y aleatoria; sin ella la app no arranca en producción |
| `NODE_ENV` | `production` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | el administrador inicial, que solo se crea si la tabla de usuarios está vacía |
| `TZ` | `Europe/Madrid` |

Las demás variables son opcionales y están descritas en [`.env.example`](../.env.example).

## 3. Almacenamiento de archivos (elige una opción)

**A. Volumen (lo más sencillo).** En el servicio web, abre **+ New → Volume** y móntalo en `/data`. La app detecta `RAILWAY_VOLUME_MOUNT_PATH` sola. También puedes poner `UPLOAD_DIR=/data`.

**B. Bucket compatible S3** (Railway Buckets, Cloudflare R2, AWS S3, MinIO). Define `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`. Si usas un Bucket de Railway, puedes referenciar directamente sus variables `BUCKET`, `ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` y `REGION`, porque la app también las reconoce.

## 4. Dominio

En **Settings → Networking → Generate Domain**, o añade tu propio dominio. Los códigos QR apuntan a `PUBLIC_URL` o, si no está definida, al dominio de Railway (`RAILWAY_PUBLIC_DOMAIN`). **Fija el dominio antes de imprimir las etiquetas.**

## 5. Datos de ejemplo (opcional)

Desde tu ordenador, con la CLI de Railway enlazada al proyecto:

```bash
railway run npm run seed -- --prueba
```

## 6. Copias de seguridad

- **Railway Postgres** guarda sus propias copias del volumen de la base de datos. Actívalas en el servicio Postgres, pestaña *Backups*.
- **La aplicación** guarda además una copia diaria (`BACKUP_CRON`, por defecto a las 02:30) con todas las tablas en JSON comprimido, dentro del almacenamiento de archivos. Conserva las últimas `BACKUP_KEEP`. Desde **Copias y sistema** puedes hacer una copia al momento y descargar cualquiera.
- Para restaurar una copia de la aplicación:

```bash
railway run npm run restaurar -- backup-AAAA-MM-DD.json.gz --confirmar
```

## 7. Actualizaciones

Cada `git push` a la rama conectada vuelve a desplegar el servicio. Las migraciones nuevas (`server/migrations/00N_*.sql`) se aplican solas al arrancar, en orden y dentro de una transacción.
