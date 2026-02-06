# Appwrite Functions – Reconfiguración Financiera

Despliega estas 5 funciones en tu proyecto de Appwrite para que la app pueda usarlas. La app llama a `execFunction('FUNCTION_ID', payload)`, así que el **Function ID** en consola debe coincidir con el nombre indicado abajo.

## Funciones

| Function ID (usar exactamente) | Descripción | Input | Requiere auth |
|--------------------------------|-------------|--------|----------------|
| `validate_linking_code` | Valida código de vinculación de empresa | `{ p_code: string }` | No |
| `join_org_with_code` | Une al usuario a la org con el código | `{ p_code: string, p_full_name?: string }` | Sí |
| `seed_default_categories` | Crea categorías por defecto para org/usuario | `{ p_org_id: string, p_user_id: string }` | No (usa API key) |
| `seed_default_accounts` | Crea cuenta por defecto "Efectivo" para org/usuario | `{ p_org_id: string, p_user_id: string }` | No (usa API key) |
| `award_points` | Otorga puntos por evento (idempotente) | `{ p_org_id, p_user_id, p_event_key, p_ref_table?, p_ref_id? }` | No (usa API key) |

- **validate_linking_code** devuelve `{ valid: boolean, org_name: string | null }`.
- **join_org_with_code** devuelve `{}` en éxito; en error devuelve `{ error: "CODE_INVALID:..." }` u otros.
- **award_points** devuelve el número de puntos otorgados (0 si no aplica o ya otorgado).

## Despliegue en Appwrite Console

### 1. Crear cada función

Para cada carpeta (`validate_linking_code`, `join_org_with_code`, `seed_default_categories`, `seed_default_accounts`, `award_points`):

1. En **Appwrite Console** → **Functions** → **Create function**.
2. **Name**: el nombre que quieras (ej. "Validate linking code").
3. **Function ID**: debe ser **exactamente** uno de:
   - `validate_linking_code`
   - `join_org_with_code`
   - `seed_default_categories`
   - `seed_default_accounts`
   - `award_points`  
   (La app usa estos IDs en `execFunction('...', payload)`.)

### 2. Runtime y entrada

- **Runtime**: Node.js (por ejemplo 18 o 20).
- **Entrypoint**: `src/main.js` (ruta relativa a la raíz del despliegue).
- **Build command**: `npm install` (en Configuration → Build settings).

### 3. Código y dependencias

- **Importante (Git)**: si conectas el repo completo, en cada función debes configurar **Root directory** con la carpeta de esa función, por ejemplo:
  - Función `validate_linking_code` → Root directory: `appwrite-functions/validate_linking_code`
  - Función `join_org_with_code` → Root directory: `appwrite-functions/join_org_with_code`
  - Función `seed_default_categories` → Root directory: `appwrite-functions/seed_default_categories`
  - Función `seed_default_accounts` → Root directory: `appwrite-functions/seed_default_accounts`
  - Función `award_points` → Root directory: `appwrite-functions/award_points`
  Así Appwrite hará `npm install` y `npm run build` solo dentro de esa carpeta (solo se instala `node-appwrite`) y no todo el proyecto.
- Cada carpeta tiene `package.json` con `node-appwrite`, `main: "src/main.js"` y script `build` (para que el paso de build no falle).
- Opción A – **Subir ZIP**: desde la carpeta de la función (`appwrite-functions/validate_linking_code/`), ejecuta `npm install`, luego comprime `src/`, `node_modules/` y `package.json` y sube el ZIP en **Deployments**.
- Opción B – **Git**: conecta el repo; en **Root directory** indica la carpeta de la función (ej. `appwrite-functions/validate_linking_code`). Build: **Install** `npm install`, **Build** `npm run build` (o deja el que venga por defecto).

### 4. Variables de entorno

En **Settings** → **Environment variables** añade:

- `APPWRITE_DATABASE_ID` = `finaria` (o el ID de tu base de datos).

Appwrite inyecta en ejecución:

- `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_KEY` (o la key en el header `x-appwrite-key`)

Las funciones usan la API key de env o del header para acceder a Databases.

### 5. Permisos (Scopes y Execute)

En **Settings** → **Scopes** da a cada función al menos:

- **Databases**: leer y escribir (para acceder a la base `finaria` y sus colecciones).

**Execute:** La app cliente (usuario autenticado) invoca `award_points`, `seed_default_categories` y `seed_default_accounts`. En cada una de estas funciones, en **Execute** (quiénes pueden ejecutar la función), añade el rol **users** (o **any**). Si Execute está vacío, el cliente recibirá 403 y no se otorgarán puntos al completar lecciones o transacciones.

- **validate_linking_code**: debe poder ejecutarse **sin autenticación**, porque la app la llama desde la pantalla de registro (el usuario aún no tiene sesión). En **Execute** añade el rol **any** (o equivalente para invitados). Si solo está **users**, las llamadas desde signup devolverán 401 y se mostrará "Código no reconocido" aunque el código sea válido.

`join_org_with_code` debe poder ejecutarse con usuario autenticado (la app envía la sesión). Al crear un documento en **org_subscriptions**, la función asigna permiso `read("users")` para que la app pueda cargar la suscripción tras el registro. Aun así, en **Appwrite Console** la colección **org_subscriptions** debe tener **Read** para el rol **Users** (o los documentos no serán visibles para el cliente).

**Si sigue saliendo "Código no reconocido"** con un código que debería ser válido: (1) Comprueba en **Appwrite Console** → **Databases** → base `finaria` → colección **organizations** que exista un documento con el atributo `linking_code` igual exactamente al que introduces (mayúsculas/minúsculas y sin espacios). (2) Asegúrate de que la función tiene en **Scopes** permiso de **Databases** (lectura) y que la variable de entorno `APPWRITE_DATABASE_ID` está definida (o usa por defecto `finaria`).

### 6. points_rules

La función `award_points` lee la colección `points_rules`; el **document ID** debe ser la clave del evento (ej. `CREATE_EXPENSE`, `LESSON_COMPLETED`).

Para crear/actualizar esas reglas en Appwrite:

```bash
node scripts/seed-points-rules-appwrite.js
```

(Requiere `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY` en `.env` o en el entorno.)

### 7. Fallback: permisos para gamificación (si la función falla)

Si la función `award_points` no otorga puntos (por ejemplo por problemas de body o permisos), la app intenta escribir **directamente** en la base de datos. Para que esto funcione, en **Appwrite Console** → **Databases** → base `finaria`:

- **points_rules**: **Read** para `users` (para leer las reglas de puntos).
- **points_events**: **Create** y **Read** para `users`.
- **points_totals**: **Create**, **Read** y **Update** para `users`.

En cada colección: **Settings** → **Permissions** → **Create permission** → rol `users`.

## Resumen de payloads desde la app

- **validate_linking_code**: `{ p_code: "ABC123" }`
- **join_org_with_code**: `{ p_code: "ABC123", p_full_name: "Juan Pérez" }` (usuario logueado).
- **seed_default_categories**: `{ p_org_id: "...", p_user_id: "..." }`
- **seed_default_accounts**: `{ p_org_id: "...", p_user_id: "..." }`
- **award_points**: `{ p_org_id, p_user_id, p_event_key: "LESSON_COMPLETED", p_ref_table: "user_lesson_progress", p_ref_id: "5" }`
