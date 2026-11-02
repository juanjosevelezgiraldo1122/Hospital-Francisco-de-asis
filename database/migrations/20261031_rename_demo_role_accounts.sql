-- Renombra las cuentas demo ya existentes sin cambiar claves, roles ni correos.
-- Ejecutar sobre hospital_francisco_asis, no sobre una base vacia.
-- Los nombres son identidades de ejemplo colombianas, no personas verificadas.
--
-- Antes de ejecutar los UPDATE, confirma que la consulta previa devuelve las
-- tres cuentas demo esperadas y que los nuevos USUARIO_LOGIN no existen.

USE hospital_francisco_asis;

SELECT u.USUARIO_LOGIN, r.NOMBRE AS ROL,
       u.NOMBRE_1, u.NOMBRE_2, u.APELLIDO_1, u.APELLIDO_2
FROM hospital_francisco_asis.usuario AS u
JOIN hospital_francisco_asis.rol AS r ON r.ID_ROL = u.ID_ROL
WHERE LOWER(u.USUARIO_LOGIN) IN (
  'demo_admin_b27eeea0',
  'demo_medico_b27eeea0',
  'demo_secretaria_b27eeea0',
  'carlos.andres.martinez',
  'santiago.felipe.restrepo',
  'laura.marcela.giraldo'
)
ORDER BY u.USUARIO_LOGIN;

START TRANSACTION;

UPDATE hospital_francisco_asis.usuario AS u
JOIN hospital_francisco_asis.rol AS r ON r.ID_ROL = u.ID_ROL
SET u.USUARIO_LOGIN = 'carlos.andres.martinez',
    u.NOMBRE_1 = 'Carlos',
    u.NOMBRE_2 = 'Andrés',
    u.APELLIDO_1 = 'Martínez',
    u.APELLIDO_2 = 'Gómez'
WHERE LOWER(u.USUARIO_LOGIN) = 'demo_admin_b27eeea0'
  AND LOWER(r.NOMBRE) = 'administrador';

UPDATE hospital_francisco_asis.usuario AS u
JOIN hospital_francisco_asis.rol AS r ON r.ID_ROL = u.ID_ROL
SET u.USUARIO_LOGIN = 'santiago.felipe.restrepo',
    u.NOMBRE_1 = 'Santiago',
    u.NOMBRE_2 = 'Felipe',
    u.APELLIDO_1 = 'Restrepo',
    u.APELLIDO_2 = 'López'
WHERE LOWER(u.USUARIO_LOGIN) = 'demo_medico_b27eeea0'
  AND LOWER(r.NOMBRE) = 'medico';

UPDATE hospital_francisco_asis.usuario AS u
JOIN hospital_francisco_asis.rol AS r ON r.ID_ROL = u.ID_ROL
SET u.USUARIO_LOGIN = 'laura.marcela.giraldo',
    u.NOMBRE_1 = 'Laura',
    u.NOMBRE_2 = 'Marcela',
    u.APELLIDO_1 = 'Giraldo',
    u.APELLIDO_2 = 'Pérez'
WHERE LOWER(u.USUARIO_LOGIN) = 'demo_secretaria_b27eeea0'
  AND LOWER(r.NOMBRE) = 'secretaria';

-- Revisa que aparezcan las tres cuentas y los nombres nuevos antes de confirmar.
SELECT u.USUARIO_LOGIN, r.NOMBRE AS ROL,
       u.NOMBRE_1, u.NOMBRE_2, u.APELLIDO_1, u.APELLIDO_2
FROM hospital_francisco_asis.usuario AS u
JOIN hospital_francisco_asis.rol AS r ON r.ID_ROL = u.ID_ROL
WHERE LOWER(u.USUARIO_LOGIN) IN (
  'carlos.andres.martinez',
  'santiago.felipe.restrepo',
  'laura.marcela.giraldo'
)
ORDER BY u.USUARIO_LOGIN;

COMMIT;
