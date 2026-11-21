-- Planos y documentos enlazados (iCloud Drive u otra nube): no se sube ningún archivo,
-- solo se guarda el enlace compartido.
CREATE TABLE enlaces (
  id          serial PRIMARY KEY,
  obra_id     integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('plano', 'documento')),
  nombre      text NOT NULL,
  url         text NOT NULL,
  usuario_id  integer REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON enlaces (obra_id, tipo);
