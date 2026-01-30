# Appwrite Functions – Reconfiguración Financiera

Despliega estas 4 funciones en tu proyecto de Appwrite para que la app pueda usarlas. La app llama a `execFunction('FUNCTION_ID', payload)`, así que el **Function ID** en consola debe coincidir con el nombre indicado abajo.

## Funciones

| Function ID (usar exactamente) | Descripción | Input | Requiere auth |
|--------------------------------|-------------|--------|----------------|
| `validate_linking_code` | Valida código de vinculación de empresa | `{ p_code: string }` | No |
| `join_org_with_code` | Une al usuario a la org con el código | `{ p_code: string, p_full_name?: string }` | Sí |
| `seed_default_categories` | Crea categorías por defecto para org/usuario | `{ p_org_id: string, p_user_id: string }` | No (usa API key) |
| `award_points` | Otorga puntos por evento (idempotente) | `{ p_org_id, p_user_id, p_event_key, p_ref_table?, p_ref_id? }` | No (usa API key) |

- **validate_linking_code** devuelve `{ valid: boolean, org_name: string | null }`.
- **join_org_with_code** devuelve `{}` en éxito; en error devuelve `{ error: "CODE_INVALID:..." }` u otros.
- **award_points** devuelve el número de puntos otorgados (0 si no aplica o ya otorgado).

## Despliegue en Appwrite Console

### 1. Crear cada función

Para cada carpeta (`validate_linking_code`, `join_org_with_code`, `seed_default_categories`, `award_points`):

1. En **Appwrite Console** → **Functions** → **Create function**.
2. **Name**: el nombre que quieras (ej. "Validate linking code").
3. **Function ID**: debe ser **exactamente** uno de:
   - `validate_linking_code`
   - `join_org_with_code`
   - `seed_default_categories`
   - `award_points`  
   (La app usa estos IDs en `execFunction('...', payload)`.)

### 2. Runtime y entrada

- **Runtime**: Node.js (por ejemplo 18 o 20).
- **Entrypoint**: `src/main.js` (ruta relativa a la raíz del despliegue).
- **Build command**: `npm install` (en Configuration → Build settings).

### 3. Código y dependencias

- Incluye en la raíz del despliegue:
  - `src/main.js` (y el resto del código si lo tienes).
  - `package.json` con dependencia `node-appwrite` (ya hay un `package.json` en cada carpeta).
- Opción A – **Subir ZIP**: desde la carpeta de la función (`appwrite-functions/validate_linking_code/`), ejecuta `npm install`, luego comprime `src/`, `node_modules/` y `package.json` y sube el ZIP en **Deployments**.
- Opción B – **Git**: conecta un repo; en **Root directory** indica la carpeta de la función (ej. `appwrite-functions/validate_linking_code`). En Build settings, **Install command**: `npm install`.

### 4. Variables de entorno

En **Settings** → **Environment variables** añade:

- `APPWRITE_DATABASE_ID` = `finaria` (o el ID de tu base de datos).

Appwrite inyecta en ejecución:

- `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_KEY` (o la key en el header `x-appwrite-key`)

Las funciones usan la API key de env o del header para acceder a Databases.

### 5. Permisos (Scopes)

En **Settings** → **Scopes** da a cada función al menos:

- **Databases**: leer y escribir (para acceder a la base `finaria` y sus colecciones).

`join_org_with_code` debe poder ejecutarse con usuario autenticado (la app envía la sesión); el resto puede ejecutarse con la API key de la función.

### 6. points_rules

La función `award_points` lee la colección `points_rules`; el **document ID** debe ser la clave del evento (ej. `CREATE_EXPENSE`, `LESSON_COMPLETED`).

Para crear/actualizar esas reglas en Appwrite:

```bash
node scripts/seed-points-rules-appwrite.js
```

(Requiere `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY` en `.env` o en el entorno.)

## Resumen de payloads desde la app

- **validate_linking_code**: `{ p_code: "ABC123" }`
- **join_org_with_code**: `{ p_code: "ABC123", p_full_name: "Juan Pérez" }` (usuario logueado).
- **seed_default_categories**: `{ p_org_id: "...", p_user_id: "..." }`
- **award_points**: `{ p_org_id, p_user_id, p_event_key: "LESSON_COMPLETED", p_ref_table: "user_lesson_progress", p_ref_id: "5" }`
