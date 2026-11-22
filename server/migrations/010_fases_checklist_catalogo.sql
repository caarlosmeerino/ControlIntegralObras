-- Fases del proyecto con confirmación manual de fin y checklist,
-- y registro (catálogo) de piezas de la metalurgia.

ALTER TABLE etapas ADD COLUMN completada boolean NOT NULL DEFAULT false;
ALTER TABLE etapas ADD COLUMN completada_en timestamptz;
ALTER TABLE etapas ADD COLUMN completada_por integer REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE etapas ADD COLUMN notas text NOT NULL DEFAULT '';

-- Checklist de cada fase
CREATE TABLE etapa_tareas (
  id         serial PRIMARY KEY,
  etapa_id   integer NOT NULL REFERENCES etapas(id) ON DELETE CASCADE,
  orden      integer NOT NULL DEFAULT 0,
  texto      text NOT NULL,
  hecha      boolean NOT NULL DEFAULT false,
  hecha_en   timestamptz,
  hecha_por  integer REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON etapa_tareas (etapa_id, orden);

-- Registro de piezas: perfiles normalizados y piezas propias
CREATE TABLE catalogo_piezas (
  id            serial PRIMARY KEY,
  familia       text NOT NULL,          -- clave de familia (ipe, heb, upn, l, shs, chapa, perno…)
  designacion   text NOT NULL,          -- «IPE 300», «Tubo 100x100x5», «Placa base 300x300x20»
  unidad        text NOT NULL CHECK (unidad IN ('m', 'm2', 'ud')),  -- el peso es kg por esta unidad
  peso          numeric(12,3) NOT NULL CHECK (peso >= 0),
  dimensiones   text NOT NULL DEFAULT '',
  norma         text NOT NULL DEFAULT '',
  personalizada boolean NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia, designacion)
);
CREATE INDEX ON catalogo_piezas (familia);

-- Las piezas del proyecto pueden venir del registro
ALTER TABLE piezas ADD COLUMN catalogo_id integer REFERENCES catalogo_piezas(id) ON DELETE SET NULL;
