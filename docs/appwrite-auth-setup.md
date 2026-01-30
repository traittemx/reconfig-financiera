# Configurar autenticación en Appwrite

La app usa **Email/Password** para login, registro y recuperación de contraseña. Sin habilitar Auth en Appwrite, el login y el signup fallarán.

## Pasos en Appwrite Console

1. Entra a tu proyecto en [Appwrite Console](https://cloud.appwrite.io).
2. En el menú lateral, ve a **Auth** → **Settings** (o **Overview** → **Auth**).
3. En **Auth Methods**, activa **Email/Password**:
   - **Email/Password**: ON
   - Opcional: deja **Email verification** en OFF si no quieres verificar correo al registrarse (la app no implementa pantalla de verificación por ahora).
4. **Password recovery** (recuperar contraseña):
   - La app llama a `account.createRecovery(email, url)`.
   - Appwrite envía un correo con un enlace; el usuario restablece la contraseña y es redirigido a la `url` que pasaste (en la app es la pantalla de login).
   - No hace falta configurar nada extra en Console para que funcione el envío del correo; asegúrate de tener configurado el **SMTP** del proyecto si usas self-hosted, o usa el de Appwrite Cloud.

## Resumen de flujos en la app

| Acción | Uso en la app |
|--------|----------------|
| **Login** | `account.createEmailPasswordSession(email, password)` → luego se carga perfil y suscripción desde Databases. |
| **Registro** | `account.create(userId, email, password, name)` → sesión → crear documento en `profiles` → llamar Function `join_org_with_code` → cargar perfil. |
| **Cerrar sesión** | `account.deleteSessions()` → redirección a login. |
| **Recuperar contraseña** | `account.createRecovery(email, redirectUrl)` → el usuario recibe el correo y restablece la contraseña; al final se redirige a login. |

## Si el login o signup fallan

- Comprueba que **Email/Password** está habilitado en Auth → Settings.
- Comprueba que las variables `EXPO_PUBLIC_APPWRITE_ENDPOINT` y `EXPO_PUBLIC_APPWRITE_PROJECT_ID` están definidas (por ejemplo en `.env`).
- En registro, asegúrate de que la colección `profiles` existe y tiene los atributos `full_name`, `role`, `created_at`, `updated_at` (y opcionalmente `org_id`, `start_date`, `avatar_url`).
- Las Appwrite Functions `validate_linking_code` y `join_org_with_code` deben estar desplegadas para que el registro con código de vinculación funcione.
