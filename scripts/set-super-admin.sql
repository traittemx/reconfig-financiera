-- Asignar rol SUPER_ADMIN a un usuario por email.
-- Ejecutar en Supabase SQL Editor después de que el usuario se haya registrado en la app.
--
-- Opción 1: UPDATE directo (reemplaza TU_EMAIL@ejemplo.com por el email real)
UPDATE profiles
SET role = 'SUPER_ADMIN'
WHERE id = (SELECT id FROM auth.users WHERE email = 'TU_EMAIL@ejemplo.com');

-- Opción 2: Si aplicaste la migración 003_super_admin_lessons.sql, puedes usar la función
-- set_first_super_admin() solo para el PRIMER super admin (no hace nada si ya existe uno):
-- SELECT set_first_super_admin('TU_EMAIL@ejemplo.com');
