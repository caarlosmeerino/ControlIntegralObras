-- =====================================================================
-- ETAPA 2 · Personal, equipos, partes diarios, fotografías y montaje
-- =====================================================================

CREATE TABLE equipos (
  id         serial PRIMARY KEY,
  nombre     text NOT NULL UNIQUE,
  seccion    text NOT NULL CHECK (seccion IN ('corte','armado','soldadura','pintura','montaje','calidad','expedicion','oficina')),
  activo     boolean NOT NULL DEFAULT true,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trabajadores (
  id          serial PRIMARY KEY,
  nombre      text NOT NULL,
  documento   text NOT NULL DEFAULT '',
  telefono    text NOT NULL DEFAULT '',
  seccion     text NOT NULL CHECK (seccion IN ('corte','armado','soldadura','pintura','montaje','calidad','expedicion','oficina')),
  categoria   text NOT NULL DEFAULT 'Oficial 1ª',
  coste_hora  numeric(8,2) NOT NULL DEFAULT 0,   -- € / hora (coste empresa)
  equipo_id   integer REFERENCES equipos(id) ON DELETE SET NULL,
  usuario_id  integer UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
  activo      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Operaciones que puede realizar cada trabajador (claves de fase)
CREATE TABLE trabajador_operaciones (
  trabajador_id integer NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
  clave_fase    text NOT NULL,
  PRIMARY KEY (trabajador_id, clave_fase)
);

-- Medios de elevación y maquinaria (grúas, plataformas, carretillas...)
CREATE TABLE medios (
  id          serial PRIMARY KEY,
  nombre      text NOT NULL,
  tipo        text NOT NULL DEFAULT 'grua',
  matricula   text NOT NULL DEFAULT '',
  coste_hora  numeric(8,2) NOT NULL DEFAULT 0,
  propio      boolean NOT NULL DEFAULT true,
  activo      boolean NOT NULL DEFAULT true
);

-- Partes de horas (taller y obra): horas por trabajador, obra y sección
CREATE TABLE partes_horas (
  id             serial PRIMARY KEY,
  fecha          date NOT NULL DEFAULT current_date,
  trabajador_id  integer NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
  obra_id        integer REFERENCES obras(id) ON DELETE SET NULL,
  seccion        text NOT NULL,
  horas          numeric(5,2) NOT NULL CHECK (horas > 0 AND horas <= 24),
  operacion      text NOT NULL DEFAULT '',
  parte_montaje_id integer,
  coste          numeric(10,2) NOT NULL DEFAULT 0,  -- horas × coste_hora en el momento
  usuario_id     integer REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON partes_horas (fecha);
CREATE INDEX ON partes_horas (trabajador_id, fecha);

-- Parte diario de montaje (formulario móvil del encargado)
CREATE TABLE partes_montaje (
  id                   serial PRIMARY KEY,
  obra_id              integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  fecha                date NOT NULL DEFAULT current_date,
  encargado_id         integer REFERENCES usuarios(id) ON DELETE SET NULL,
  piezas_recibidas     integer NOT NULL DEFAULT 0,
  piezas_descargadas   integer NOT NULL DEFAULT 0,
  piezas_montadas      integer NOT NULL DEFAULT 0,
  kg_recibidos         numeric(14,2) NOT NULL DEFAULT 0,
  kg_montados          numeric(14,2) NOT NULL DEFAULT 0,
  horas_totales        numeric(7,2) NOT NULL DEFAULT 0,
  clima                text NOT NULL DEFAULT '',
  incidencias          text NOT NULL DEFAULT '',
  observaciones        text NOT NULL DEFAULT '',
  creado_en            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON partes_montaje (obra_id, fecha);

CREATE TABLE parte_montaje_medios (
  parte_id  integer NOT NULL REFERENCES partes_montaje(id) ON DELETE CASCADE,
  medio_id  integer NOT NULL REFERENCES medios(id) ON DELETE CASCADE,
  horas     numeric(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (parte_id, medio_id)
);

ALTER TABLE partes_horas
  ADD CONSTRAINT partes_horas_parte_fk FOREIGN KEY (parte_montaje_id) REFERENCES partes_montaje(id) ON DELETE CASCADE;

-- Trazabilidad extra en movimientos
ALTER TABLE movimientos ADD COLUMN trabajador_id integer REFERENCES trabajadores(id) ON DELETE SET NULL;
ALTER TABLE movimientos ADD COLUMN parte_montaje_id integer REFERENCES partes_montaje(id) ON DELETE SET NULL;
CREATE INDEX ON movimientos (trabajador_id, fecha);

-- Archivos (fotos, planos, documentación). El binario vive en el
-- almacenamiento externo (volumen o S3); aquí solo la referencia.
CREATE TABLE archivos (
  id           serial PRIMARY KEY,
  entidad      text NOT NULL CHECK (entidad IN ('obra','pieza','parte_montaje','informe','backup')),
  entidad_id   integer,
  obra_id      integer REFERENCES obras(id) ON DELETE CASCADE,
  tipo         text NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto','plano','documento','informe','backup')),
  nombre       text NOT NULL,
  mime         text NOT NULL,
  tamano       integer NOT NULL,
  clave        text NOT NULL UNIQUE,   -- ruta/clave en el almacenamiento
  descripcion  text NOT NULL DEFAULT '',
  usuario_id   integer REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON archivos (entidad, entidad_id);
CREATE INDEX ON archivos (obra_id);
