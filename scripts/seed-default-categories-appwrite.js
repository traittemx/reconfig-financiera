/**
 * Seed categorías por defecto (y cuenta "Efectivo") para todos los usuarios:
 * con organización y sin organización. A los usuarios sin org se les crea
 * una organización personal "Mi espacio" y luego se seedea.
 *
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/seed-default-categories-appwrite.js
 * O: npm run appwrite:seed-default-categories
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

const { Client, Users, Databases, Query, ID } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

const DEFAULT_CATEGORIES = [
  { kind: 'INCOME', name: 'Salario', icon: 'Wallet', color: '#0d9488' },
  { kind: 'INCOME', name: 'Otros ingresos', icon: 'DollarSign', color: '#0891b2' },
  { kind: 'EXPENSE', name: 'Comida', icon: 'UtensilsCrossed', color: '#e11d48' },
  { kind: 'EXPENSE', name: 'Transporte', icon: 'Car', color: '#2563eb' },
  { kind: 'EXPENSE', name: 'Diversión', icon: 'Gamepad2', color: '#7c3aed' },
  { kind: 'EXPENSE', name: 'Renta', icon: 'Home', color: '#16a34a' },
  { kind: 'EXPENSE', name: 'Gasolina', icon: 'Zap', color: '#ea580c' },
  { kind: 'EXPENSE', name: 'Salud', icon: 'HeartPulse', color: '#dc2626' },
  { kind: 'EXPENSE', name: 'Entretenimiento', icon: 'Gamepad2', color: '#7c3aed' },
  { kind: 'EXPENSE', name: 'Streaming', icon: 'Music', color: '#0891b2' },
  { kind: 'EXPENSE', name: 'Viajes', icon: 'Plane', color: '#0d9488' },
  { kind: 'EXPENSE', name: 'Café', icon: 'Coffee', color: '#ca8a04' },
  { kind: 'EXPENSE', name: 'Libros', icon: 'BookOpen', color: '#65a30d' },
  { kind: 'EXPENSE', name: 'Regalos', icon: 'Gift', color: '#be185d' },
];

async function ensurePersonalOrg(databases, userId) {
  const slug = `personal-${userId}`;
  const orgList = await databases.listDocuments(DATABASE_ID, 'organizations', [
    Query.equal('slug', [slug]),
    Query.limit(1),
  ]);
  if (orgList.documents && orgList.documents.length > 0) {
    const orgId = orgList.documents[0].$id;
    return orgId;
  }
  const now = new Date().toISOString();
  const orgDoc = await databases.createDocument(
    DATABASE_ID,
    'organizations',
    ID.unique(),
    {
      name: 'Mi espacio',
      slug,
      created_at: now,
    }
  );
  const orgId = orgDoc.$id;

  const memberList = await databases.listDocuments(DATABASE_ID, 'org_members', [
    Query.equal('org_id', [orgId]),
    Query.equal('user_id', [userId]),
    Query.limit(1),
  ]);
  if (!memberList.documents || memberList.documents.length === 0) {
    await databases.createDocument(DATABASE_ID, 'org_members', ID.unique(), {
      org_id: orgId,
      user_id: userId,
      role_in_org: 'ORG_ADMIN',
      status: 'active',
      created_at: now,
    });
  }

  try {
    await databases.getDocument(DATABASE_ID, 'org_subscriptions', orgId);
  } catch {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 365);
    try {
      await databases.createDocument(DATABASE_ID, 'org_subscriptions', orgId, {
        status: 'trial',
        seats_total: 1,
        seats_used: 1,
        period_start: new Date().toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        updated_at: now,
      });
    } catch (subErr) {
      await databases.createDocument(DATABASE_ID, 'org_subscriptions', orgId, {
        status: 'trial',
        period_start: new Date().toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        updated_at: now,
      });
    }
  }

  try {
    await databases.updateDocument(DATABASE_ID, 'profiles', userId, {
      org_id: orgId,
      role: 'ORG_ADMIN',
      updated_at: now,
    });
  } catch {
    try {
      await databases.createDocument(DATABASE_ID, 'profiles', userId, {
        full_name: '',
        org_id: orgId,
        role: 'ORG_ADMIN',
        created_at: now,
        updated_at: now,
      });
    } catch (e) {
      // profile puede no existir si el usuario no ha iniciado sesión en la app
    }
  }

  return orgId;
}

async function seedForUser(databases, orgId, userId) {
  const catList = await databases.listDocuments(DATABASE_ID, 'categories', [
    Query.equal('org_id', [orgId]),
    Query.equal('user_id', [userId]),
    Query.limit(1),
  ]);
  if (catList.documents && catList.documents.length > 0) {
    return { categories: false, account: false };
  }

  const now = new Date().toISOString();
  for (const c of DEFAULT_CATEGORIES) {
    await databases.createDocument(DATABASE_ID, 'categories', ID.unique(), {
      org_id: orgId,
      user_id: userId,
      kind: c.kind,
      name: c.name,
      is_default: true,
      icon: c.icon,
      color: c.color,
      created_at: now,
    });
  }

  const accList = await databases.listDocuments(DATABASE_ID, 'accounts', [
    Query.equal('user_id', [userId]),
    Query.limit(1),
  ]);
  let accountCreated = false;
  if (!accList.documents || accList.documents.length === 0) {
    await databases.createDocument(DATABASE_ID, 'accounts', ID.unique(), {
      user_id: userId,
      org_id: orgId,
      name: 'Efectivo',
      type: 'CASH',
      currency: 'MXN',
      opening_balance: 0,
      created_at: now,
    });
    accountCreated = true;
  }

  return { categories: true, account: accountCreated };
}

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const usersApi = new Users(client);
  const databases = new Databases(client);

  const pairsByKey = new Map();

  const res = await databases.listDocuments(DATABASE_ID, 'org_members', [Query.limit(500)]);
  (res.documents || []).forEach((doc) => {
    const orgId = doc.org_id;
    const userId = doc.user_id;
    if (orgId && userId) pairsByKey.set(`${orgId}:${userId}`, { orgId, userId });
  });

  const userIdsWithOrg = new Set();
  pairsByKey.forEach((_, key) => {
    const userId = key.split(':')[1];
    if (userId) userIdsWithOrg.add(userId);
  });

  let userList = [];
  try {
    const ul = await usersApi.list();
    userList = ul.users || [];
  } catch (e) {
    console.warn('No se pudo listar usuarios de Auth:', e.message || e);
  }

  const profilesRes = await databases.listDocuments(DATABASE_ID, 'profiles', [Query.limit(500)]);
  const profileUserIds = new Set((profilesRes.documents || []).map((d) => d.$id));

  const allUserIds = new Set([...userList.map((u) => u.$id), ...profileUserIds]);
  const usersWithoutOrg = [...allUserIds].filter((id) => !userIdsWithOrg.has(id));

  if (usersWithoutOrg.length > 0) {
    console.log(`${usersWithoutOrg.length} usuario(s) sin organización: creando org personal "Mi espacio"...`);
    for (const userId of usersWithoutOrg) {
      try {
        const orgId = await ensurePersonalOrg(databases, userId);
        pairsByKey.set(`${orgId}:${userId}`, { orgId, userId });
        console.log(`  ${userId.slice(0, 8)}... → org personal creada`);
      } catch (err) {
        console.error(`  ${userId}: error creando org personal`, err.message || err);
      }
    }
  }

  const list = Array.from(pairsByKey.values());

  if (list.length === 0) {
    console.log('No hay usuarios en la base de datos. Crea usuarios (ej. npm run seed:demo) y vuelve a ejecutar.');
    return;
  }

  console.log(`\nComprobando ${list.length} usuario(s) (con org o org personal)...`);

  let categoriesCount = 0;
  let accountsCount = 0;
  for (const { orgId, userId } of list) {
    try {
      const r = await seedForUser(databases, orgId, userId);
      if (r.categories) {
        categoriesCount++;
        console.log(`  ${userId.slice(0, 8)}... (org: ${orgId.slice(0, 8)}...): ${DEFAULT_CATEGORIES.length} categorías creadas${r.account ? ', cuenta Efectivo creada' : ''}`);
      }
      if (r.account) accountsCount++;
    } catch (err) {
      console.error(`  ${userId} (org ${orgId}): error`, err.message || err);
    }
  }

  console.log(`\n✓ Listo. Categorías por defecto creadas para ${categoriesCount} usuario(s), cuenta Efectivo para ${accountsCount} usuario(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
