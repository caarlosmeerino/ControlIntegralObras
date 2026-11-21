-- =====================================================================
-- ETAPA 1 · Obras, fases, piezas, toneladas, usuarios y permisos
-- Todas las masas se guardan en KILOGRAMOS (numeric). Las toneladas se
-- calculan siempre como kg / 1000 en consultas o en la interfaz.
-- =====================================================================

CREATE TABLE usuarios (
  id             serial PRIMARY KEY,
  username       text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  nombre         text NOT NULL,
  email          text,
  rol            text NOT NULL CHECK (rol IN ('admin','director','jefe_taller','encargado_montaje','operario','administracion')),
  activo         boolean NOT NULL DEFAULT true,
  ultimo_acceso  timestamptz,
  creado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE obras (
  id                     serial PRIMARY KEY,
  codigo                 text NOT NULL UNIQUE,
  nombre                 text NOT NULL,
  cliente                text NOT NULL DEFAULT '',
  direccion              text NOT NULL DEFAULT '',
  responsable_id         integer REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_inicio           date,
  fecha_entrega          date,
  kg_contratados         numeric(14,2) NOT NULL DEFAULT 0,
  kg_previstos_fab       numeric(14,2) NOT NULL DEFAULT 0,
  kg_previstos_montaje   numeric(14,2) NOT NULL DEFAULT 0,
  presupuesto            numeric(14,2) NOT NULL DEFAULT 0,
  estado                 text NOT NULL DEFAULT 'planificada'
                         CHECK (estado IN ('planificada','en_curso','pausada','terminada','cancelada')),
  observaciones          text NOT NULL DEFAULT '',
  creado_en              timestamptz NOT NULL DEFAULT now(),
  actualizado_en         timestamptz NOT NULL DEFAULT now()
);

-- Plantilla de fases por defecto (las 9 fases de la empresa)
CREATE TABLE fases_plantilla (
  id                 serial PRIMARY KEY,
  orden              integer NOT NULL,
  clave              text NOT NULL UNIQUE,
  nombre             text NOT NULL,
  descripcion        text NOT NULL DEFAULT '',
  ambito             text NOT NULL CHECK (ambito IN ('oficina','taller','obra')),
  seccion            text,
  peso_ponderacion   numeric(6,2) NOT NULL DEFAULT 10,
  indicador          text NOT NULL   -- etiqueta del KPI: "recibidas", "cortadas"...
);

-- Fases de cada obra (copiadas de la plantilla, editables por proyecto)
CREATE TABLE obra_fases (
  id                      serial PRIMARY KEY,
  obra_id                 integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  orden                   integer NOT NULL,
  clave                   text,                -- enlaza con la plantilla (nulo en fases personalizadas)
  nombre                  text NOT NULL,
  descripcion             text NOT NULL DEFAULT '',
  ambito                  text NOT NULL CHECK (ambito IN ('oficina','taller','obra')),
  seccion                 text,
  indicador               text NOT NULL DEFAULT 'completadas',
  peso_ponderacion        numeric(6,2) NOT NULL DEFAULT 10,
  kg_previstos            numeric(14,2),       -- nulo = usar los previstos de la obra
  fecha_inicio_prevista   date,
  fecha_fin_prevista      date,
  UNIQUE (obra_id, orden)
);
CREATE INDEX ON obra_fases (obra_id);

-- Piezas (marcas). peso_unitario × cantidad = peso de la marca.
CREATE TABLE piezas (
  id                 serial PRIMARY KEY,
  obra_id            integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  marca              text NOT NULL,
  elemento           text NOT NULL DEFAULT 'otro',
  perfil             text NOT NULL DEFAULT '',
  plano              text NOT NULL DEFAULT '',
  peso_unitario_kg   numeric(12,2) NOT NULL CHECK (peso_unitario_kg >= 0),
  cantidad           integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  fecha_fabricacion  date,
  fecha_expedicion   date,
  fecha_montaje      date,
  incidencia         boolean NOT NULL DEFAULT false,
  observaciones      text NOT NULL DEFAULT '',
  qr_token           text NOT NULL UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  actualizado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, marca)
);
CREATE INDEX ON piezas (obra_id);

-- Unidades COMPLETADAS de cada pieza en cada fase.
-- Invariante (lo garantiza el servidor): completadas(fase n+1) <= completadas(fase n) <= cantidad.
CREATE TABLE pieza_avance (
  pieza_id      integer NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  obra_fase_id  integer NOT NULL REFERENCES obra_fases(id) ON DELETE CASCADE,
  cantidad      integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pieza_id, obra_fase_id)
);
CREATE INDEX ON pieza_avance (obra_fase_id);

-- Movimientos: cada cambio de fase (con fecha, hora y responsable).
-- La suma de kg de movimientos = PRODUCCIÓN ACUMULADA (no toneladas únicas).
CREATE TABLE movimientos (
  id            bigserial PRIMARY KEY,
  obra_id       integer NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  pieza_id      integer NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  obra_fase_id  integer NOT NULL REFERENCES obra_fases(id) ON DELETE CASCADE,
  cantidad      integer NOT NULL,           -- unidades (+ avance / − corrección)
  kg            numeric(14,2) NOT NULL,     -- cantidad × peso unitario en ese momento
  usuario_id    integer REFERENCES usuarios(id) ON DELETE SET NULL,
  origen        text NOT NULL DEFAULT 'web', -- web, qr, parte_montaje, lote, importacion
  nota          text NOT NULL DEFAULT '',
  fecha         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON movimientos (obra_id, fecha);
CREATE INDEX ON movimientos (pieza_id);
CREATE INDEX ON movimientos (fecha);

-- Historial genérico de cambios (trazabilidad)
CREATE TABLE historial (
  id           bigserial PRIMARY KEY,
  entidad      text NOT NULL,
  entidad_id   integer,
  obra_id      integer,
  accion       text NOT NULL,
  detalle      text NOT NULL DEFAULT '',
  datos        jsonb,
  usuario_id   integer REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON historial (entidad, entidad_id);
CREATE INDEX ON historial (obra_id, fecha);

INSERT INTO fases_plantilla (orden, clave, nombre, descripcion, ambito, seccion, peso_ponderacion, indicador) VALUES
 (1,'ingenieria','Ingeniería y preparación','Recepción y revisión de planos, despiece, listados de materiales, planos de taller y aprobación para fabricación.','oficina','oficina',5,'aprobadas'),
 (2,'compras','Compras y materiales','Compra de perfiles y chapas, recepción, control de pesos y cantidades, certificados y trazabilidad.','oficina','almacen',10,'recibidas'),
 (3,'corte','Corte y preparación','Corte de perfiles y chapas, taladros, preparación de piezas, identificación y marcado.','taller','corte',10,'cortadas'),
 (4,'armado','Armado y soldadura','Preparación de conjuntos, armado de pilares y vigas, punteado, soldadura y control dimensional.','taller','soldadura',25,'armadas y soldadas'),
 (5,'calidad','Control de calidad','Inspección visual, controles dimensionales, ensayos, corrección de defectos y liberación de piezas.','taller','calidad',5,'inspeccionadas'),
 (6,'pintura','Tratamiento y pintura','Preparación superficial, granallado, imprimación, pintura o galvanizado e inspección de acabado.','taller','pintura',10,'pintadas'),
 (7,'expedicion','Expedición y transporte','Preparación de cargas, listas de expedición, albaranes, salida de taller y recepción en obra.','taller','expedicion',5,'expedidas'),
 (8,'montaje','Montaje en obra','Replanteo, descarga, izado, colocación de pilares y vigas, atornillado, alineación y nivelación.','obra','montaje',25,'montadas'),
 (9,'entrega','Finalización y entrega','Inspección final, repasos, documentación de calidad, certificación y entrega al cliente.','obra','montaje',5,'entregadas');
