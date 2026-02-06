/**
 * Client-side fallback for seed_default_categories and seed_default_accounts
 * when the Appwrite Cloud Functions are not deployed (404) or fail.
 * Same data as appwrite-functions/seed_default_categories and seed_default_accounts.
 */
import {
  listDocuments,
  createDocument,
  updateDocument,
  COLLECTIONS,
  Query,
} from '@/lib/appwrite';

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

/**
 * Creates default categories for org/user if none exist (client-side fallback).
 */
export async function seedDefaultCategories(
  orgId: string,
  userId: string
): Promise<void> {
  const { data: existing } = await listDocuments(COLLECTIONS.categories, [
    Query.equal('org_id', [orgId]),
    Query.equal('user_id', [userId]),
    Query.limit(1),
  ]);
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  for (const c of DEFAULT_CATEGORIES) {
    await createDocument(COLLECTIONS.categories, {
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
}

/**
 * Creates default "Efectivo" account for user if none exist (client-side fallback).
 */
export async function seedDefaultAccounts(
  orgId: string,
  userId: string
): Promise<void> {
  const { data: existing } = await listDocuments(COLLECTIONS.accounts, [
    Query.equal('user_id', [userId]),
    Query.limit(1),
  ]);
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  await createDocument(COLLECTIONS.accounts, {
    user_id: userId,
    org_id: orgId,
    name: 'Efectivo',
    type: 'CASH',
    currency: 'MXN',
    opening_balance: 0,
    created_at: now,
  });
}

/**
 * Runs both seed_default_categories and seed_default_accounts locally.
 * Use when Cloud Functions return 404 or fail.
 */
export async function seedDefaultsLocally(
  orgId: string,
  userId: string
): Promise<void> {
  await seedDefaultCategories(orgId, userId);
  await seedDefaultAccounts(orgId, userId);
}

/**
 * Marks the user profile as "defaults already seeded" so we don't run seed again on every load.
 * Call after seed (Cloud Function or local) succeeds.
 */
export async function markProfileDefaultsSeeded(profileId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDocument(COLLECTIONS.profiles, profileId, {
    defaults_seeded_at: now,
  });
}
