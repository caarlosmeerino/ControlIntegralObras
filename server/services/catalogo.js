// Catálogo de informes: cada uno devuelve { titulo, subtitulo, columnas, filas, totales, kpis, nota }
import * as I from './informes.js';
import { fmt } from './exportar.js';

const sumar = (filas, keys) => Object.fromEntries(keys.map((k) => [k, Math.round(filas.reduce((s, f) => s + (Number(f[k]) || 0), 0) * 100) / 100]));
const periodoTxt = (p) => `Del ${fmt.date(p.desde)} al ${fmt.date(p.hasta)}`;
const SEC = { corte: 'Corte', armado: 'Armado', soldadura: 'Soldadura', pintura: 'Pintura', montaje: 'Montaje', calidad: 'Calidad', expedicion: 'Expedición', oficina: 'Oficina' };

export const CATALOGO = {
  produccion: {
    nombre: 'Producción diaria (kg y t)', permiso: 'informes.ver',
    async generar(p) {
      const filas = await I.produccionPeriodo(p);
      const cols = ['corte', 'armado', 'calidad', 'pintura', 'expedicion', 'montaje'];
      return {
        titulo: 'Producción por periodo', subtitulo: `${periodoTxt(p)} · agrupado por ${p.agrupar}`,
        columnas: [{ key: 'periodo', label: 'Periodo', fmt: 'date' }, ...cols.map((c) => ({ key: c, label: { corte: 'Cortado', armado: 'Armado/soldado', calidad: 'Inspeccionado', pintura: 'Pintado', expedicion: 'Expedido', montaje: 'Montado' }[c], fmt: 't' })),
          { key: 'total_acumulado', label: 'Prod. acumulada', fmt: 't' }],
        filas, totales: { periodo: null, ...sumar(filas, [...cols, 'total_acumulado']) },
        nota: 'La producción acumulada suma los kilos procesados en cada fase: una misma tonelada cuenta una vez por cada fase que atraviesa. No equivale a toneladas únicas de obra.',
      };
    },
  },
  obras: {
    nombre: 'Producción por obra y fase', permiso: 'informes.ver',
    async generar(p) {
      const obras = (await I.obrasResumen()).filter((o) => !p.obraId || o.id === p.obraId);
      const filas = obras.flatMap((o) => o.resumen.fases.map((f) => ({ obra: `${o.codigo} · ${o.nombre}`, fase: `${f.orden}. ${f.nombre}`, kg_base: f.kg_base, kg_completados: f.kg_completados, kg_pendientes: f.kg_pendientes, kg_en_fase: f.kg_en_fase, porcentaje: f.porcentaje, estado: { terminado: 'Terminada', en_curso: 'En curso', retrasado: 'Retrasada', pendiente: 'Pendiente' }[f.estado], fin: f.fecha_fin_prevista })));
      return {
        titulo: 'Producción por obra y fase', subtitulo: `Situación a ${fmt.date(new Date().toISOString())}`,
        kpis: [{ label: 'Obras', valor: String(obras.length) }, { label: 'Toneladas únicas', valor: fmt.t(obras.reduce((s, o) => s + o.resumen.kg_unicos, 0)) },
          { label: 'Fabricadas', valor: fmt.t(obras.reduce((s, o) => s + o.resumen.kg_fabricados, 0)) }, { label: 'Montadas', valor: fmt.t(obras.reduce((s, o) => s + o.resumen.kg_montados, 0)) }],
        columnas: [{ key: 'obra', label: 'Obra', w: 2.4 }, { key: 'fase', label: 'Fase', w: 2 }, { key: 'kg_base', label: 'Previsto', fmt: 't' }, { key: 'kg_completados', label: 'Completado', fmt: 't' },
          { key: 'kg_pendientes', label: 'Pendiente', fmt: 't' }, { key: 'kg_en_fase', label: 'En la fase', fmt: 't' }, { key: 'porcentaje', label: '% fase', fmt: 'pct' }, { key: 'estado', label: 'Estado' }, { key: 'fin', label: 'Fin previsto', fmt: 'date' }],
        filas, nota: 'El % de cada fase se calcula con sus propias cantidades (completado / previsto de la fase). «En la fase» indica dónde está físicamente el material.',
      };
    },
  },
  pendientes: {
    nombre: 'Toneladas pendientes de fabricar y montar', permiso: 'informes.ver',
    async generar() {
      const filas = (await I.pendientes()).map((f) => ({ ...f, obra: `${f.codigo} · ${f.nombre}` }));
      return {
        titulo: 'Toneladas pendientes', subtitulo: 'Obras activas',
        columnas: [{ key: 'obra', label: 'Obra', w: 2.5 }, { key: 'fecha_entrega', label: 'Entrega', fmt: 'date' }, { key: 'kg_previstos_fab', label: 'Previsto fab.', fmt: 't' }, { key: 'kg_fabricados', label: 'Fabricado', fmt: 't' },
          { key: 'kg_pendiente_fabricar', label: 'Pte. fabricar', fmt: 't' }, { key: 'kg_previstos_montaje', label: 'Previsto montaje', fmt: 't' }, { key: 'kg_montados', label: 'Montado', fmt: 't' }, { key: 'kg_pendiente_montar', label: 'Pte. montar', fmt: 't' }],
        filas, totales: { obra: 'TOTAL', ...sumar(filas, ['kg_previstos_fab', 'kg_fabricados', 'kg_pendiente_fabricar', 'kg_previstos_montaje', 'kg_montados', 'kg_pendiente_montar']) },
      };
    },
  },
  rendimiento: {
    nombre: 'Rendimiento por trabajador', permiso: 'informes.ver',
    async generar(p) {
      const filas = (await I.rendimientoTrabajadores(p)).map((f) => ({ ...f, seccion: SEC[f.seccion] || f.seccion }));
      const tot = sumar(filas, ['horas', 'kg', 'coste', 'operaciones']);
      return {
        titulo: 'Rendimiento por trabajador', subtitulo: `${periodoTxt(p)}${p.seccion ? ` · Sección ${SEC[p.seccion]}` : ''}`,
        columnas: [{ key: 'nombre', label: 'Trabajador', w: 2 }, { key: 'seccion', label: 'Sección' }, { key: 'equipo', label: 'Equipo', w: 1.4 }, { key: 'horas', label: 'Horas', fmt: 'num' },
          { key: 'operaciones', label: 'Operaciones', fmt: 'num' }, { key: 'kg', label: 'Procesado', fmt: 't' }, { key: 'kg_hora', label: 'kg/h', fmt: 'num' }, { key: 'coste', label: 'Coste M.O.', fmt: 'eur' }, { key: 'coste_tonelada', label: '€/t', fmt: 'eur' }],
        filas, totales: { nombre: 'TOTAL', ...tot, kg_hora: tot.horas ? Math.round((tot.kg / tot.horas) * 100) / 100 : 0, coste_tonelada: tot.kg ? Math.round(tot.coste / (tot.kg / 1000) * 100) / 100 : null },
      };
    },
  },
  equipos: {
    nombre: 'Rendimiento por equipo', permiso: 'informes.ver',
    async generar(p) {
      const filas = (await I.rendimientoEquipos(p)).map((f) => ({ ...f, seccion: SEC[f.seccion] || f.seccion }));
      return {
        titulo: 'Rendimiento por equipo', subtitulo: periodoTxt(p),
        columnas: [{ key: 'equipo', label: 'Equipo', w: 2 }, { key: 'seccion', label: 'Sección' }, { key: 'personas', label: 'Personas', fmt: 'num' }, { key: 'horas', label: 'Horas', fmt: 'num' },
          { key: 'kg', label: 'Procesado', fmt: 't' }, { key: 'kg_hora', label: 'kg/h', fmt: 'num' }, { key: 'coste', label: 'Coste M.O.', fmt: 'eur' }, { key: 'coste_tonelada', label: '€/t', fmt: 'eur' }],
        filas,
      };
    },
  },
  retrasos: {
    nombre: 'Retrasos respecto al calendario', permiso: 'informes.ver',
    async generar() {
      const filas = await I.retrasos();
      return {
        titulo: 'Retrasos respecto al calendario', subtitulo: `Fases con fecha de fin prevista superada · ${filas.length} retraso(s)`,
        columnas: [{ key: 'obra', label: 'Obra', w: 2.5 }, { key: 'fase', label: 'Fase', w: 2 }, { key: 'fecha_fin_prevista', label: 'Fin previsto', fmt: 'date' }, { key: 'dias_retraso', label: 'Días de retraso', fmt: 'num' },
          { key: 'porcentaje', label: 'Avance', fmt: 'pct' }, { key: 'kg_pendientes', label: 'Pendiente', fmt: 't' }],
        filas,
      };
    },
  },
  costes: {
    nombre: 'Costes y coste por tonelada', permiso: 'costes.ver',
    async generar(p) {
      const filas = (await I.costesObras(p.obraId)).map((o) => ({ ...o, obra: `${o.codigo} · ${o.nombre}`, mo: o.categorias.mano_obra.real, mat: o.categorias.material.real }));
      return {
        titulo: 'Costes por obra y coste por tonelada', subtitulo: 'Costes reales imputados (facturas + mano de obra + medios) frente a presupuesto',
        columnas: [{ key: 'obra', label: 'Obra', w: 2.4 }, { key: 'previsto', label: 'Presupuesto', fmt: 'eur' }, { key: 'real', label: 'Coste real', fmt: 'eur' }, { key: 'consumido_pct', label: '% consumido', fmt: 'pct' },
          { key: 'avance_global', label: '% avance', fmt: 'pct' }, { key: 'mat', label: 'Material', fmt: 'eur' }, { key: 'mo', label: 'Mano obra', fmt: 'eur' }, { key: 't_fabricadas', label: 't fabricadas', fmt: 'tt' },
          { key: 'coste_t_fabricada', label: '€/t fabricada', fmt: 'eur' }, { key: 'coste_t_prevista', label: '€/t previsto', fmt: 'eur' }],
        filas, totales: { obra: 'TOTAL', ...sumar(filas, ['previsto', 'real', 'mat', 'mo', 't_fabricadas']) },
        nota: '% consumido = coste real / presupuesto. Compárelo con el % de avance: si el consumido supera al avance, la obra va por encima de coste.',
      };
    },
  },
  comparativa: {
    nombre: 'Comparativa fabricación / montaje', permiso: 'informes.ver',
    async generar() {
      const filas = (await I.comparativaFabMontaje()).map((f) => ({ ...f, obra: `${f.codigo} · ${f.nombre}` }));
      return {
        titulo: 'Comparativa entre fabricación y montaje', subtitulo: 'Obras activas',
        columnas: [{ key: 'obra', label: 'Obra', w: 2.5 }, { key: 'kg_unicos', label: 't únicas', fmt: 't' }, { key: 'kg_fabricados', label: 'Fabricado', fmt: 't' }, { key: 'kg_expedidos', label: 'Expedido', fmt: 't' },
          { key: 'kg_montados', label: 'Montado', fmt: 't' }, { key: 'kg_fabricado_sin_expedir', label: 'En taller', fmt: 't' }, { key: 'kg_en_obra_sin_montar', label: 'En obra sin montar', fmt: 't' }, { key: 'pct_montado_sobre_fabricado', label: 'Montado/fabricado', fmt: 'pct' }],
        filas, totales: { obra: 'TOTAL', ...sumar(filas, ['kg_unicos', 'kg_fabricados', 'kg_expedidos', 'kg_montados', 'kg_fabricado_sin_expedir', 'kg_en_obra_sin_montar']) },
      };
    },
  },
};
