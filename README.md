# Finaria

App B2B: finanzas personales + curso de 23 días desbloqueable, vendida a empresas. La empresa paga por empleado. Suscripción manual (sin pasarela de pago).

## Stack

- **Expo** (React Native) con **Expo Router**
- **React Native Web** (web con look nativo)
- **TypeScript**
- **NativeWind** (Tailwind para React Native) + **Tamagui** (componentes UI)
- **Reanimated** + **Moti** (animaciones)
- **PWA** para web (manifest + configuración Expo Web)
- **Appwrite** (Auth + Databases + Storage + Functions)

## Requisitos

- Node.js 18+
- Cuenta [Appwrite](https://appwrite.io) (cloud o self-hosted)
- Expo CLI (`npx expo`)

## Variables de entorno

Crea un archivo `.env` en la raíz (o configura en tu entorno):

```bash
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=tu-project-id
```

En Expo, las variables deben tener el prefijo `EXPO_PUBLIC_` para estar disponibles en el cliente.

Para el script de seed demo (opcional) necesitas también una API key con permisos de escritura:

```bash
APPWRITE_API_KEY=tu-api-key
```

(Nunca expongas la API key en el cliente; úsala solo en scripts o en el servidor.)

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

## Appwrite: configuración y datos

1. Crea un proyecto en [Appwrite Console](https://cloud.appwrite.io) (o tu instancia).
2. Crea una base de datos (por defecto el código usa ID `finaria`) y las colecciones según `docs/appwrite-schema.md`. 
   - **Opción automática**: ejecuta `npm run appwrite:create-collections` (requiere API key en `.env` o env del sistema — ver `docs/appwrite-schema.md`).
   - **Opción MCP** (con el agente de Cursor): configura el MCP de Appwrite siguiendo `docs/appwrite-mcp-setup.md` y pide al agente que ejecute las migraciones.
3. **Auth**: habilita **Email/Password** en Authentication → Settings (ver `docs/appwrite-auth-setup.md`).
4. Crea un bucket de Storage (ID `lesson-audio`) para los audios de lecciones, o ejecuta `npm run appwrite:create-bucket`.
5. Despliega las Appwrite Functions (`validate_linking_code`, `join_org_with_code`, `seed_default_categories`, `seed_default_accounts`, `award_points`) desde `appwrite-functions/` — ver `appwrite-functions/README.md`.
6. **points_rules**: ejecuta `npm run appwrite:seed-points-rules` para crear las reglas de puntos (CREATE_EXPENSE, LESSON_COMPLETED, etc.) que usan las Functions.
7. Opcional: ejecuta `npm run seed:demo` (con `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY` en `.env`) para crear usuario y empresa demo.

## Scripts

| Script        | Descripción                    |
|---------------|--------------------------------|
| `npm start`   | Inicia Expo                    |
| `npm run web` | Inicia en navegador (React Native Web) |
| `npm run web:build` | Export estático para web (`expo export --platform web`) |
| `npm run deploy:web` | Export + deploy preview en EAS Hosting |
| `npm run deploy:web:prod` | Export + deploy producción en EAS Hosting |
| `npm run seed:demo` | Crea usuario y empresa demo (Appwrite; requiere API key) |
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

Las variables `EXPO_PUBLIC_APPWRITE_ENDPOINT` y `EXPO_PUBLIC_APPWRITE_PROJECT_ID` deben estar en tu `.env` local cuando hagas el export; EAS Hosting sirve el build estático (las env se “hornean” en el build). Para distintos entornos puedes usar [EAS Secrets](https://docs.expo.dev/eas/build-reference/variables/) en workflows.

## Deploy en Vercel (web)

1. Conecta el repositorio a Vercel.
2. **Root Directory (importante):** Si el repo tiene esta app en una subcarpeta (ej. `Reconfiguracion-Financiera`), en **Project Settings → General → Root Directory** pon esa carpeta. Si no, Vercel construye desde la raíz del repo y obtendrás 404 (no encuentra `dist`).
3. **Build command:** `npm run web:build` (o `npx expo export --platform web`). El `vercel.json` del proyecto ya lo define.
4. **Output directory:** `dist`.
5. **Framework Preset:** Other (no Next.js ni otro).
6. **Environment variables:** añade `EXPO_PUBLIC_APPWRITE_ENDPOINT` y `EXPO_PUBLIC_APPWRITE_PROJECT_ID`.

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
2. En Appwrite Console → Databases → colección `profiles`, localiza el documento cuyo ID es el User ID del usuario recién creado (o coincide con el usuario en Auth) y edita el atributo `role` a `SUPER_ADMIN`.
   Ver [docs/SUPER_ADMIN_SETUP.md](docs/SUPER_ADMIN_SETUP.md) si existe para más opciones.

## PWA

El manifest está en `public/manifest.json`. Para web, `app/+html.tsx` incluye la referencia al manifest y meta PWA. Tras `npm run web:build`, el resultado es estático y desplegable; el service worker depende de la configuración de Expo para la plataforma web.
