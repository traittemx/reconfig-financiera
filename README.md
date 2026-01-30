# Finaria

App B2B: finanzas personales + curso de 23 días desbloqueable, vendida a empresas. La empresa paga por empleado. Suscripción manual (sin pasarela de pago).

## Stack

- **Expo** (React Native) con **Expo Router**
- **React Native Web** (web con look nativo)
- **TypeScript**
- **NativeWind** (Tailwind para React Native) + **Tamagui** (componentes UI)
- **Reanimated** + **Moti** (animaciones)
- **PWA** para web (manifest + configuración Expo Web)
- **Supabase** (Auth + Postgres + RLS)

## Requisitos

- Node.js 18+
- Cuenta [Supabase](https://supabase.com)
- Expo CLI (`npx expo`)

## Variables de entorno

Crea un archivo `.env` en la raíz (o configura en tu entorno):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

En Expo, las variables deben tener el prefijo `EXPO_PUBLIC_` para estar disponibles en el cliente.

## Instalación

```bash
npm install
```

## Ejecutar en local

```bash
# Iniciar Expo (elige plataforma en la terminal)
npx expo start

# Solo web
npm run web

# iOS
npm run ios

# Android
npm run android
```

## Supabase: migraciones y seed

1. Crea un proyecto en Supabase.
2. En el **SQL Editor**, ejecuta en este orden:
   - Contenido de `supabase/migrations/001_initial.sql` (esquema, RLS, triggers, función `award_points`).
   - Contenido de `supabase/migrations/002_add_account_type_credit.sql` (si existe).
   - Contenido de `supabase/migrations/003_super_admin_lessons.sql` (permisos super admin en lessons y función `set_first_super_admin`).
   - Contenido de `supabase/seed.sql` (lecciones 1..23, `points_rules`, RPC `seed_default_categories`).
3. En **Authentication > Providers** asegura que **Email** está habilitado (email + password).

## Scripts

| Script        | Descripción                    |
|---------------|--------------------------------|
| `npm start`   | Inicia Expo                    |
| `npm run web` | Inicia en navegador (React Native Web) |
| `npm run web:build` | Export estático para web (`expo export --platform web`) |
| `npm run deploy:web` | Export + deploy preview en EAS Hosting |
| `npm run deploy:web:prod` | Export + deploy producción en EAS Hosting |
| `npm run ios` | iOS simulator                  |
| `npm run android` | Android emulator            |
| `npm run lint` | Lint con Expo                 |

## Deploy web con EAS Hosting (recomendado)

La forma más directa de publicar la web es usar **EAS Hosting** de Expo: el proyecto se vincula a tu cuenta en [expo.dev](https://expo.dev) y el deploy se hace desde tu máquina o con workflows.

1. **Cuenta Expo:** Regístrate o inicia sesión en [expo.dev/signup](https://expo.dev/signup).
2. **EAS CLI:** No hace falta instalarlo globalmente. Usa `npx eas-cli@latest` en cada comando (o instala global con `npm install -g eas-cli` si prefieres).
3. **Vincular proyecto:** En la carpeta del proyecto ejecuta:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
   En `eas init` te pedirá elegir un **subdominio de preview** (ej. `finaria`). La URL de producción será `https://<subdominio>.expo.app`.
4. **Deploy:**
   ```bash
   npm run deploy:web        # preview
   npm run deploy:web:prod   # producción
   ```
   O manualmente: `npx expo export --platform web` y luego `npx eas-cli@latest deploy` (o `npx eas-cli@latest deploy --prod`).

Las variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` deben estar en tu `.env` local cuando hagas el export; EAS Hosting sirve el build estático (las env se “hornean” en el build). Para distintos entornos puedes usar [EAS Secrets](https://docs.expo.dev/eas/build-reference/variables/) en workflows.

## Deploy en Vercel (web)

1. Conecta el repositorio a Vercel.
2. **Root Directory (importante):** Si el repo tiene esta app en una subcarpeta (ej. `Reconfiguracion-Financiera`), en **Project Settings → General → Root Directory** pon esa carpeta. Si no, Vercel construye desde la raíz del repo y obtendrás 404 (no encuentra `dist`).
3. **Build command:** `npm run web:build` (o `npx expo export --platform web`). El `vercel.json` del proyecto ya lo define.
4. **Output directory:** `dist`.
5. **Framework Preset:** Other (no Next.js ni otro).
6. **Environment variables:** añade `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Estructura de la app (Expo Router)

- **Público:** `(public)/` — landing, login, registro empresa, aceptar invitación.
- **Protegido:** `(protected)/` — detrás de AuthGate (sesión + suscripción válida).
  - **Tabs:** Curso, Finanzas, Leaderboard, Perfil.
  - **Org:** Admin empresa (empleados, progreso, leaderboard) — solo ORG_ADMIN / SUPER_ADMIN.
  - **Superadmin:** Organizaciones y suscripciones manuales — solo SUPER_ADMIN.

## Roles

- **SUPER_ADMIN:** Acceso total; gestiona organizaciones y suscripciones.
- **ORG_ADMIN:** Admin de su empresa; invita empleados; ve leaderboard y progreso del curso (no ve transacciones ni montos).
- **EMPLOYEE:** Curso + finanzas personales; participa en leaderboard.

## Crear el primer Super Admin

1. Regístrate en la app con el email que quieras usar como super admin.
2. En Supabase SQL Editor, ejecuta (sustituye el email):  
   `UPDATE profiles SET role = 'SUPER_ADMIN' WHERE id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com');`  
   O usa el script `scripts/set-super-admin.sql` o la función `set_first_super_admin('email')` si aplicaste la migración 003.  
   Ver [docs/SUPER_ADMIN_SETUP.md](docs/SUPER_ADMIN_SETUP.md) para más opciones.

## PWA

El manifest está en `public/manifest.json`. Para web, `app/+html.tsx` incluye la referencia al manifest y meta PWA. Tras `npm run web:build`, el resultado es estático y desplegable; el service worker depende de la configuración de Expo para la plataforma web.
