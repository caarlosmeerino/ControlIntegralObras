-- Cada usuario tiene sus propios datos: proyectos, empleados y piezas propias
ALTER TABLE obras ADD COLUMN IF NOT EXISTS propietario_id integer REFERENCES usuarios(id);
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS propietario_id integer REFERENCES usuarios(id);
ALTER TABLE catalogo_piezas ADD COLUMN IF NOT EXISTS propietario_id integer REFERENCES usuarios(id);

-- Lo que ya existe pasa al primer administrador
UPDATE obras SET propietario_id = (SELECT id FROM usuarios WHERE rol='admin' ORDER BY id LIMIT 1) WHERE propietario_id IS NULL;
UPDATE trabajadores SET propietario_id = (SELECT id FROM usuarios WHERE rol='admin' ORDER BY id LIMIT 1) WHERE propietario_id IS NULL;
UPDATE catalogo_piezas SET propietario_id = (SELECT id FROM usuarios WHERE rol='admin' ORDER BY id LIMIT 1) WHERE personalizada AND propietario_id IS NULL;

CREATE INDEX IF NOT EXISTS obras_propietario_idx ON obras(propietario_id);
CREATE INDEX IF NOT EXISTS trabajadores_propietario_idx ON trabajadores(propietario_id);

-- El código de proyecto y el nombre de pieza propia solo tienen que ser únicos dentro de cada usuario
ALTER TABLE obras DROP CONSTRAINT IF EXISTS obras_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS obras_propietario_codigo_key ON obras(propietario_id, codigo);
ALTER TABLE catalogo_piezas DROP CONSTRAINT IF EXISTS catalogo_piezas_familia_designacion_key;
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_normalizadas_key ON catalogo_piezas(familia, designacion) WHERE NOT personalizada;
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_propias_key ON catalogo_piezas(propietario_id, familia, designacion) WHERE personalizada;

-- Perfiles simplificados: Administrador o Usuario
UPDATE usuarios SET rol='director' WHERE rol NOT IN ('admin','director');
