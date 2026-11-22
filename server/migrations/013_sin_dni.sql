-- El DNI de los empleados ya no se usa: se vacía el dato guardado
UPDATE trabajadores SET documento = '' WHERE documento <> '';
