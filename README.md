# Control Integral de Obras

Aplicación web para gestionar la **fabricación y el montaje de estructuras metálicas**: obras, fases, piezas, toneladas, personal, partes diarios, costes e informes. Funciona en ordenador (menú lateral y tablas) y en móvil (navegación inferior, tarjetas y botones grandes, pensados para usarse con guantes). Se instala como app (PWA) y sigue funcionando con cobertura débil.

| | |
|---|---|
| **Servidor** | Node.js 20+ · Express 5 · PostgreSQL |
| **Interfaz** | React 19 + Vite · CSS propio (modo claro y oscuro) · PWA con *service worker* |
| **Archivos** | Volumen de Railway o bucket compatible S3, separados de la aplicación |
| **Seguridad** | Contraseñas con bcrypt, sesión en cookie `httpOnly`, permisos comprobados en el servidor en cada ruta |

## Documentación por etapas

Cada documento trae la estructura de la base de datos, las pantallas, los flujos de uso, el despliegue en Railway y los datos de ejemplo con los resultados que deben salir:

1. [Etapa 1: obras, fases, piezas, toneladas y usuarios](docs/ETAPA-1.md)
2. [Etapa 2: partes diarios, personal, fotos, QR y montaje en el móvil](docs/ETAPA-2.md)
3. [Etapa 3: costes, presupuestos, rendimientos e informes automáticos](docs/ETAPA-3.md)
4. [Despliegue en Railway paso a paso](docs/RAILWAY.md)

## La regla de las toneladas

- **Toneladas únicas** son el peso real de la obra: Σ (peso unitario × cantidad). Cada pieza cuenta **una sola vez**.
- **Kg de una fase** son las unidades completadas en esa fase × su peso unitario.
- **% de una fase** son los kg completados en la fase / los kg previstos para esa fase. Cada fase se calcula con sus propias cantidades.
- **Producción acumulada** es la suma de los kg de todas las fases (o de los movimientos). Sirve para medir trabajo realizado, **nunca** para saber el tonelaje de la obra.
- **Dónde está el material** sale de restar los kg completados en una fase a los de la fase anterior. Esa cifra indica lo que espera en cada fase, y sumada para todas da exactamente las toneladas únicas.

Ejemplo: 108.000 kg cortados de 120.000 kg previstos dan un 90 % en corte, sin importar cómo vayan las demás fases.

## Puesta en marcha en local

```bash
npm install
```

```bash
cp .env.example .env   # ajusta DATABASE_URL a tu PostgreSQL local
```

```bash
npm run seed           # migra la base de datos y carga los datos de ejemplo
```

```bash
npm run dev            # API en :3000 y Vite en :5173
```

Entra en http://localhost:5173 con `admin` / `admin1234`. Hay también un usuario de ejemplo por perfil (`director`, `taller`, `montaje`, `operario`, `oficina`), todos con la contraseña `Demo2026!`.

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila la interfaz en `dist/` |
| `npm start` | Arranca en producción: aplica las migraciones y sirve la API y la interfaz |
| `npm run seed -- --prueba` | Carga solo la obra de prueba (P-01, P-02, V-01, V-02, C-01) |
| `npm run seed -- --reset` | Borra todos los datos y vuelve a cargar los de ejemplo |
| `npm test` | Comprueba los cálculos de toneladas, las restricciones de avance y los permisos |
| `npm run restaurar -- copia.json.gz --confirmar` | Restaura una copia de seguridad |

## Estructura

```
server/
  index.js            arranque, seguridad (helmet, CSP), rutas y estáticos
  migrations/         001_etapa1.sql · 002_etapa2.sql · 003_etapa3.sql
  services/
    produccion.js     NÚCLEO: avances, estado de pieza, resumen de toneladas
    informes.js       producción, rendimientos, costes, retrasos
    catalogo.js       definición de los informes
    exportar.js       PDF (pdfkit) y Excel (exceljs)
    tareas.js         copias de seguridad e informes programados (cron)
  routes/             auth, usuarios, obras, fases, piezas, panel, personal,
                      montaje, archivos, costes, informes, sistema
  permissions.js      perfiles y permisos
client/src/
  pages/              una pantalla por apartado del menú
  components/         ui, Avance (hoja de avance + lector QR), Piezas, Fases, Archivos…
  lib/                api (con cola sin conexión), formatos españoles, contexto
scripts/              seed, restaurar, iconos
tests/                pruebas de los cálculos
```
