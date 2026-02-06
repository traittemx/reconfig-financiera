# Configurar autenticación en Appwrite

La app usa **Email/Password** para login, registro y recuperación de contraseña. Sin habilitar Auth en Appwrite, el login y el signup fallarán.

## CORS: añadir el origen de la app (obligatorio en producción)

Si ves **"Access to fetch at '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header"**, el navegador bloquea las peticiones porque Appwrite no tiene registrado el dominio desde el que cargas la app.

**Qué hacer:** en la consola de Appwrite, tu proyecto → pestaña **Overview** (o **Settings**) → **Platforms** → **Add platform** → elige **Web app** → en **Hostname** pon **solo el dominio**, sin `https://` ni rutas:

| Dónde corre la app | Hostname a añadir |
|-------------------|--------------------|
| Local (desarrollo) | `localhost` |
| EAS / Expo (preview) | `finaria.expo.app` |
| Tu dominio propio | `tudominio.com` |

Puedes añadir varias plataformas (por ejemplo `localhost` y `finaria.expo.app`) para desarrollo y producción. Sin este paso, login y cualquier llamada a la API desde el navegador fallarán por CORS.

## 401 en GET /v1/account y aviso de localStorage

- **GET /v1/account 401 (Unauthorized)** al cargar la app (sin haber iniciado sesión) es **normal**: la app comprueba si hay sesión con `account.get()`; si no hay sesión, Appwrite responde 401 y la app muestra la pantalla de login. No indica un fallo de configuración.
- Si **sí** has iniciado sesión y al recargar la página sigues viendo 401 en `/v1/account`, puede ser que la sesión no se esté enviando. La app ya envía manualmente el header `X-Fallback-Cookies` (sesión en localStorage) en cada petición cuando corres en web; asegúrate de tener tu dominio (p. ej. `finaria.expo.app`) en **Platforms** en Appwrite y de que la plataforma coincida con el hostname (la app usa `window.location.hostname` automáticamente).
- El mensaje **"Appwrite is using localStorage for session management..."** es un **aviso**: para más seguridad puedes usar un dominio propio como API endpoint. No es un error ni causa el 401.

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
- **"The current user is not authorized"** o **"No se pudo cargar tu perfil"**: la sesión se crea pero la app no puede leer la colección `profiles` ni `org_subscriptions`. En Databases → finaria → cada colección → Permissions, añade el rol **Users** con **Read** (y **Create** / **Update** en `profiles`). Ver [appwrite-permissions-setup.md](./appwrite-permissions-setup.md).
- En registro, asegúrate de que la colección `profiles` existe y tiene los atributos `full_name`, `role`, `created_at`, `updated_at` (y opcionalmente `org_id`, `start_date`, `avatar_url`).
- Las Appwrite Functions `validate_linking_code` y `join_org_with_code` deben estar desplegadas para que el registro con código de vinculación funcione.
