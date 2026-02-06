import { Client, Account, Databases, Storage, Functions, ID, Query, ExecutionMethod } from 'react-native-appwrite';

const endpoint =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? '';

/** En web: hostname debe coincidir con la plataforma añadida en Appwrite (CORS/Origin). */
const platform =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { window?: { location?: { hostname?: string } } }).window?.location?.hostname === 'string'
    ? (process.env.EXPO_PUBLIC_APPWRITE_PLATFORM ?? (globalThis as { window: { location: { hostname: string } } }).window.location.hostname)
    : process.env.EXPO_PUBLIC_APPWRITE_PLATFORM ?? '';

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);
if (platform) client.setPlatform(platform);

/**
 * En web, react-native-appwrite guarda X-Fallback-Cookies en localStorage pero no lo envía
 * en peticiones siguientes (cross-origin). Enviamos el fallback manualmente para que la sesión persista.
 */
if (typeof globalThis !== 'undefined' && (globalThis as { window?: unknown }).window) {
  const origCall = client.call.bind(client);
  (client as { call: typeof origCall }).call = async (method: string, url: URL, headers: Record<string, string> = {}, params: Record<string, unknown> = {}) => {
    const win = (globalThis as { window?: { localStorage?: Storage } }).window;
    if (win?.localStorage) {
      const fallback = win.localStorage.getItem('cookieFallback');
      if (fallback) headers = { ...headers, 'X-Fallback-Cookies': fallback };
    }
    return origCall(method, url, headers, params);
  };
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export { client, ID, Query };

/** Single Appwrite database ID (create one in Appwrite Console). */
export const DATABASE_ID = 'finaria';

/** Collection IDs (must match collections created in Appwrite). */
export const COLLECTIONS = {
  organizations: 'organizations',
  profiles: 'profiles',
  org_members: 'org_members',
  org_subscriptions: 'org_subscriptions',
  org_invites: 'org_invites',
  lessons: 'lessons',
  user_lesson_progress: 'user_lesson_progress',
  accounts: 'accounts',
  income_sources: 'income_sources',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  budget_items: 'budget_items',
  points_rules: 'points_rules',
  points_events: 'points_events',
  points_totals: 'points_totals',
  savings_goals: 'savings_goals',
  physical_assets: 'physical_assets',
  pilot_daily_recommendations: 'pilot_daily_recommendations',
  pilot_emotional_checkins: 'pilot_emotional_checkins',
  org_pilot_aggregates: 'org_pilot_aggregates',
  budget_safe_style_expenses: 'budget_safe_style_expenses',
  financial_personality_results: 'financial_personality_results',
  financial_archetype_results: 'financial_archetype_results',
  cash_flow_income: 'cash_flow_income',
} as const;

/** Storage bucket for lesson audio. */
export const STORAGE_BUCKET_LESSON_AUDIO = 'lesson-audio';

/**
 * List documents with optional queries.
 */
export async function listDocuments<T = Record<string, unknown>>(
  collectionId: string,
  queries: string[] = []
) {
  const res = await databases.listDocuments(DATABASE_ID, collectionId, queries);
  return { data: res.documents as T[], total: res.total };
}

/**
 * Get a single document by ID.
 */
export async function getDocument<T = Record<string, unknown>>(
  collectionId: string,
  documentId: string
) {
  const doc = await databases.getDocument(DATABASE_ID, collectionId, documentId);
  return doc as unknown as T;
}

/**
 * Create a document. Pass documentId for custom ID (e.g. user id for profiles), or omit for auto ID.
 */
export async function createDocument(
  collectionId: string,
  data: Record<string, unknown>,
  documentId?: string,
  permissions?: string[]
) {
  const id = documentId ?? ID.unique();
  return databases.createDocument(DATABASE_ID, collectionId, id, data, permissions);
}

/**
 * Update a document.
 */
export async function updateDocument(
  collectionId: string,
  documentId: string,
  data: Record<string, unknown>
) {
  return databases.updateDocument(DATABASE_ID, collectionId, documentId, data);
}

/**
 * Delete a document.
 */
export async function deleteDocument(collectionId: string, documentId: string) {
  return databases.deleteDocument(DATABASE_ID, collectionId, documentId);
}

/**
 * Execute an Appwrite Function by ID. Pass payload as object.
 * Set async to false to wait for response; response is in execution.responseBody (string).
 * Appwrite Cloud rechaza body en la ejecución, así que pasamos el payload por query params (GET).
 */
export async function execFunction(
  functionId: string,
  payload?: Record<string, unknown>,
  async = true
) {
  if (!payload || Object.keys(payload).length === 0) {
    return functions.createExecution(functionId, undefined, async);
  }
  const search = new URLSearchParams(
    Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, v != null ? String(v) : ''])
    )
  ).toString();
  const path = search ? `/?${search}` : '/';
  return functions.createExecution(
    functionId,
    undefined,
    async,
    path,
    ExecutionMethod.GET
  );
}

/** Appwrite document shape (SDK returns $id, $createdAt, $updatedAt, $permissions, plus attribute keys). */
export type AppwriteDocument = Record<string, unknown> & {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
};

/**
 * Map Appwrite document to app row shape: id from $id, created_at/updated_at from $createdAt/$updatedAt.
 */
export function docToRow<T extends AppwriteDocument>(doc: T): T & { id: string } {
  if (!doc) return doc as T & { id: string };
  const { $id, $createdAt, $updatedAt, $permissions, ...rest } = doc;
  return {
    ...rest,
    id: ($id ?? (rest as Record<string, unknown>).id) as string,
    ...($createdAt != null && { created_at: $createdAt }),
    ...($updatedAt != null && { updated_at: $updatedAt }),
  } as T & { id: string };
}
