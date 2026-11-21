-- Fases (etapas) del proyecto: cada una con nombre editable y fechas propias
CREATE TABLE etapas (
  id            serial PRIMARY KEY,
  obra_id       integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  orden         integer NOT NULL,
  nombre        text NOT NULL,
  fecha_inicio  date,
  fecha_fin     date,
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX ON etapas (obra_id, orden);
-- Las obras existentes pasan a tener una «Fase 1» con sus fechas actuales
INSERT INTO etapas (obra_id, orden, nombre, fecha_inicio, fecha_fin)
SELECT id, 1, 'Fase 1', fecha_inicio, CASE WHEN fecha_entrega >= fecha_inicio OR fecha_inicio IS NULL THEN fecha_entrega END FROM obras;

-- Medidas: kg, m² y metros lineales (sin toneladas)
ALTER TABLE obras ADD COLUMN m2_previstos numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN ml_previstos numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE piezas ADD COLUMN m2_unitario numeric(12,3) NOT NULL DEFAULT 0 CHECK (m2_unitario >= 0);
ALTER TABLE piezas ADD COLUMN ml_unitario numeric(12,3) NOT NULL DEFAULT 0 CHECK (ml_unitario >= 0);
