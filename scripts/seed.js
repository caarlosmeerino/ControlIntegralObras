// Datos de ejemplo.
//   npm run seed              → obra de prueba + datos de demostración
//   npm run seed -- --prueba  → solo la obra de prueba (P-01, P-02, V-01, V-02, C-01)
//   npm run seed -- --reset   → BORRA todos los datos y vuelve a cargar
import bcrypt from 'bcryptjs';
import { pool, tx } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { crearFasesPorDefecto, completarHasta, hoy } from '../server/services/produccion.js';

const args = process.argv.slice(2);
const soloPrueba = args.includes('--prueba');
const reset = args.includes('--reset');
const PASS = process.env.SEED_PASSWORD || 'Demo2026!';

const diasAtras = (n, h = 9) => { const d = new Date(hoy() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); d.setUTCHours(h, 15); return d.toISOString(); };
const fecha = (n) => diasAtras(n).slice(0, 10);
const enDias = (n) => { const d = new Date(hoy() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function main() {
  await migrate({ log: () => {} });
  if (reset) {
    await pool.query(`TRUNCATE obras, piezas, movimientos, historial, partes_horas, partes_montaje, trabajadores, equipos, medios, archivos, costes, presupuesto_partidas RESTART IDENTITY CASCADE`);
    await pool.query(`DELETE FROM usuarios WHERE username <> $1`, [process.env.ADMIN_USERNAME || 'admin']);
    console.log('· Datos borrados');
  }
  const existe = (await pool.query(`SELECT 1 FROM obras WHERE codigo='OB-PRUEBA'`)).rowCount;
  if (existe) { console.log('La obra OB-PRUEBA ya existe. Usa --reset para recargar.'); return; }

  await tx(async (db) => {
    // ---------- Usuarios (uno por perfil) ----------
    const hash = await bcrypt.hash(PASS, 10);
    const usuarios = [
      ['director', 'Laura Gómez', 'director'], ['taller', 'Miguel Ángel Ruiz', 'jefe_taller'], ['montaje', 'Javier Ortega', 'encargado_montaje'],
      ['operario', 'Antonio Pérez', 'operario'], ['oficina', 'Carmen Navarro', 'administracion'],
    ];
    const U = {};
    for (const [u, n, r] of usuarios) {
      const { rows: [x] } = await db.query(`INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1,$2,$3,$4)
        ON CONFLICT (username) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id`, [u, hash, n, r]);
      U[u] = { id: x.id, rol: r };
    }
    const sys = { id: U.director.id, rol: 'admin' };

    // ---------- OBRA DE PRUEBA (comprobación de cálculos) ----------
    const { rows: [ob] } = await db.query(
      `INSERT INTO obras (codigo, nombre, cliente, direccion, responsable_id, fecha_inicio, fecha_entrega, kg_contratados, kg_previstos_fab, kg_previstos_montaje, presupuesto, estado)
       VALUES ('OB-PRUEBA','Nave de prueba · cálculo de toneladas','Cliente de Prueba S.L.','Polígono Industrial Norte, parcela 12, Zaragoza',$1,$2,$3,21000,20520,20520,61560,'en_curso') RETURNING id`,
      [U.director.id, fecha(40), enDias(30)]);
    await crearFasesPorDefecto(db, ob.id);
    const { rows: F } = await db.query('SELECT id, clave FROM obra_fases WHERE obra_id=$1 ORDER BY orden', [ob.id]);
    const fase = (c) => F.find((f) => f.clave === c).id;
    const piezasPrueba = [
      // marca, elemento, perfil, plano, peso unitario, cantidad, hasta fase, unidades
      ['P-01', 'pilar', 'HEB-300', 'E-101', 1250, 4, 'montaje', null],
      ['P-02', 'pilar', 'HEB-260', 'E-101', 980, 2, 'expedicion', null],
      ['V-01', 'viga', 'IPE-400', 'E-102', 1100, 6, 'pintura', null],
      ['V-02', 'viga', 'IPE-300', 'E-102', 640, 4, 'armado', null],
      ['C-01', 'cercha', 'Tubo 120.80.6', 'E-103', 2200, 2, 'corte', null],
    ];
    for (const [i, [marca, el, perfil, plano, peso, cant, hasta]] of piezasPrueba.entries()) {
      const { rows: [p] } = await db.query(`INSERT INTO piezas (obra_id, marca, elemento, perfil, plano, peso_unitario_kg, cantidad) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [ob.id, marca, el, perfil, plano, peso, cant]);
      await completarHasta(db, { piezaId: p.id, faseId: fase(hasta), user: sys, origen: 'importacion', fecha: diasAtras(10 - i), checkPerm: false });
      if (marca === 'V-01') {
        // 3 de las 6 vigas V-01 ya han salido de taller (avance parcial)
        await completarHasta(db, { piezaId: p.id, faseId: fase('expedicion'), unidades: 3, user: sys, origen: 'importacion', fecha: diasAtras(2), checkPerm: false });
      }
    }
    await db.query(`UPDATE obra_fases SET fecha_inicio_prevista=$2, fecha_fin_prevista=$3 WHERE obra_id=$1`, [ob.id, fecha(40), enDias(30)]);
    console.log('· Obra de prueba OB-PRUEBA creada (5 marcas, 18 unidades, 20.520 kg)');
    if (soloPrueba) return;

    // ---------- Personal, equipos y medios ----------
    const eq = {};
    for (const [n, s] of [['Corte 1', 'corte'], ['Armado A', 'armado'], ['Soldadura A', 'soldadura'], ['Pintura', 'pintura'], ['Cuadrilla montaje 1', 'montaje'], ['Cuadrilla montaje 2', 'montaje']]) {
      eq[n] = (await db.query('INSERT INTO equipos (nombre, seccion) VALUES ($1,$2) RETURNING id', [n, s])).rows[0].id;
    }
    const trab = [
      ['Antonio Pérez', 'corte', 'Oficial 1ª', 24, 'Corte 1', ['corte'], U.operario.id], ['Luis Martín', 'corte', 'Oficial 2ª', 21, 'Corte 1', ['corte'], null],
      ['Rafael Sánchez', 'armado', 'Oficial 1ª', 25, 'Armado A', ['armado'], null], ['Pedro Jiménez', 'armado', 'Oficial 1ª', 25, 'Armado A', ['armado', 'calidad'], null],
      ['Sergio López', 'soldadura', 'Soldador homologado', 28, 'Soldadura A', ['armado'], null], ['David Moreno', 'soldadura', 'Soldador homologado', 28, 'Soldadura A', ['armado'], null],
      ['Iván Romero', 'pintura', 'Pintor industrial', 22, 'Pintura', ['pintura'], null], ['Óscar Gil', 'pintura', 'Peón especialista', 19, 'Pintura', ['pintura', 'expedicion'], null],
      ['Javier Ortega', 'montaje', 'Encargado', 30, 'Cuadrilla montaje 1', ['montaje'], U.montaje.id], ['Raúl Castro', 'montaje', 'Montador', 26, 'Cuadrilla montaje 1', ['montaje'], null],
      ['Marcos Vidal', 'montaje', 'Montador', 26, 'Cuadrilla montaje 1', ['montaje'], null], ['Jorge Serrano', 'montaje', 'Montador', 26, 'Cuadrilla montaje 2', ['montaje'], null],
      ['Elena Prieto', 'calidad', 'Inspectora de calidad', 27, null, ['calidad'], null],
    ];
    const T = {};
    for (const [n, s, c, ch, e, ops, uid] of trab) {
      const { rows: [t] } = await db.query(`INSERT INTO trabajadores (nombre, seccion, categoria, coste_hora, equipo_id, usuario_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [n, s, c, ch, e ? eq[e] : null, uid]);
      T[n] = { id: t.id, seccion: s, coste: ch, ops };
      for (const o of ops) await db.query('INSERT INTO trabajador_operaciones VALUES ($1,$2)', [t.id, o]);
    }
    const M = {};
    for (const [n, tipo, mat, ch, propio] of [['Grúa autopropulsada 50 t', 'grua', '1234-KLM', 95, false], ['Plataforma elevadora 16 m', 'plataforma', 'PL-16', 18, true],
      ['Camión grúa 25 t·m', 'camion_grua', '5678-JNB', 55, true], ['Carretilla elevadora 5 t', 'carretilla', 'CE-05', 12, true]]) {
      M[n] = (await db.query('INSERT INTO medios (nombre, tipo, matricula, coste_hora, propio) VALUES ($1,$2,$3,$4,$5) RETURNING id', [n, tipo, mat, ch, propio])).rows[0].id;
    }

    // ---------- Obras de demostración ----------
    const demo = [
      { codigo: 'OB-2026-014', nombre: 'Nave logística Plaza 3', cliente: 'Logística Ebro S.A.', dir: 'Av. Diagonal Plaza 21, Zaragoza', ini: 55, fin: 25, kg: 148000, pres: 412000, n: 46, avance: 0.72 },
      { codigo: 'OB-2026-021', nombre: 'Marquesina aparcamiento hospital', cliente: 'Constructora Aragonesa', dir: 'C/ San Juan Bosco 15, Zaragoza', ini: 35, fin: -4, kg: 38500, pres: 118000, n: 18, avance: 0.9, retraso: true },
      { codigo: 'OB-2026-027', nombre: 'Ampliación planta agroalimentaria', cliente: 'Conservas del Valle', dir: 'Ctra. Logroño km 12, Utebo', ini: 12, fin: 75, kg: 96200, pres: 265000, n: 34, avance: 0.25 },
    ];
    const claves = ['ingenieria', 'compras', 'corte', 'armado', 'calidad', 'pintura', 'expedicion', 'montaje', 'entrega'];
    const operador = { corte: 'Antonio Pérez', armado: 'Sergio López', calidad: 'Elena Prieto', pintura: 'Iván Romero', expedicion: 'Óscar Gil', montaje: 'Raúl Castro' };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const d of demo) {
      const { rows: [o] } = await db.query(
        `INSERT INTO obras (codigo, nombre, cliente, direccion, responsable_id, fecha_inicio, fecha_entrega, kg_contratados, kg_previstos_fab, kg_previstos_montaje, presupuesto, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,'en_curso') RETURNING id`,
        [d.codigo, d.nombre, d.cliente, d.dir, U.director.id, fecha(d.ini), enDias(d.fin), Math.round(d.kg * 1.03), d.kg, d.pres]);
      await crearFasesPorDefecto(db, o.id);
      const { rows: FF } = await db.query('SELECT id, clave FROM obra_fases WHERE obra_id=$1 ORDER BY orden', [o.id]);
      // calendario por fases
      const dur = d.ini + d.fin;
      const ventanas = { ingenieria: [0, 0.15], compras: [0.08, 0.3], corte: [0.2, 0.5], armado: [0.3, 0.65], calidad: [0.35, 0.7], pintura: [0.4, 0.75], expedicion: [0.45, 0.82], montaje: [0.5, 0.95], entrega: [0.9, 1] };
      for (const f of FF) {
        const [a, b] = ventanas[f.clave];
        const fi = new Date(fecha(d.ini) + 'T12:00:00Z'); fi.setUTCDate(fi.getUTCDate() + Math.round(dur * a));
        const ff = new Date(fecha(d.ini) + 'T12:00:00Z'); ff.setUTCDate(ff.getUTCDate() + Math.round(dur * b));
        await db.query('UPDATE obra_fases SET fecha_inicio_prevista=$1, fecha_fin_prevista=$2 WHERE id=$3', [fi.toISOString().slice(0, 10), ff.toISOString().slice(0, 10), f.id]);
      }
      // piezas que suman ≈ kg previstos
      const tipos = [['P', 'pilar', ['HEB-300', 'HEB-260', 'HEA-240']], ['V', 'viga', ['IPE-400', 'IPE-360', 'IPE-300']], ['C', 'cercha', ['Tubo 150.100.6']], ['CO', 'correa', ['ZF-200.2,5']], ['A', 'arriostramiento', ['L-80.8', 'Redondo Ø20']]];
      const pesos = Array.from({ length: d.n }, () => 0.3 + rnd());
      const sumP = pesos.reduce((s, x) => s + x, 0);
      let resto = d.kg;
      for (let i = 0; i < d.n; i++) {
        const [pre, el, perfiles] = tipos[i % tipos.length];
        const cant = [1, 2, 2, 4, 6, 8][Math.floor(rnd() * 6)];
        let total = i === d.n - 1 ? resto : Math.round((d.kg * pesos[i]) / sumP);
        resto -= total;
        const pu = Math.round((total / cant) * 100) / 100;
        const { rows: [p] } = await db.query(`INSERT INTO piezas (obra_id, marca, elemento, perfil, plano, peso_unitario_kg, cantidad, incidencia, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [o.id, `${pre}-${String(Math.floor(i / tipos.length) + 1).padStart(2, '0')}`, el, perfiles[i % perfiles.length], `E-${100 + (i % 6)}`, pu, cant,
            i === 5 && d.codigo === 'OB-2026-014', i === 5 && d.codigo === 'OB-2026-014' ? 'Placa base con taladros desplazados. Pendiente de corrección.' : '']);
        // avance escalonado en el tiempo (genera historial de producción)
        const nivel = Math.max(0, Math.min(claves.length - 1, Math.floor((d.avance + (rnd() - 0.5) * 0.6) * claves.length)));
        for (let k = 0; k <= nivel; k++) {
          const dia = Math.max(0, Math.round(d.ini - (d.ini * (k + 1)) / (nivel + 2) - rnd() * 3));
          const c = claves[k];
          const tr = operador[c] ? T[operador[c]].id : null;
          await completarHasta(db, { piezaId: p.id, faseId: FF[k].id, user: sys, origen: 'web', fecha: diasAtras(Math.min(dia, 29), 8 + Math.floor(rnd() * 9)), trabajadorId: tr, checkPerm: false });
        }
      }
      // costes y presupuesto
      const partidas = { material: 0.48, mano_obra: 0.22, pintura: 0.08, transporte: 0.04, elevacion: 0.07, subcontrata: 0.05, otros: 0.02 };
      for (const [cat, f] of Object.entries(partidas)) await db.query(`INSERT INTO presupuesto_partidas (obra_id, categoria, concepto, importe) VALUES ($1,$2,'',$3)`, [o.id, cat, Math.round(d.pres * 0.86 * f)]);
      await db.query(`INSERT INTO costes (obra_id, fecha, categoria, concepto, proveedor, documento, importe, usuario_id) VALUES
        ($1,$2,'material','Perfiles laminados HEB/IPE','Aceros del Norte S.A.','FAC-2026-0412',$3,$6),
        ($1,$4,'material','Chapa S275 y tornillería','Ferretería Industrial Ebro','FAC-2026-0533',$5,$6),
        ($1,$4,'pintura','Imprimación epoxi y esmalte','Pinturas Técnicas','FAC-2026-0601',$7,$6)`,
        [o.id, fecha(d.ini - 5), Math.round(d.pres * 0.3), fecha(Math.max(1, d.ini - 15)), Math.round(d.pres * 0.08), U.oficina.id, Math.round(d.pres * 0.03)]);
      d.id = o.id;
    }

    // ---------- Partes de horas (últimos 20 días laborables) ----------
    for (let n = 1; n <= 28; n++) {
      const dia = new Date(fecha(n) + 'T12:00:00Z');
      if ([0, 6].includes(dia.getUTCDay())) continue;
      for (const [nombre, t] of Object.entries(T)) {
        if (t.seccion === 'montaje') continue;
        const h = rnd() < 0.1 ? 0 : 8;
        if (!h) continue;
        const ob2 = demo[Math.floor(rnd() * demo.length)];
        await db.query(`INSERT INTO partes_horas (fecha, trabajador_id, obra_id, seccion, horas, operacion, coste, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [fecha(n), t.id, ob2.id, t.seccion, h, `Trabajo en ${t.seccion}`, h * t.coste, U.taller.id]);
        void nombre;
      }
    }
    // ---------- Partes de montaje en la obra más avanzada ----------
    for (const n of [9, 8, 5, 4, 3, 2, 1]) {
      const dia = new Date(fecha(n) + 'T12:00:00Z');
      if ([0, 6].includes(dia.getUTCDay())) continue;
      const { rows: [pm] } = await db.query(
        `INSERT INTO partes_montaje (obra_id, fecha, encargado_id, piezas_recibidas, piezas_descargadas, piezas_montadas, kg_recibidos, kg_montados, horas_totales, clima, incidencias)
         VALUES ($1,$2,$3,$4,$4,$5,$6,$7,32,'Soleado',$8) RETURNING id`,
        [demo[0].id, fecha(n), U.montaje.id, 6, 5, 9800, 8200, n === 3 ? 'Retraso de 2 h en la llegada de la grúa.' : '']);
      for (const t of ['Javier Ortega', 'Raúl Castro', 'Marcos Vidal', 'Jorge Serrano']) {
        await db.query(`INSERT INTO partes_horas (fecha, trabajador_id, obra_id, seccion, horas, operacion, parte_montaje_id, coste, usuario_id) VALUES ($1,$2,$3,'montaje',8,'Montaje en obra',$4,$5,$6)`,
          [fecha(n), T[t].id, demo[0].id, pm.id, 8 * T[t].coste, U.montaje.id]);
      }
      await db.query('INSERT INTO parte_montaje_medios VALUES ($1,$2,6),($1,$3,8)', [pm.id, M['Grúa autopropulsada 50 t'], M['Plataforma elevadora 16 m']]);
    }
    console.log('· Datos de demostración: 3 obras, 13 trabajadores, 6 equipos, 4 medios, partes de horas y de montaje');
    console.log(`· Usuarios de ejemplo (contraseña ${PASS}): director, taller, montaje, operario, oficina`);
  });
}

main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
