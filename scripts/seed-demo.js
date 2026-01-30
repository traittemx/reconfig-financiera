/**
 * Seed demo company and demo user for Reprogramación Financiera.
 *
 * Requires:
 *   - EXPO_PUBLIC_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard → Settings → API → service_role)
 *
 * Run: node scripts/seed-demo.js
 * Or with .env: ensure .env has SUPABASE_SERVICE_ROLE_KEY and EXPO_PUBLIC_SUPABASE_URL
 */

const path = require('path');
const fs = require('fs');

// Load .env if present (simple parser, no dotenv dependency)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing env. Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env or shell).'
  );
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo123456';
const DEMO_ORG_NAME = 'Empresa Demo';
const DEMO_ORG_SLUG = 'empresa-demo';
const DEMO_FULL_NAME = 'Usuario Demo';

async function main() {
  console.log('Creating demo user and company...');

  // 1. Create auth user (service role can create users)
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_FULL_NAME },
  });

  let userId;
  if (userError) {
    if (
      userError.message &&
      (userError.message.includes('already been registered') || userError.message.includes('already exists'))
    ) {
      console.log('Demo user already exists. Fetching existing user...');
      const { data: listData } = await supabase.auth.admin.listUsers({ per_page: 1000 });
      const existingUser = listData?.users?.find((u) => u.email === DEMO_EMAIL);
      if (!existingUser) {
        console.error('User exists but could not be fetched. Error:', userError.message);
        process.exit(1);
      }
      userId = existingUser.id;
    } else {
      console.error('Error creating user:', userError.message);
      process.exit(1);
    }
  } else {
    userId = userData.user.id;
    console.log('Demo user created:', userId);
  }

  // 2. Organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', DEMO_ORG_SLUG)
    .single();

  let orgId;
  if (org) {
    orgId = org.id;
    console.log('Demo organization already exists:', orgId);
  } else {
    const { data: newOrg, error: insertOrgError } = await supabase
      .from('organizations')
      .insert({ name: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG })
      .select('id')
      .single();
    if (insertOrgError) {
      console.error('Error creating organization:', insertOrgError.message);
      process.exit(1);
    }
    orgId = newOrg.id;
    console.log('Demo organization created:', orgId);
  }

  // 3. org_members
  const { error: memberError } = await supabase.from('org_members').upsert(
    {
      org_id: orgId,
      user_id: userId,
      role_in_org: 'ORG_ADMIN',
      status: 'active',
    },
    { onConflict: 'org_id,user_id' }
  );
  if (memberError) {
    console.error('Error upserting org_members:', memberError.message);
    process.exit(1);
  }
  console.log('Org membership set.');

  // 4. org_subscriptions (only if we just created the org)
  const { data: sub } = await supabase.from('org_subscriptions').select('org_id').eq('org_id', orgId).single();
  if (!sub) {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 14);
    await supabase.from('org_subscriptions').insert({
      org_id: orgId,
      status: 'trial',
      seats_total: 10,
      seats_used: 1,
      period_start: new Date().toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
    });
    console.log('Org subscription created.');
  }

  // 5. profiles
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: DEMO_FULL_NAME,
      org_id: orgId,
      role: 'ORG_ADMIN',
      start_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (profileError) {
    console.error('Error upserting profile:', profileError.message);
    process.exit(1);
  }
  console.log('Profile set.');

  // 6. Default categories for demo user (same as seed_default_categories)
  const { data: existingCat } = await supabase
    .from('categories')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (!existingCat) {
    const defaults = [
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Alimentación', is_default: true, icon: 'UtensilsCrossed', color: '#e11d48' },
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Transporte', is_default: true, icon: 'Car', color: '#2563eb' },
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Vivienda', is_default: true, icon: 'Home', color: '#16a34a' },
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Salud', is_default: true, icon: 'HeartPulse', color: '#dc2626' },
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Entretenimiento', is_default: true, icon: 'Gamepad2', color: '#7c3aed' },
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Educación', is_default: true, icon: 'GraduationCap', color: '#ea580c' },
      { org_id: orgId, user_id: userId, kind: 'EXPENSE', name: 'Otros gastos', is_default: true, icon: 'Receipt', color: '#64748b' },
      { org_id: orgId, user_id: userId, kind: 'INCOME', name: 'Nómina', is_default: true, icon: 'Wallet', color: '#0d9488' },
      { org_id: orgId, user_id: userId, kind: 'INCOME', name: 'Freelance', is_default: true, icon: 'Briefcase', color: '#be185d' },
      { org_id: orgId, user_id: userId, kind: 'INCOME', name: 'Otros ingresos', is_default: true, icon: 'DollarSign', color: '#0891b2' },
    ];
    await supabase.from('categories').insert(defaults);
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
