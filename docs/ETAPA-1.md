# Etapa 1: obras, fases, piezas, toneladas y usuarios

## 1. Estructura de la base de datos (`server/migrations/001_etapa1.sql`)

Todas las masas se guardan en **kilogramos** (`numeric`). Las toneladas siempre se calculan como kg / 1.000.

| Tabla | Para qué sirve | Campos clave |
|---|---|---|
| `usuarios` | Acceso y perfil | `username`, `password_hash` (bcrypt), `nombre`, `rol`, `activo` |
| `obras` | Ficha de obra | `codigo`, `nombre`, `cliente`, `direccion`, `responsable_id`, `fecha_inicio`, `fecha_entrega`, `kg_contratados`, `kg_previstos_fab`, `kg_previstos_montaje`, `presupuesto`, `estado` |
| `fases_plantilla` | Las 9 fases por defecto | `orden`, `clave`, `nombre`, `ambito` (oficina/taller/obra), `peso_ponderacion`, `indicador` |
| `obra_fases` | Fases de cada obra (copiadas de la plantilla y editables) | `obra_id`, `orden`, `nombre`, `ambito`, `kg_previstos` (opcional), `fecha_inicio_prevista`, `fecha_fin_prevista`, `peso_ponderacion` |
| `piezas` | Marcas | `marca`, `elemento`, `perfil`, `plano`, `peso_unitario_kg`, `cantidad`, fechas de fabricación, expedición y montaje, `incidencia`, `observaciones`, `qr_token` |
| `pieza_avance` | **Unidades completadas** de cada pieza en cada fase | `pieza_id`, `obra_fase_id`, `cantidad` |
| `movimientos` | Cada cambio de fase: fecha, hora y responsable | `pieza_id`, `obra_fase_id`, `cantidad` (positiva si avanza, negativa si corrige), `kg`, `usuario_id`, `origen`, `nota`, `fecha` |
| `historial` | Trazabilidad de cualquier cambio | `entidad`, `entidad_id`, `obra_id`, `accion`, `detalle`, `datos` (jsonb con el antes y el después), `usuario_id` |

**Invariante** (lo garantiza el servidor): `completadas(fase n+1) ≤ completadas(fase n) ≤ cantidad`. No se puede pintar lo que aún no se ha soldado. Si se intenta, el mensaje es claro, por ejemplo: *«Solo hay 2 unidad(es) de V-02 disponibles en "Control de calidad". Las demás aún no han terminado "Armado y soldadura".»*

Una marca con varias unidades puede avanzar **parcialmente**: 3 de las 6 vigas V-01 pueden estar expedidas mientras las otras 3 siguen en el taller.

### Cálculos (`server/services/produccion.js`)

```
peso marca              = peso_unitario × cantidad
toneladas únicas        = Σ peso marca                       (cada pieza 1 vez)
kg completados fase F   = Σ completadas(F) × peso_unitario
% fase F                = kg completados F / kg previstos F
kg previstos F          = obra_fases.kg_previstos  ó  previstos de fabricación
                          (o de montaje si la fase es de obra)  ó  peso registrado
kg en la fase F         = kg completados (F−1) − kg completados F   ← dónde está el material
producción acumulada    = Σ kg completados de todas las fases  (NO es tonelaje)
avance global           = Σ (% fase × ponderación) / Σ ponderaciones
fase retrasada          = fin previsto < hoy y la fase no está terminada
```

Ponderaciones por defecto: ingeniería 5, compras 10, corte 10, armado 25, calidad 5, pintura 10, expedición 5, montaje 25, entrega 5. Se pueden editar por obra.

## 2. Perfiles y permisos (`server/permissions.js`)

El servidor comprueba el permiso en **cada ruta**. La interfaz solo oculta lo que el perfil no puede usar.

| Perfil | Puede |
|---|---|
| Administrador | Todo, incluidos usuarios y copias de seguridad |
| Director de producción | Todas las obras y fases, piezas, avances, costes e informes |
| Jefe de taller | Piezas (alta e importación), fases, avances de oficina y taller, correcciones, horas e informes |
| Encargado de montaje | Avances de obra (montaje y entrega), partes de montaje y fotos |
| Operario | Ver obras y piezas, registrar avances de taller y sus propias horas |
| Administración | Costes, presupuestos, personal, informes y fichas de obra |

Cada fase tiene un **ámbito**. Para registrar avance en una fase de taller hace falta `avance.taller`; en una fase de obra, `avance.obra`.

## 3. Pantallas principales

| Pantalla | Escritorio | Móvil |
|---|---|---|
| **Panel principal** | Accesos rápidos, KPI en toneladas (únicas, fabricadas, montadas, obras retrasadas), gráfico de 14 días por fase, tarjetas de obra con anillo de avance, últimos movimientos e incidencias | Lo mismo en una columna, con barra inferior y botón central **Escanear** |
| **Resumen de producción** | Matriz obra × fase con % y t, coloreada por estado; vista detallada con barras por fase y «¿Dónde está el material?» | Tarjetas por obra |
| **Obras** | Tabla con t únicas, fabricadas, montadas, avance y estado | Tarjetas |
| **Ficha de obra** | Cabecera con las toneladas previstas, recibidas, cortadas, armadas, inspeccionadas, pintadas, expedidas y montadas. Pestañas: Resumen · Piezas · Fases · Planos y documentos · Partes · Costes · Historial | Pestañas desplazables |
| **Gestión de proyectos** | Gantt de obras y de fases (plan frente a avance real, con la línea de hoy) y editor de fases | Gantt en filas |
| **Fabricación** | Tarjetas por fase con las t que esperan, lista de piezas con **Avanzar**, selección múltiple y avance en lote | Tarjeta por pieza con botón grande «Completar ‹fase›» |
| **Usuarios y permisos** | Alta, perfil, activar o desactivar, cambio de contraseña | — |

Estados con color y texto: **verde** Terminado · **ámbar** En curso · **rojo** Retrasado · **gris** Pendiente. Cada estado lleva además un icono distinto, para no depender solo del color.

## 4. Flujos de uso

**Alta de obra.** Obras → «Nueva obra» → rellenar la ficha (las toneladas se escriben en t) → Guardar. Se crean las 9 fases por defecto.

**Cargar piezas.** Ficha de obra → Piezas → «Importar» → pegar desde Excel las columnas `marca · elemento · perfil · plano · peso unitario · cantidad · observaciones`. Si hay errores no se importa nada y se indica la fila. Si una marca ya existe, se actualiza.

**Registrar un avance (2 toques).** Fabricación → **Avanzar** en la pieza (1) → **Confirmar** (2). Por defecto se completan todas las unidades disponibles de la fase actual. Con el selector se puede indicar una cantidad parcial.

**Avance en lote.** Marca varias piezas → «Avance en lote» → «completar fase actual» o «llevar hasta la fase X».

**Corregir un error.** En la hoja de avance → «Corregir error» → elegir fase y unidades. Solo perfiles con `avance.corregir`. Se registra como un movimiento negativo.

**Editar fases.** Ficha → Fases (o Gestión de proyectos) → editar nombre, ámbito, fechas previstas, toneladas previstas y ponderación, o añadir una fase. Si ya hay avances, una fase nueva en medio se da por completada para las piezas que ya la habían pasado. No se puede eliminar una fase que tiene movimientos.

**Búsqueda.** La barra superior busca obras y piezas por código, marca, plano o perfil. En escritorio se activa con `/` o `Ctrl+K`.

## 5. Despliegue

Consulta [RAILWAY.md](RAILWAY.md). La etapa 1 solo necesita PostgreSQL y las variables `DATABASE_URL`, `JWT_SECRET` y `ADMIN_*`.

## 6. Datos de ejemplo y comprobación de cálculos

```bash
npm run seed -- --prueba
```

Crea la obra **OB-PRUEBA** (previstas 20.520 kg, contratadas 21.000 kg):

| Marca | Elemento | Perfil | Peso ud | Cant. | Peso marca | Situación |
|---|---|---|---:|---:|---:|---|
| P-01 | Pilar | HEB-300 | 1.250 kg | 4 | 5.000 kg | Montadas las 4 |
| P-02 | Pilar | HEB-260 | 980 kg | 2 | 1.960 kg | Expedidas las 2 |
| V-01 | Viga | IPE-400 | 1.100 kg | 6 | 6.600 kg | Pintadas las 6; **3 expedidas** |
| V-02 | Viga | IPE-300 | 640 kg | 4 | 2.560 kg | Armadas y soldadas |
| C-01 | Cercha | Tubo 120.80.6 | 2.200 kg | 2 | 4.400 kg | Cortadas |
| | | | | **18 ud** | **20.520 kg** | **= 20,52 t únicas** |

**Resultados esperados:**

| Fase | Completado | % (sobre 20.520) | En la fase |
|---|---:|---:|---:|
| 1 Ingeniería | 20.520 kg | 100 % | 0 |
| 2 Compras (recibidas) | 20.520 kg | 100 % | 0 |
| 3 Corte (cortadas) | 20.520 kg | 100 % | 0 |
| 4 Armado y soldadura | 16.120 kg | 78,6 % | 4.400 (C-01) |
| 5 Calidad (inspeccionadas) | 13.560 kg | 66,1 % | 2.560 (V-02) |
| 6 Pintura (pintadas) | 13.560 kg | 66,1 % | 0 |
| 7 Expedición (expedidas) | 10.260 kg | 50,0 % | 3.300 (3 × V-01) |
| 8 Montaje (montadas) | 5.000 kg | 24,4 % | 5.260 (P-02 + 3 × V-01) |
| 9 Entrega | 0 kg | 0 % | 5.000 (P-01) |

- **Toneladas únicas: 20,52 t.** La suma de la columna «En la fase» más lo entregado da 20.520 kg.
- **Producción acumulada: 120,06 t.** Es la suma de la columna «Completado», cerca de 6 veces el peso real, y por eso **no** se usa como tonelaje.
- **Avance global ponderado: 63,1 %.**
- Pendiente de fabricar: 20.520 − 13.560 = **6,96 t**. Pendiente de montar: 20.520 − 5.000 = **15,52 t**.

`npm test` comprueba automáticamente todas estas cifras. También verifica que no se puede pintar V-02 antes de pasar calidad y que un operario no puede registrar montaje.
