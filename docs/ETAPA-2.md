# Etapa 2: partes diarios, personal, fotografías, QR y montaje en el móvil

## 1. Estructura de la base de datos (`server/migrations/002_etapa2.sql`)

| Tabla | Para qué sirve | Campos clave |
|---|---|---|
| `equipos` | Cuadrillas y equipos de trabajo | `nombre`, `seccion` |
| `trabajadores` | Personal | `nombre`, `seccion` (corte, armado, soldadura, pintura, montaje, calidad, expedición, oficina), `categoria`, `coste_hora`, `equipo_id`, `usuario_id` (enlace opcional con su usuario) |
| `trabajador_operaciones` | Operaciones asignadas a cada trabajador | `trabajador_id`, `clave_fase` |
| `medios` | Grúas, plataformas, camiones grúa, carretillas | `nombre`, `tipo`, `matricula`, `coste_hora`, `propio` |
| `partes_horas` | Horas por trabajador, día, obra y sección | `fecha`, `trabajador_id`, `obra_id`, `seccion`, `horas`, `operacion`, `coste` (horas × €/h en ese momento), `parte_montaje_id` |
| `partes_montaje` | Parte diario del encargado | `obra_id`, `fecha`, `encargado_id`, piezas recibidas, descargadas y montadas, `kg_recibidos`, `kg_montados`, `horas_totales`, `clima`, `incidencias`, `observaciones` |
| `parte_montaje_medios` | Medios usados en el parte y sus horas | `parte_id`, `medio_id`, `horas` |
| `archivos` | Fotos, planos, documentos, informes y copias (solo la referencia; el archivo está en el almacenamiento externo) | `entidad` (obra/pieza/parte_montaje/informe/backup), `entidad_id`, `tipo`, `nombre`, `mime`, `tamano`, `clave` |
| `movimientos` (+) | Nuevas columnas | `trabajador_id` (quién lo hizo, para medir el rendimiento), `parte_montaje_id` |

## 2. Pantallas

| Pantalla | Contenido |
|---|---|
| **Escanear QR** | Cámara a pantalla completa con un marco guía (usa `BarcodeDetector` y, si no está disponible, jsQR). Abre la ficha de la pieza. Si la etiqueta no se lee, se puede escribir la marca. |
| **Ficha de pieza** | Anillo de progreso, botón grande **«Completar ‹fase actual›»**, QR imprimible, recorrido por fases (unidades completadas en cada una), fechas, **historial completo** (quién, cuándo, desde dónde) y fotos. |
| **Etiquetas QR** | Hoja imprimible con marca, obra, perfil, plano, cantidad y peso. Para papel adhesivo. |
| **Control del taller** | Horas del día: chips de trabajador (un toque por persona), horas en un toque (4/6/8/9/10), obra y operación. Muestra la producción del día por fase y el rendimiento en kg/h. |
| **Montaje** | Por obra: barras de fabricado, expedido y montado; toneladas en taller sin expedir y en obra sin montar; comparativa pieza a pieza; últimos partes. |
| **Control en obra** (móvil) | Parte diario en bloques plegables: piezas montadas, recibidas, descargadas, personal y horas, medios de elevación, incidencias y clima, fotos. Un resumen fijo muestra «Montado hoy: X ud · Y t» y el botón **Guardar parte**. |
| **Personal** | Trabajadores con sección, equipo, operaciones asignadas, horas, toneladas procesadas, kg/h y coste de mano de obra (este último solo para perfiles con costes). Filtros: hoy, 7 días, 30 días y sección. |
| **Operarios y equipos** | Equipos con su rendimiento y medios de elevación con su coste por hora. |

## 3. Flujos de uso

**Desde el QR (3 toques).** Escanear (1) → «Completar ‹fase›» (2) → Confirmar (3). El movimiento queda con origen «qr», usuario, fecha, hora y, si se indica, el trabajador que lo hizo.

**Parte de montaje** (encargado, desde el móvil):
1. Elige la obra. Se recuerda para el día siguiente.
2. «Piezas montadas»: toca cada pieza o «Marcar todas». Con el selector se indican unidades parciales.
3. «Piezas recibidas»: completa la fase de expedición o recepción de esas piezas.
4. «Personal presente»: toca a cada persona; las horas se aplican a todos con un toque.
5. Medios de elevación con sus horas, incidencias, clima y fotos.
6. **Guardar parte**. En una sola transacción se registran los avances de montaje (las toneladas montadas se calculan solas), las horas de cada trabajador con su coste, los medios y las fotos.

**Horas de taller.** Jefe de taller: Control del taller → elegir trabajadores → horas → obra → Guardar. Un operario solo ve y registra sus propias horas, porque su usuario está enlazado a su ficha de trabajador.

**Fotos.** En la ficha de pieza, el parte o la obra → «Añadir foto» abre directamente la cámara trasera. Las fotos se reducen a 1.920 px antes de enviarse para ahorrar datos en obra.

**Sin conexión.** Si se pierde la cobertura, los avances se guardan en el teléfono y se envían solos al volver la red; una barra ámbar indica cuántos hay pendientes. Las pantallas ya visitadas muestran los últimos datos guardados.

## 4. Despliegue

Además de lo necesario en la etapa 1, hace falta **almacenamiento persistente**: un Volumen montado en `/data` o un bucket S3 (ver [RAILWAY.md](RAILWAY.md), paso 3). Define `PUBLIC_URL` (o un dominio fijo) antes de imprimir etiquetas QR.

## 5. Datos de ejemplo y comprobación

`npm run seed` añade 13 trabajadores, 6 equipos, 4 medios, partes de horas de 4 semanas y partes de montaje. Para comprobar la etapa 2 con la obra de prueba:

1. Entra como `montaje` / `Demo2026!` → Control en obra → **OB-PRUEBA**.
2. «Piezas montadas» lista **P-02 (2 ud)** y **V-01 (3 ud)**: son las expedidas y aún sin montar.
3. Marca solo P-02, añade a 2 montadores con 8 h y la grúa 6 h, y guarda.
4. Resultado esperado:
   - Parte: **2 ud montadas, 1,96 t**, 16 h. Rendimiento: 1.960 / 16 = **122,5 kg/h**.
   - Obra: montadas **6.960 kg** (5.000 + 1.960), es decir **33,9 %**. Toneladas únicas sin cambios: **20,52 t**.
   - «En obra sin montar» en Montaje: 10.260 − 6.960 = **3,30 t** (las 3 V-01).
   - Ficha de P-02: fecha de montaje de hoy y un movimiento «Montaje en obra · 2 ud · 1.960 kg · origen parte_montaje».
5. Como `operario`, intenta completar una fase de montaje: el servidor responde *«Tu perfil no puede registrar avances en "Montaje en obra"»*.
