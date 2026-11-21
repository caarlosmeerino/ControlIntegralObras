# Etapa 3: costes, presupuestos, rendimientos e informes automáticos

## 1. Estructura de la base de datos (`server/migrations/003_etapa3.sql`)

| Tabla | Para qué sirve | Campos clave |
|---|---|---|
| `presupuesto_partidas` | Presupuesto de coste por partida | `obra_id`, `categoria` (material, mano_obra, pintura, transporte, elevacion, subcontrata, otros), `importe` |
| `costes` | Costes reales imputados: facturas y albaranes | `obra_id`, `fecha`, `categoria`, `concepto`, `proveedor`, `documento`, `importe` |
| `informes_programados` | Informes que se generan solos | `nombre`, `tipo`, `frecuencia` (diaria/semanal/mensual), `formato` (pdf/xlsx), `activo`, `ultimo_envio` |

La mano de obra **no se teclea**: sale de `partes_horas.coste`, que es horas × €/h del trabajador en ese día. Los medios de elevación también salen de los partes de montaje (horas × €/h del medio). Así el coste real de una obra es:

```
coste real        = Σ costes (facturas) + Σ partes_horas.coste + Σ horas de medios × €/h
€/t fabricada     = coste real / toneladas fabricadas (liberadas por calidad)
€/t previsto      = presupuesto de coste / toneladas previstas de fabricación
precio venta €/t  = presupuesto de venta / toneladas contratadas
% consumido       = coste real / presupuesto de coste   → compárese con el % de avance
rendimiento       = kg procesados por el trabajador / horas trabajadas  (kg/h)
€/t de un equipo  = coste de mano de obra / toneladas procesadas
```

## 2. Pantallas

| Pantalla | Contenido |
|---|---|
| **Obra → Costes** | KPI de presupuesto, coste real, €/t fabricada frente a prevista y horas; barras de real frente a previsto por partida (verde, ámbar si pasa del 85 %, rojo si pasa del 100 %); lista de costes; editor del presupuesto por partidas. |
| **Toneladas y rendimientos** | Periodo (7, 30 o 90 días, 12 meses), agrupación por día, semana o mes, y filtro por sección (corte, armado, soldadura, pintura, montaje). KPI de horas, t procesadas, kg/h y coste de mano de obra; gráfico temporal; kg/h por sección; tablas por trabajador y por equipo; €/t por obra con el semáforo «consumido / avance». |
| **Informes** | 8 informes con vista previa en pantalla y descarga en **PDF** o **Excel**: producción diaria (kg y t), producción por obra y fase, toneladas pendientes de fabricar y de montar, rendimiento por trabajador, rendimiento por equipo, retrasos respecto al calendario, costes y €/t, y comparativa entre fabricación y montaje. |
| **Informes automáticos** | Se activan o desactivan con un toque, se pueden generar al momento y queda la lista de los ya generados para descargar. |
| **Copias y sistema** | Tamaño de la base de datos, copias de seguridad (manual y automática), registro de cambios. |

Los importes solo los ven los perfiles con `costes.ver`. El servidor quita los campos de coste de las respuestas para el resto de perfiles.

## 3. Flujos de uso

- **Presupuesto.** Obra → Costes → «Editar presupuesto» → importe por partida → Guardar.
- **Imputar una factura.** Obra → Costes → «Añadir coste» → partida, concepto, proveedor, nº de factura e importe.
- **Revisar desviaciones.** Toneladas y rendimientos → tabla «Coste por tonelada por obra». En rojo aparecen las obras con un % consumido superior al % de avance más 5 puntos.
- **Exportar.** Informes → elegir informe → filtros → PDF o Excel. El Excel lleva números reales (no texto), cabecera fija y formato de miles.
- **Informes automáticos.** Cada día a las 06:00 (`REPORTS_CRON`) se generan los diarios; los semanales, los lunes, y los mensuales, el día 1. Se guardan en el almacenamiento y quedan disponibles en Informes.
- **Copias.** Cada día a las 02:30 (`BACKUP_CRON`), con rotación de `BACKUP_KEEP` copias.

## 4. Despliegue

No necesita servicios nuevos. Variables opcionales: `REPORTS_CRON`, `BACKUP_CRON`, `BACKUP_KEEP` y `TZ=Europe/Madrid`. Ver [RAILWAY.md](RAILWAY.md).

## 5. Datos de ejemplo y comprobación

Con la obra de prueba (`npm run seed -- --prueba`, presupuesto de venta 61.560 €):

1. Obra OB-PRUEBA → Costes → «Editar presupuesto»: material 30.000 €, mano de obra 12.000 €, pintura 4.000 €. **Presupuesto de coste: 46.000 €.**
   - €/t previsto = 46.000 / 20,52 t = **2.241,72 €/t**.
   - Precio de venta = 61.560 / 21,00 t contratadas = **2.931,43 €/t**.
2. «Añadir coste»: material «Perfiles HEB/IPE», 22.000 €.
3. Control del taller: registra 8 h a *Rafael Sánchez* (25 €/h) y a *Sergio López* (28 €/h) en OB-PRUEBA. Mano de obra = 8 × 25 + 8 × 28 = **424 €**.
4. Resultado esperado en Costes:
   - Coste real = 22.000 + 424 = **22.424 €** → % consumido = 22.424 / 46.000 = **48,7 %**, frente a un avance del 63,1 %: la obra va bien (verde).
   - €/t fabricada = 22.424 / 13,56 t = **1.653,69 €/t**.
5. Informes → «Costes y coste por tonelada» → PDF: OB-PRUEBA aparece con esas cifras.
6. Toneladas y rendimientos → «Hoy», sección Armado: Rafael Sánchez con 8 h. Si además registra avances firmados con su nombre (por ejemplo, completar V-02 en calidad, 4 × 640 = 2.560 kg), su rendimiento será 2.560 / 8 = **320 kg/h** y 200 € / 2,56 t = **78,13 €/t**.
