-- Cada pieza del proyecto puede asignarse a una de sus fases
ALTER TABLE piezas ADD COLUMN IF NOT EXISTS etapa_id integer REFERENCES etapas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS piezas_etapa_idx ON piezas(etapa_id);
