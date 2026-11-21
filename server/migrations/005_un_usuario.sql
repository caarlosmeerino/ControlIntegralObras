-- La aplicación se usa con un único usuario (el administrador).
-- Se eliminan los usuarios de ejemplo que creaban los datos de demostración.
DELETE FROM usuarios WHERE username IN ('director', 'taller', 'montaje', 'operario', 'oficina') AND rol <> 'admin';
