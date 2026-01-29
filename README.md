# Reprogramación Financiera

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
   - Contenido de `supabase/seed.sql` (lecciones 1..23, `points_rules`, RPC `seed_default_categories`).
3. En **Authentication > Providers** asegura que **Email** está habilitado (email + password).

## Scripts

| Script        | Descripción                    |
|---------------|--------------------------------|
| `npm start`   | Inicia Expo                    |
| `npm run web` | Inicia en navegador (React Native Web) |
| `npm run web:build` | Export estático para web (`expo export --platform web`) |
| `npm run ios` | iOS simulator                  |
| `npm run android` | Android emulator            |
| `npm run lint` | Lint con Expo                 |

## Deploy en Vercel (web)

1. Conecta el repositorio a Vercel.
2. **Build command:** `npm run web:build`
3. **Output directory:** `dist` (Expo exporta ahí con `expo export --platform web`).
4. **Environment variables:** añade `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. Para SPA: en **Settings > Rewrites** puedes añadir una regla para que todas las rutas sirvan `index.html` (Vercel suele hacerlo por defecto para proyectos SPA).

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

## PWA

El manifest está en `public/manifest.json`. Para web, `app/+html.tsx` incluye la referencia al manifest y meta PWA. Tras `npm run web:build`, el resultado es estático y desplegable; el service worker depende de la configuración de Expo para la plataforma web.
