/**
 * Crea en Appwrite la base de datos y todas las colecciones con sus atributos.
 * Equivalente a migrar las tablas de Supabase a Appwrite.
 *
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY (con permisos de escritura)
 * Ejecutar: node scripts/appwrite-create-collections.js
 *
 * Usa node-appwrite (npm install node-appwrite o ya en devDependencies).
 */

const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Faltan variables de entorno: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const { Client, Databases } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Esperar a que Appwrite procese el atributo (se crean en segundo plano) */
async function waitForAttribute() {
  await sleep(1500);
}

async function ensureCollection(databases, databaseId, collectionId, name, attrs) {
  try {
    await databases.getCollection(databaseId, collectionId);
    console.log(`  Colección "${collectionId}" ya existe, omitiendo.`);
    return;
  } catch (_) {}

  await databases.createCollection(databaseId, collectionId, name);
  console.log(`  Creada colección: ${collectionId}`);

  for (const a of attrs) {
    try {
      const isRequired = a.required ?? false;
      const defaultValue = isRequired ? undefined : (a.default ?? undefined);
      
      if (a.type === 'string') {
        await databases.createStringAttribute(
          databaseId,
          collectionId,
          a.key,
          a.size ?? 255,
          isRequired,
          defaultValue
        );
      } else if (a.type === 'integer') {
        await databases.createIntegerAttribute(
          databaseId,
          collectionId,
          a.key,
          isRequired,
          a.min ?? undefined,
          a.max ?? undefined,
          defaultValue
        );
      } else if (a.type === 'float') {
        await databases.createFloatAttribute(
          databaseId,
          collectionId,
          a.key,
          isRequired,
          a.min ?? undefined,
          a.max ?? undefined,
          defaultValue
        );
      } else if (a.type === 'boolean') {
        await databases.createBooleanAttribute(
          databaseId,
          collectionId,
          a.key,
          isRequired,
          defaultValue
        );
      } else if (a.type === 'datetime') {
        await databases.createDatetimeAttribute(
          databaseId,
          collectionId,
          a.key,
          isRequired,
          defaultValue
        );
      } else if (a.type === 'url') {
        await databases.createUrlAttribute(
          databaseId,
          collectionId,
          a.key,
          isRequired,
          defaultValue
        );
      }
      await waitForAttribute();
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log(`    Atributo ${a.key} ya existe.`);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log('Creando base de datos...');
  try {
    await databases.get(DATABASE_ID);
    console.log(`Base de datos "${DATABASE_ID}" ya existe.`);
  } catch (_) {
    await databases.create(DATABASE_ID, 'Finaria');
    console.log(`Base de datos "${DATABASE_ID}" creada.`);
  }

  const collections = [
    {
      id: 'organizations',
      name: 'Organizations',
      attrs: [
        { type: 'string', key: 'name', size: 255, required: true },
        { type: 'string', key: 'slug', size: 255, required: true },
        { type: 'string', key: 'linking_code', size: 64, required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'profiles',
      name: 'Profiles',
      attrs: [
        { type: 'string', key: 'full_name', size: 255, required: false },
        { type: 'string', key: 'org_id', size: 64, required: false },
        { type: 'string', key: 'role', size: 32, required: true },
        { type: 'string', key: 'start_date', size: 16, required: false },
        { type: 'string', key: 'avatar_url', size: 2048, required: false },
        { type: 'datetime', key: 'created_at', required: true },
        { type: 'datetime', key: 'updated_at', required: true },
      ],
    },
    {
      id: 'org_members',
      name: 'Org Members',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'role_in_org', size: 32, required: true },
        { type: 'string', key: 'status', size: 32, required: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'org_subscriptions',
      name: 'Org Subscriptions',
      attrs: [
        { type: 'string', key: 'status', size: 32, required: true },
        { type: 'integer', key: 'seats_total', required: true, default: 10 },
        { type: 'integer', key: 'seats_used', required: true, default: 0 },
        { type: 'string', key: 'period_start', size: 16, required: false },
        { type: 'string', key: 'period_end', size: 16, required: false },
        { type: 'float', key: 'membership_cost', required: false },
        { type: 'string', key: 'notes', size: 4096, required: false },
        { type: 'datetime', key: 'updated_at', required: true },
      ],
    },
    {
      id: 'org_invites',
      name: 'Org Invites',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'email', size: 255, required: true },
        { type: 'string', key: 'role', size: 32, required: true },
        { type: 'string', key: 'token', size: 255, required: true },
        { type: 'datetime', key: 'expires_at', required: true },
        { type: 'datetime', key: 'accepted_at', required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'lessons',
      name: 'Lessons',
      attrs: [
        { type: 'string', key: 'title', size: 512, required: true },
        { type: 'string', key: 'summary', size: 16384, required: false },
        { type: 'string', key: 'mission', size: 16384, required: false },
        { type: 'string', key: 'audio_url', size: 2048, required: false },
      ],
    },
    {
      id: 'user_lesson_progress',
      name: 'User Lesson Progress',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'day', size: 8, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'datetime', key: 'unlocked_at', required: false },
        { type: 'datetime', key: 'completed_at', required: false },
        { type: 'string', key: 'notes', size: 8192, required: false },
      ],
    },
    {
      id: 'accounts',
      name: 'Accounts',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'name', size: 255, required: true },
        { type: 'string', key: 'type', size: 32, required: true },
        { type: 'string', key: 'currency', size: 8, required: true },
        { type: 'float', key: 'opening_balance', required: true, default: 0 },
        { type: 'integer', key: 'cut_off_day', required: false, min: 1, max: 31 },
        { type: 'integer', key: 'payment_day', required: false, min: 1, max: 31 },
        { type: 'float', key: 'credit_limit', required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'income_sources',
      name: 'Income Sources',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'name', size: 255, required: true },
        { type: 'string', key: 'kind', size: 64, required: false },
        { type: 'boolean', key: 'active', required: true, default: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'categories',
      name: 'Categories',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'user_id', size: 64, required: false },
        { type: 'string', key: 'kind', size: 32, required: true },
        { type: 'string', key: 'name', size: 255, required: true },
        { type: 'string', key: 'parent_id', size: 64, required: false },
        { type: 'boolean', key: 'is_default', required: true, default: false },
        { type: 'string', key: 'icon', size: 64, required: false },
        { type: 'string', key: 'color', size: 32, required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'transactions',
      name: 'Transactions',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'account_id', size: 64, required: true },
        { type: 'string', key: 'kind', size: 32, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'datetime', key: 'occurred_at', required: true },
        { type: 'string', key: 'category_id', size: 64, required: false },
        { type: 'string', key: 'note', size: 4096, required: false },
        { type: 'string', key: 'transfer_account_id', size: 64, required: false },
        { type: 'boolean', key: 'is_recurring', required: true, default: false },
        { type: 'string', key: 'recurrence_period', size: 32, required: false },
        { type: 'integer', key: 'recurrence_day_of_month', required: false, min: 1, max: 31 },
        { type: 'integer', key: 'recurrence_interval_months', required: true, default: 1 },
        { type: 'integer', key: 'recurrence_total_occurrences', required: false },
        { type: 'string', key: 'expense_label', size: 32, required: false },
        { type: 'boolean', key: 'is_scheduled', required: false, default: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'budgets',
      name: 'Budgets',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'month', size: 16, required: true },
        { type: 'string', key: 'name', size: 255, required: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'budget_items',
      name: 'Budget Items',
      attrs: [
        { type: 'string', key: 'budget_id', size: 64, required: true },
        { type: 'string', key: 'category_id', size: 64, required: true },
        { type: 'float', key: 'limit_amount', required: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'points_rules',
      name: 'Points Rules',
      attrs: [
        { type: 'integer', key: 'points', required: true },
        { type: 'boolean', key: 'is_active', required: true, default: true },
      ],
    },
    {
      id: 'points_events',
      name: 'Points Events',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'event_key', size: 64, required: true },
        { type: 'integer', key: 'points', required: true },
        { type: 'string', key: 'ref_table', size: 64, required: false },
        { type: 'string', key: 'ref_id', size: 64, required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'points_totals',
      name: 'Points Totals',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'integer', key: 'total_points', required: true, default: 0 },
        { type: 'datetime', key: 'updated_at', required: true },
      ],
    },
    {
      id: 'savings_goals',
      name: 'Savings Goals',
      attrs: [
        { type: 'string', key: 'account_id', size: 64, required: true },
        { type: 'float', key: 'target_amount', required: true },
        { type: 'string', key: 'name', size: 255, required: false },
        { type: 'string', key: 'target_date', size: 16, required: false },
        { type: 'datetime', key: 'created_at', required: true },
        { type: 'datetime', key: 'updated_at', required: true },
      ],
    },
    {
      id: 'physical_assets',
      name: 'Physical Assets',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'name', size: 255, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'datetime', key: 'created_at', required: false, default: '2000-01-01T00:00:00.000Z' },
      ],
    },
    {
      id: 'pilot_daily_recommendations',
      name: 'Pilot Daily Recommendations',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'recommendation_date', size: 16, required: true },
        { type: 'string', key: 'state', size: 32, required: true },
        { type: 'string', key: 'message_main', size: 2048, required: true },
        { type: 'string', key: 'message_why', size: 8192, required: true },
        { type: 'string', key: 'suggested_limit', size: 512, required: true },
        { type: 'string', key: 'suggested_action', size: 2048, required: false },
        { type: 'string', key: 'flexibility', size: 32, required: false },
        { type: 'string', key: 'signals_snapshot', size: 16384, required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'pilot_emotional_checkins',
      name: 'Pilot Emotional Checkins',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'checkin_date', size: 16, required: true },
        { type: 'string', key: 'value', size: 64, required: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'org_pilot_aggregates',
      name: 'Org Pilot Aggregates',
      attrs: [
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'period', size: 16, required: true },
        { type: 'integer', key: 'total_users_with_recommendation', required: true, default: 0 },
        { type: 'integer', key: 'total_recommendations', required: true, default: 0 },
        { type: 'integer', key: 'count_safe', required: true, default: 0 },
        { type: 'integer', key: 'count_caution', required: true, default: 0 },
        { type: 'integer', key: 'count_containment', required: true, default: 0 },
        { type: 'integer', key: 'count_reward', required: true, default: 0 },
        { type: 'float', key: 'pct_safe', required: false },
        { type: 'float', key: 'pct_caution', required: false },
        { type: 'float', key: 'pct_containment', required: false },
        { type: 'float', key: 'pct_reward', required: false },
        { type: 'integer', key: 'follow_count', required: true, default: 0 },
        { type: 'integer', key: 'containment_count_for_follow', required: true, default: 0 },
        { type: 'float', key: 'avg_follow_rate', required: false },
        { type: 'datetime', key: 'updated_at', required: true },
      ],
    },
    {
      id: 'budget_safe_style_expenses',
      name: 'Budget Safe Style Expenses',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'month', size: 16, required: true },
        { type: 'string', key: 'category', size: 128, required: true },
        { type: 'string', key: 'subcategory', size: 128, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'string', key: 'budget_type', size: 16, required: true },
        { type: 'string', key: 'note', size: 4096, required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'financial_personality_results',
      name: 'Financial Personality Results',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'dominant_personality', size: 32, required: true },
        { type: 'string', key: 'secondary_personality', size: 32, required: false },
        { type: 'string', key: 'scores', size: 512, required: true },
        { type: 'datetime', key: 'completed_at', required: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'financial_archetype_results',
      name: 'Financial Archetype Results',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'dominant_archetype', size: 32, required: true },
        { type: 'string', key: 'secondary_archetype', size: 32, required: false },
        { type: 'string', key: 'tertiary_archetype', size: 32, required: false },
        { type: 'string', key: 'scores', size: 512, required: true },
        { type: 'datetime', key: 'completed_at', required: true },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
    {
      id: 'cash_flow_income',
      name: 'Cash Flow Income',
      attrs: [
        { type: 'string', key: 'user_id', size: 64, required: true },
        { type: 'string', key: 'org_id', size: 64, required: true },
        { type: 'string', key: 'month', size: 16, required: true },
        { type: 'string', key: 'source_type', size: 32, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'string', key: 'note', size: 4096, required: false },
        { type: 'datetime', key: 'created_at', required: true },
      ],
    },
  ];

  for (const col of collections) {
    console.log(`\nProcesando: ${col.id}`);
    await ensureCollection(databases, DATABASE_ID, col.id, col.name, col.attrs);
    await sleep(300);
  }

  console.log('\n--- Migración de colecciones completada ---');
  console.log('Crea el bucket de Storage "lesson-audio" desde la consola de Appwrite si aún no existe.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
