/**
 * Seed demo company and demo user for Reconfiguración Financiera (Appwrite).
 *
 * Requires:
 *   - APPWRITE_ENDPOINT (e.g. https://cloud.appwrite.io/v1)
 *   - APPWRITE_PROJECT_ID
 *   - APPWRITE_API_KEY (API key with users.write, databases.write; from Appwrite Console → API Keys)
 *
 * Run: node scripts/seed-demo.js
 * Or with .env: ensure .env has APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
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
  console.error(
    'Missing env. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY (in .env or shell).'
  );
  process.exit(1);
}

const { Client, Users, Databases, ID, Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo123456';
const DEMO_ORG_NAME = 'Empresa Demo';
const DEMO_ORG_SLUG = 'empresa-demo';
const DEMO_FULL_NAME = 'Usuario Demo';

const defaultCategories = [
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Alimentación', is_default: true, icon: 'UtensilsCrossed', color: '#e11d48' },
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Transporte', is_default: true, icon: 'Car', color: '#2563eb' },
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Vivienda', is_default: true, icon: 'Home', color: '#16a34a' },
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Salud', is_default: true, icon: 'HeartPulse', color: '#dc2626' },
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Entretenimiento', is_default: true, icon: 'Gamepad2', color: '#7c3aed' },
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Educación', is_default: true, icon: 'GraduationCap', color: '#ea580c' },
  { org_id: '', user_id: '', kind: 'EXPENSE', name: 'Otros gastos', is_default: true, icon: 'Receipt', color: '#64748b' },
  { org_id: '', user_id: '', kind: 'INCOME', name: 'Nómina', is_default: true, icon: 'Wallet', color: '#0d9488' },
  { org_id: '', user_id: '', kind: 'INCOME', name: 'Freelance', is_default: true, icon: 'Briefcase', color: '#be185d' },
  { org_id: '', user_id: '', kind: 'INCOME', name: 'Otros ingresos', is_default: true, icon: 'DollarSign', color: '#0891b2' },
];

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const usersApi = new Users(client);
  const databases = new Databases(client);

  console.log('Creating demo user and company...');

  let userId;
  try {
    const userList = await usersApi.list();
    const existing = userList.users.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      userId = existing.$id;
      console.log('Demo user already exists:', userId);
    } else {
      const created = await usersApi.create(ID.unique(), DEMO_EMAIL, DEMO_PASSWORD, DEMO_FULL_NAME);
      userId = created.$id;
      console.log('Demo user created:', userId);
    }
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      const userList = await usersApi.list();
      const existing = userList.users.find((u) => u.email === DEMO_EMAIL);
      userId = existing ? existing.$id : null;
      if (!userId) {
        console.error('User exists but could not be fetched:', e.message);
        process.exit(1);
      }
      console.log('Demo user (existing):', userId);
    } else {
      console.error('Error creating user:', e.message);
      process.exit(1);
    }
  }

  let orgId;
  const orgList = await databases.listDocuments(DATABASE_ID, 'organizations', [
    Query.equal('slug', [DEMO_ORG_SLUG]),
    Query.limit(1),
  ]);
  if (orgList.documents && orgList.documents.length > 0) {
    orgId = orgList.documents[0].$id;
    console.log('Demo organization already exists:', orgId);
  } else {
    const newOrg = await databases.createDocument(
      DATABASE_ID,
      'organizations',
      ID.unique(),
      {
        name: DEMO_ORG_NAME,
        slug: DEMO_ORG_SLUG,
        created_at: new Date().toISOString(),
      }
    );
    orgId = newOrg.$id;
    console.log('Demo organization created:', orgId);
  }

  const memberId = `${orgId}_${userId}`;
  try {
    await databases.getDocument(DATABASE_ID, 'org_members', memberId);
    console.log('Org membership already exists.');
  } catch {
    await databases.createDocument(DATABASE_ID, 'org_members', memberId, {
      org_id: orgId,
      user_id: userId,
      role_in_org: 'ORG_ADMIN',
      status: 'active',
      created_at: new Date().toISOString(),
    });
    console.log('Org membership set.');
  }

  try {
    await databases.getDocument(DATABASE_ID, 'org_subscriptions', orgId);
    console.log('Org subscription already exists.');
  } catch {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 14);
    await databases.createDocument(DATABASE_ID, 'org_subscriptions', orgId, {
      status: 'trial',
      seats_total: 10,
      seats_used: 1,
      period_start: new Date().toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
    console.log('Org subscription created.');
  }

  try {
    await databases.getDocument(DATABASE_ID, 'profiles', userId);
    await databases.updateDocument(DATABASE_ID, 'profiles', userId, {
      full_name: DEMO_FULL_NAME,
      org_id: orgId,
      role: 'ORG_ADMIN',
      start_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
    console.log('Profile updated.');
  } catch {
    await databases.createDocument(DATABASE_ID, 'profiles', userId, {
      full_name: DEMO_FULL_NAME,
      org_id: orgId,
      role: 'ORG_ADMIN',
      start_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log('Profile set.');
  }

  const catList = await databases.listDocuments(DATABASE_ID, 'categories', [
    Query.equal('org_id', [orgId]),
    Query.equal('user_id', [userId]),
    Query.limit(1),
  ]);
  if (catList.documents && catList.documents.length > 0) {
    console.log('Default categories already exist.');
  } else {
    for (const c of defaultCategories) {
      await databases.createDocument(DATABASE_ID, 'categories', ID.unique(), {
        ...c,
        org_id: orgId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    }
    console.log('Default categories created.');
  }

  console.log('\n--- Demo listo ---');
  console.log('Email:    ', DEMO_EMAIL);
  console.log('Password:', DEMO_PASSWORD);
  console.log('Empresa: ', DEMO_ORG_NAME);
  console.log('\nUsa estas credenciales en la pantalla de login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
