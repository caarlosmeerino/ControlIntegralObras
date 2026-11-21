// Comprueba los cálculos de toneladas con la obra de prueba (P-01, P-02, V-01, V-02, C-01).
// Usa la base de datos de DATABASE_URL (crea y elimina la obra TEST-TON):  npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, tx } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { crearFasesPorDefecto, completarHasta, registrarAvance, resumenObra, piezasConEstado } from '../server/services/produccion.js';

const admin = { id: null, rol: 'admin' };
const db = { query: (t, p) => pool.query(t, p) };
let obraId;

test('preparar obra de prueba', async () => {
  await migrate({ log: () => {} });
  await pool.query("DELETE FROM obras WHERE codigo='TEST-TON'");
  await tx(async (c) => {
    const { rows: [o] } = await c.query(`INSERT INTO obras (codigo,nombre,kg_previstos_fab,kg_previstos_montaje) VALUES ('TEST-TON','Test',20520,20520) RETURNING id`);
    obraId = o.id;
    await crearFasesPorDefecto(c, o.id);
    const { rows: F } = await c.query('SELECT id, clave FROM obra_fases WHERE obra_id=$1', [o.id]);
    const fase = (k) => F.find((f) => f.clave === k).id;
    const pasos = [['P-01', 1250, 4, 'montaje'], ['P-02', 980, 2, 'expedicion'], ['V-01', 1100, 6, 'pintura'], ['V-01', 1100, 6, 'expedicion', 3], ['V-02', 640, 4, 'armado'], ['C-01', 2200, 2, 'corte']];
    for (const [m, peso, n, hasta, ud] of pasos) {
      let { rows: [p] } = await c.query('SELECT id FROM piezas WHERE obra_id=$1 AND marca=$2', [o.id, m]);
      if (!p) p = (await c.query('INSERT INTO piezas (obra_id,marca,peso_unitario_kg,cantidad) VALUES ($1,$2,$3,$4) RETURNING id', [o.id, m, peso, n])).rows[0];
      await completarHasta(c, { piezaId: p.id, faseId: fase(hasta), unidades: ud ?? null, user: admin, checkPerm: false });
    }
  });
});

test('toneladas únicas, por fase y producción acumulada', async () => {
  const { resumen: r } = await resumenObra(db, obraId);
  assert.equal(r.kg_unicos, 20520);
  assert.deepEqual(r.fases.map((f) => f.kg_completados), [20520, 20520, 20520, 16120, 13560, 13560, 10260, 5000, 0]);
  assert.deepEqual(r.fases.map((f) => f.porcentaje), [100, 100, 100, 78.56, 66.08, 66.08, 50, 24.37, 0]);
  // La ubicación física del material suma exactamente las toneladas únicas
  assert.equal(r.fases.reduce((s, f) => s + f.kg_en_fase, 0) + r.fases.at(-1).kg_completados, 20520);
  // La producción acumulada (Σ fases) NO es el tonelaje de la obra
  assert.equal(r.produccion_acumulada_kg, 120060);
  assert.equal(r.avance_global, 63.14);
});

test('no se puede avanzar más de lo que llega de la fase anterior', async () => {
  const [v02] = await piezasConEstado(db, "p.obra_id=$1 AND p.marca='V-02'", [obraId]);
  const id = (k) => v02.avance.find((a) => a.clave === k).fase_id;
  await assert.rejects(() => tx((c) => registrarAvance(c, { piezaId: v02.id, faseId: id('pintura'), cantidad: 1, user: admin, checkPerm: false })), /disponibles|completar/);
  await tx((c) => registrarAvance(c, { piezaId: v02.id, faseId: id('calidad'), cantidad: 2, user: admin, checkPerm: false }));
  await assert.rejects(() => tx((c) => registrarAvance(c, { piezaId: v02.id, faseId: id('calidad'), cantidad: 3, user: admin, checkPerm: false })), /Solo hay 2/);
  const { resumen: r } = await resumenObra(db, obraId);
  assert.equal(r.fases[4].kg_completados, 13560 + 1280);
});

test('permisos: un operario no puede registrar montaje', async () => {
  const [p01] = await piezasConEstado(db, "p.obra_id=$1 AND p.marca='P-01'", [obraId]);
  await assert.rejects(() => tx((c) => registrarAvance(c, { piezaId: p01.id, user: { id: null, rol: 'operario' } })), /perfil/);
});

after(async () => { await pool.query("DELETE FROM obras WHERE codigo='TEST-TON'"); await pool.end(); });
