# Resumen de migración de Appwrite

## ✅ Completado

### Base de datos
- **Base de datos**: `finaria` creada en Appwrite

### Colecciones creadas (22 total)
1. ✅ organizations
2. ✅ profiles
3. ✅ org_members
4. ✅ org_subscriptions
5. ✅ org_invites
6. ✅ lessons
7. ✅ user_lesson_progress
8. ✅ accounts
9. ✅ income_sources
10. ✅ categories
11. ✅ transactions
12. ✅ budgets
13. ✅ budget_items
14. ✅ points_rules
15. ✅ points_events
16. ✅ points_totals
17. ✅ savings_goals
18. ✅ physical_assets
19. ✅ pilot_daily_recommendations
20. ✅ pilot_emotional_checkins
21. ✅ org_pilot_aggregates

### Storage
- ✅ Bucket `lesson-audio` creado con permisos públicos de lectura

### Contenido de lecciones
- ✅ 23 lecciones insertadas en la colección `lessons` (Día 1–23) con `title`, `summary`, `mission`, `audio_url` (vacío por defecto)
- Script: `npm run appwrite:seed-lessons` (lee desde `supabase/seed-data/lessons-content.ts`)

### Scripts
- ✅ `scripts/appwrite-create-collections.js` - Crea DB y colecciones
- ✅ `scripts/appwrite-create-storage-bucket.js` - Crea bucket de storage
- ✅ `scripts/seed-lessons-appwrite.js` - Inserta contenido de las 23 lecciones
- ✅ npm scripts añadidos:
  - `npm run appwrite:create-collections`
  - `npm run appwrite:create-bucket`
  - `npm run appwrite:setup` (ejecuta ambos)
  - `npm run appwrite:seed-lessons` (inserta contenido de lecciones)

### Configuración
- ✅ `.cursor/mcp.json` configurado con MCP de Appwrite
- ✅ Documentación actualizada en `docs/appwrite-schema.md`
- ✅ README.md actualizado con instrucciones de setup

## 📝 Notas

- Todas las colecciones incluyen sus atributos completos según el esquema
- Los atributos fueron creados con un delay de 1.5s entre cada uno para permitir procesamiento asíncrono
- El bucket de storage permite:
  - Lectura pública (para reproducir audios)
  - Escritura solo para usuarios autenticados
  - Tipos de archivo: audio/mpeg, mp3, wav, ogg, aac, m4a

## 🔄 Próximos pasos para completar la migración

Los scripts y la infraestructura de Appwrite están listos. Para completar la migración del proyecto necesitas:

1. Migrar autenticación (Auth context y pantallas)
2. Migrar todas las operaciones de base de datos en la app
3. Crear las Appwrite Functions (para RPCs)
4. Adaptar el sistema de Storage
5. Actualizar scripts de seed

Consulta el plan de migración completo para más detalles.
