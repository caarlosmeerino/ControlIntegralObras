-- Provincia del municipio (la ciudad se valida contra el listado oficial del INE)
ALTER TABLE obras ADD COLUMN provincia text NOT NULL DEFAULT '';
