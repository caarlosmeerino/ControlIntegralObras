-- =====================================================================
-- ETAPA 3 · Costes, presupuestos, rendimientos e informes automáticos
-- =====================================================================

-- Partidas de presupuesto por obra y categoría
CREATE TABLE presupuesto_partidas (
  id         serial PRIMARY KEY,
  obra_id    integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  categoria  text NOT NULL CHECK (categoria IN ('material','mano_obra','pintura','transporte','elevacion','subcontrata','otros')),
  concepto   text NOT NULL DEFAULT '',
  importe    numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE (obra_id, categoria, concepto)
);

-- Costes reales imputados (la mano de obra y los medios se calculan
-- automáticamente desde partes de horas y partes de montaje)
CREATE TABLE costes (
  id          serial PRIMARY KEY,
  obra_id     integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  fecha       date NOT NULL DEFAULT current_date,
  categoria   text NOT NULL CHECK (categoria IN ('material','mano_obra','pintura','transporte','elevacion','subcontrata','otros')),
  concepto    text NOT NULL,
  proveedor   text NOT NULL DEFAULT '',
  documento   text NOT NULL DEFAULT '',     -- nº factura / albarán
  importe     numeric(14,2) NOT NULL,
  usuario_id  integer REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON costes (obra_id, fecha);

-- Programación de informes automáticos
CREATE TABLE informes_programados (
  id           serial PRIMARY KEY,
  nombre       text NOT NULL,
  tipo         text NOT NULL,         -- produccion, obras, rendimiento, costes, comparativa
  frecuencia   text NOT NULL CHECK (frecuencia IN ('diaria','semanal','mensual')),
  formato      text NOT NULL DEFAULT 'pdf' CHECK (formato IN ('pdf','xlsx')),
  activo       boolean NOT NULL DEFAULT true,
  ultimo_envio timestamptz,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO informes_programados (nombre, tipo, frecuencia, formato) VALUES
 ('Producción diaria', 'produccion', 'diaria', 'pdf'),
 ('Resumen semanal de obras', 'obras', 'semanal', 'pdf'),
 ('Rendimientos y costes del mes', 'costes', 'mensual', 'xlsx');
