-- Ubicación exacta de la obra (desde el buscador de direcciones) para Google Maps
ALTER TABLE obras ADD COLUMN codigo_postal text NOT NULL DEFAULT '';
ALTER TABLE obras ADD COLUMN lat double precision;
ALTER TABLE obras ADD COLUMN lng double precision;
