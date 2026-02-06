/**
 * Client-side fallback for seed_default_categories and seed_default_accounts
 * when the Appwrite Cloud Functions are not deployed (404) or fail.
 * Same data as appwrite-functions/seed_default_categories and seed_default_accounts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listDocuments,
  createDocument,
  COLLECTIONS,
  Query,
} from '@/lib/appwrite';

const DEFAULTS_SEEDED_KEY = 'finaria_defaults_seeded';

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
 * Returns true if we've already seeded defaults for this user (from profile or AsyncStorage).
 * Use this to avoid running seed on every load without needing to PATCH profiles
 * (avoids 400 when the profiles collection doesn't have defaults_seeded_at).
 */
export async function hasDefaultsSeededForUser(userId: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(`${DEFAULTS_SEEDED_KEY}_${userId}`);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks that we've seeded defaults for this user (AsyncStorage only).
 * Call after seed (Cloud Function or local) succeeds.
 * Avoids PATCH to profiles so we never get 400 when the collection has no defaults_seeded_at attribute.
 */
export async function setDefaultsSeededForUser(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DEFAULTS_SEEDED_KEY}_${userId}`, 'true');
  } catch {
    // ignore
  }
}
