# Configuración de permisos en Appwrite

Si ves **"The current user is not authorized to perform the requested action"** (401/403), la sesión es válida pero las colecciones no permiten la acción al rol de usuarios autenticados.

**Si ves un error de CORS** ("blocked by CORS policy: No 'Access-Control-Allow-Origin' header"), no es un tema de permisos: hay que añadir el origen de la app en Appwrite. Ver [appwrite-auth-setup.md](./appwrite-auth-setup.md) → sección "CORS: añadir el origen de la app".

## Dónde configurar

En la **consola de Appwrite**: tu proyecto → **Databases** → base de datos **finaria** → para cada colección: **Settings** (o el icono de engranaje) → **Permissions**.

## Permisos mínimos para que la app funcione

Añade estos permisos para el rol **Users** (usuarios autenticados). En la UI suele aparecer como "Users" o "Any". **Todas** las colecciones de la tabla deben tener al menos los permisos indicados; si falta una, verás 401 en esa colección.

| Colección | Permisos para "Users" | Motivo |
|-----------|------------------------|--------|
| **profiles** | **Create**, **Read**, **Update** | Login/signup y recuperación de perfil. |
| **lessons** | **Read** | Pestaña Curso. |
| **user_lesson_progress** | **Read**, **Create**, **Update** | Progreso por lección. |
| **org_subscriptions** | **Read** | Suscripción de la org al cargar perfil. Si ves "Suscripción requerida" justo después de registrarte, añade **Read** para **Users** en esta colección. |
| **org_members** | **Read** | Miembros y propio rol. |
| **organizations** | **Read** | Datos de la organización. |
| **accounts** | **Read**, **Create**, **Update**, **Delete** | Pestaña Finanzas: cuentas. |
| **transactions** | **Read**, **Create**, **Update**, **Delete** | Pestaña Finanzas: transacciones. |
| **categories** | **Read**, **Create**, **Update**, **Delete** | Pestaña Finanzas: categorías. |
| **budgets** | **Read**, **Create**, **Update**, **Delete** | Pestaña Finanzas: presupuestos. |
| **budget_items** | **Read**, **Create**, **Update**, **Delete** | Partidas de presupuesto. |
| **savings_goals** | **Read**, **Create**, **Update**, **Delete** | Metas de ahorro. |
| **physical_assets** | **Read**, **Create**, **Update**, **Delete** | Patrimonio / net worth. |
| **budget_safe_style_expenses** | **Read**, **Create**, **Update**, **Delete** | Presupuesto Seguro y Estilo (gastos informativos). |
| **income_sources** | **Read**, **Create**, **Update**, **Delete** | Fuentes de ingreso. |
| **pilot_emotional_checkins** | **Read**, **Create**, **Update** | Check-ins emocionales del piloto (Hoy). |
| **pilot_daily_recommendations** | **Read** | Recomendaciones diarias del piloto. |
| **org_pilot_aggregates** | **Read** | Agregados del piloto por org (si se usan en la app). |

Si ves **401 en `categories`**, **`transactions`** o **`accounts`**, añade en la consola para cada una: rol **Users** con **Read** (y **Create**, **Update**, **Delete** para que crear/editar funcione).

## Pasos en la consola

1. Entra en tu proyecto en [Appwrite Console](https://cloud.appwrite.io) (p. ej. `nyc.cloud.appwrite.io`).
2. **Databases** → base de datos **finaria**.
3. Para cada colección de la tabla anterior:
   - Abre la colección → **Settings** / engranaje → **Permissions**.
   - Pulsa **Add role** (o similar).
   - Elige el rol **Users** (o "Any" si es la única opción de usuarios autenticados).
   - Marca **Read** y, donde corresponda, **Create**, **Update** (y **Delete** si lo necesitas).
4. Guarda los cambios.

## 400 Bad Request en `physical_assets` (Patrimonio líquido)

Si al crear bienes ves **400 Bad Request**, suele ser por la estructura de la colección:

1. **"Unknown attribute: created_at"**: La colección no tiene el atributo `created_at`. Ejecuta `node scripts/appwrite-create-collections.js` para crear las colecciones con el esquema correcto (o crea la colección desde cero).
2. **"Missing required attribute: created_at"**: La colección tiene `created_at` obligatorio. En Appwrite Console → Databases → finaria → physical_assets → Attributes, edita `created_at` y:
   - Desmarca "Required"
   - Añade Default: `2000-01-01T00:00:00.000Z`

3. Asegúrate de que la colección `physical_assets` tenga los atributos: `user_id`, `org_id`, `name`, `amount` (y opcionalmente `created_at`).

## Comprobar

1. Cierra sesión en la app y vuelve a iniciar sesión (para refrescar contexto).
2. Si el error persiste, abre las DevTools (F12) → pestaña **Network**, reproduce el error y revisa qué **URL** falla (qué colección y método: GET = Read, POST = Create, etc.). Ajusta los permisos de esa colección según la tabla anterior.

## Nota sobre seguridad

Dar **Create/Read/Update** a **Users** en **profiles** permite que cualquier usuario autenticado cree/lea/actualice documentos en esa colección. En este proyecto el documento de perfil se identifica por `documentId = userId`, así que en la práctica cada usuario trabaja con su propio documento. Para restricciones más finas (solo leer/escribir el documento cuyo `$id` es el userId) tendrías que usar **Appwrite Functions** con la API key y exponer endpoints que validen el userId. La configuración anterior es la mínima para que la app cliente funcione sin Functions adicionales.
