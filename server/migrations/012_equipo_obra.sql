-- Empleados asignados a cada proyecto
CREATE TABLE IF NOT EXISTS obra_empleados (
  obra_id       integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  trabajador_id integer NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
  funcion       text NOT NULL DEFAULT '',
  creado_en     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (obra_id, trabajador_id)
);
CREATE INDEX IF NOT EXISTS obra_empleados_trab_idx ON obra_empleados(trabajador_id);
ALTER TABLE trabajadores ALTER COLUMN categoria SET DEFAULT '';
