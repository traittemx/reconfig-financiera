# Crear el primer usuario Super Admin

El rol **SUPER_ADMIN** se asigna en la tabla `profiles`. Los usuarios se crean con Supabase Auth (registro o login); no se puede crear un usuario solo desde SQL sin tocar Auth. Por tanto, el flujo es: **registrarse en la app** y luego **asignar el rol** una sola vez.

## Pasos

1. **Registrarse en la app**  
   Usa la pantalla de registro (signup) con el email y contraseña que quieras usar como super admin. Si el signup actual crea una organización, puedes usar una cuenta de prueba; después podrás borrar esa organización o ignorarla.

2. **Asignar el rol en Supabase**  
   En el **SQL Editor** de tu proyecto Supabase, ejecuta uno de los siguientes métodos (sustituye `tu-email@ejemplo.com` por el email real):

   **Opción A – UPDATE directo**

   ```sql
   UPDATE profiles
   SET role = 'SUPER_ADMIN'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com');
   ```

   **Opción B – Script reutilizable**  
   Copia el contenido de `scripts/set-super-admin.sql`, reemplaza `TU_EMAIL@ejemplo.com` por tu email y ejecútalo en el SQL Editor.

   **Opción C – Función de bootstrap**  
   Si aplicaste la migración `003_super_admin_lessons.sql`, existe la función `set_first_super_admin(email)`, que solo asigna SUPER_ADMIN si **aún no existe** ningún super admin (útil para el primer despliegue):

   ```sql
   SELECT set_first_super_admin('tu-email@ejemplo.com');
   ```

3. **Iniciar sesión en la app**  
   Cierra sesión si estabas logueado y vuelve a entrar con ese email. En Perfil deberías ver el botón **Super Admin** y acceder a `/superadmin`.

## Notas

- No expongas en la app un flujo que “cree” super admins desde el cliente; el flujo seguro es registro normal + este paso manual/SQL.
- Para añadir más super admins más adelante, usa el UPDATE directo (Opción A) con el nuevo email.
