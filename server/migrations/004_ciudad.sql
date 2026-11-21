-- Simplificación: ciudad de la obra (para buscar y agrupar por cliente / ciudad)
ALTER TABLE obras ADD COLUMN ciudad text NOT NULL DEFAULT '';
CREATE INDEX ON obras (lower(cliente));
-- Rellenar la ciudad a partir del último tramo de la dirección en obras existentes
UPDATE obras SET ciudad = trim(split_part(direccion, ',', array_length(string_to_array(direccion, ','), 1))) WHERE ciudad = '' AND direccion LIKE '%,%';
