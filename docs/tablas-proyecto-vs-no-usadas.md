# Tablas del proyecto: usadas vs no usadas

Resumen de qué tablas usa este proyecto (Reconfiguración Financiera) y cuáles están declaradas pero no se usan. Si ves tablas como `restaurants` en tu backend InsForge, no son de este proyecto.

---

## Tablas que SÍ usa el proyecto (referenciadas en código)

Estas tablas están en `lib/insforge.ts` (COLLECTIONS) y se usan en `app/`, `lib/`, `hooks/` o `components/`:

| Tabla | Dónde se usa |
|-------|----------------|
| **organizations** | superadmin/organizations.tsx, superadmin/org/[orgId].tsx, invite/[token].tsx |
| **profiles** | auth-context, signup, invite, leaderboard, course, org/employees, org/progress, superadmin/org |
| **org_members** | org/employees, org/progress, invite, superadmin/org |
| **org_subscriptions** | auth-context, org/employees, invite, superadmin/organizations, superadmin/org |
| **org_invites** | org/employees, invite/[token].tsx |
| **lessons** | course/index, course/[day], superadmin/lessons |
| **user_lesson_progress** | course/index, course/[day], org/progress, superadmin/org |
| **accounts** | finance/accounts, credit-cards, transactions, inventory, analysis, calendar, useFinanceData, pilot |
| **categories** | finance/categories, budgets, inventory, analysis, seed-defaults |
| **transactions** | finance/index, transactions, accounts, credit-cards, inventory, analysis, calendar, useFinanceData, pilot |
| **budgets** | finance/budgets, useFinanceData |
| **budget_items** | finance/budgets, useFinanceData |
| **points_rules** | lib/points.ts |
| **points_events** | lib/points.ts |
| **points_totals** | leaderboard, lib/points.ts, useMyPoints.ts |
| **savings_goals** | finance/accounts |
| **physical_assets** | finance/net-worth.tsx |
| **pilot_daily_recommendations** | lib/pilot.ts, components/pilot/EmotionalCheckin (indirect) |
| **pilot_emotional_checkins** | components/pilot/EmotionalCheckin, lib/pilot.ts |
| **budget_safe_style_expenses** | finance/presupuesto-seguro-estilo, finance/flujo-efectivo |
| **financial_personality_results** | financial-personality-quiz, profile, financial-personality-results |
| **financial_archetype_results** | financial-archetype-quiz, profile, financial-archetype-results |
| **cash_flow_income** | finance/flujo-efectivo.tsx |
| **transaction_labels** | finance/transactions, finance/labels.tsx |
| **inventory_items** | finance/transactions (crear al guardar), finance/inventory.tsx |

---

## Tablas declaradas en el proyecto pero NO usadas en código

Están en `COLLECTIONS` en `lib/insforge.ts` (y a veces en schema/migraciones) pero **no hay ninguna referencia** en la app (ni listDocuments, createDocument, getDocument, etc.):

| Tabla | En schema/migraciones | Nota |
|-------|------------------------|------|
| **income_sources** | Sí (Supabase 001_initial) | Definida y con RLS; ningún componente ni hook la usa. Posible uso futuro (ingresos por fuente). |

**org_pilot_aggregates** está en COLLECTIONS y en migración `010_org_pilot_aggregates.sql` (Supabase), pero **no se usa desde la app**; la función `refresh_org_pilot_aggregates` la rellena. Se puede considerar “usada” por el backend para agregados, pero no por el front.

---

## Tablas que NO son de este proyecto (ej. en InsForge)

Si en tu base InsForge ves tablas que **no están** en `lib/insforge.ts` ni en ningún archivo del repo, no pertenecen a Reconfiguración Financiera. Probablemente vienen de:

- Otro proyecto usando el mismo backend
- Un template de InsForge (p. ej. demo con restaurantes)

Ejemplo:

| Tabla | En este repo |
|-------|----------------|
| **restaurants** | No existe en código ni en schema. Si aparece en InsForge, es de otro proyecto/template. |

Recomendación: en el dashboard de InsForge (o con `get-table-schema` / listado de tablas), identifica todas las tablas. Las que no estén en la lista “Tablas que SÍ usa el proyecto” ni en “income_sources” / “org_pilot_aggregates” puedes considerarlas ajenas y, si quieres, eliminarlas o ignorarlas.

---

## Storage (bucket): no es tabla

En `app/(protected)/(tabs)/finance/transactions.tsx` se usa el bucket de storage **`tickets`** (subida de imágenes de tickets). Es un bucket de InsForge Storage, no una tabla de la base de datos. Debe existir en tu proyecto InsForge si usas esa función.

---

## Esquema InsForge vs Supabase

- **insforge_schema.sql** no define todas las tablas que usa la app: faltan por ejemplo `points_totals`, `org_invites`, `income_sources`, `inventory_items`, `org_pilot_aggregates`, `budget_safe_style_expenses`, `financial_personality_results`, `financial_archetype_results`, `cash_flow_income`, `transaction_labels`. Es un subconjunto del esquema real.
- Las migraciones en **supabase/migrations/** tienen más tablas (org_invites, income_sources, points_totals, org_pilot_aggregates, etc.). Si tu backend es InsForge, conviene tener un único esquema SQL de referencia (o migraciones) que incluya todas las tablas usadas y alineado con `COLLECTIONS`.
