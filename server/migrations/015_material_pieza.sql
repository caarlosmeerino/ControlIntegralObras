-- Estado sencillo de cada pieza: material recibido, fabricada, en obra y montada
ALTER TABLE piezas ADD COLUMN IF NOT EXISTS material_recibido date;
