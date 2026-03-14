import { createClient } from '@insforge/sdk';

// Constants compatible with Appwrite
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
    inventory_items: 'inventory_items',
    pilot_daily_recommendations: 'pilot_daily_recommendations',
    pilot_emotional_checkins: 'pilot_emotional_checkins',
    org_pilot_aggregates: 'org_pilot_aggregates',
    budget_safe_style_expenses: 'budget_safe_style_expenses',
    financial_personality_results: 'financial_personality_results',
    financial_archetype_results: 'financial_archetype_results',
    cash_flow_income: 'cash_flow_income',
    transaction_labels: 'transaction_labels',
} as const;

const INSFORGE_URL = process.env.EXPO_PUBLIC_INSFORGE_URL || 'https://m4kkgsr8.us-east.insforge.app';
const INSFORGE_ANON_KEY = process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY || '';

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
    if (!_client) {
        _client = createClient({
            baseUrl: INSFORGE_URL,
            anonKey: INSFORGE_ANON_KEY,
            // Session persistence disabled - will be handled by auth-context cache
            persistSession: false,
            autoRefreshToken: false
        });
    }
    return _client;
}

export const client = new Proxy({} as ReturnType<typeof createClient>, {
    get(_target, prop) {
        return getClient()[prop as keyof ReturnType<typeof createClient>];
    }
});

// --- Compatibility Shims ---

export const ID = {
    unique: () => 'unique()', // Insforge/PostgREST uses uuid_generate_v4() by default if id is omitted or defaults.
    custom: (id: string) => id
};

export const Query = {
    equal: (attr: string, value: any) => {
        if (Array.isArray(value)) {
            return value.length === 1 ? `${attr}=eq.${value[0]}` : `${attr}=in.(${value.join(',')})`;
        }
        return `${attr}=eq.${value}`;
    },
    notEqual: (attr: string, value: any) => `${attr}=neq.${value}`,
    lessThan: (attr: string, value: any) => `${attr}=lt.${value}`,
    lessThanEqual: (attr: string, value: any) => `${attr}=lte.${value}`,
    greaterThan: (attr: string, value: any) => `${attr}=gt.${value}`,
    greaterThanEqual: (attr: string, value: any) => `${attr}=gte.${value}`,
    search: (attr: string, value: any) => `${attr}=ilike.%${value}%`,
    orderDesc: (attr: string) => `order=${attr}.desc`,
    orderAsc: (attr: string) => `order=${attr}.asc`,
    limit: (limit: number) => `limit=${limit}`,
    offset: (offset: number) => `offset=${offset}`,
    cursorAfter: (id: string) => `cursor=${id}`, // Not directly supported in simple translation, might need logic
    isNull: (attr: string) => `${attr}=is.null`,
    isNotNull: (attr: string) => `${attr}=not.is.null`,
};

export const STORAGE_BUCKET_LESSON_AUDIO = 'lesson-audio';

// --- End Shims ---

// Auth implementation
export const account = {
    get: async () => {
        const { data, error } = await client.auth.getCurrentSession();
        if (error) throw error;
        const user = data?.session?.user;
        if (!user) throw new Error('No session');
        const shape = documentToAppwriteShape(user) as Record<string, unknown>;
        const email = (user as { email?: string }).email ?? (user as { email_address?: string }).email_address;
        if (email != null) shape.email = email;
        return shape;
    },
    create: async (userId: string, email: string, pass: string) => {
        const { data, error } = await client.auth.signUp({ email, password: pass });
        if (error) throw error;
        return data;
    },
    createEmailPasswordSession: async (email: string, pass: string) => {
        const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        return data;
    },
    deleteSession: async () => {
        const { error } = await client.auth.signOut();
        if (error) throw error;
        return { success: true };
    },
};

// Database implementation
export const databases = {
    listDocuments: async (dbId: string, collectionId: string, queries: string[] = []) => {
        let query = client.database.from(collectionId).select('*', { count: 'exact' });

        queries.forEach(q => {
            // q is "attr=op.val" from our Query shim
            if (q.startsWith('limit=')) {
                query = query.limit(parseInt(q.split('=')[1]));
            } else if (q.startsWith('offset=')) {
                query = query.range(parseInt(q.split('=')[1]), parseInt(q.split('=')[1]) + 9); // Rough approx if needed
            } else if (q.startsWith('order=')) {
                const [colRaw, dir] = q.split('=')[1].split('.');
                let col = colRaw;
                if (col === '$id') col = 'id';
                else if (col === '$createdAt') col = 'created_at';
                else if (col === '$updatedAt') col = 'updated_at';

                query = query.order(col, { ascending: dir === 'asc' });
            } else if (q.includes('=')) {
                // "attr=op.val"
                const [keyRaw, rest] = q.split('=');
                const [op, ...valParts] = rest.split('.');
                const val = valParts.join('.');

                let key = keyRaw;
                if (key === '$id') key = collectionId === 'org_subscriptions' ? 'org_id' : 'id';
                else if (key === '$createdAt') key = 'created_at';
                else if (key === '$updatedAt') key = 'updated_at';

                if (op === 'eq') query = query.eq(key, val);
                else if (op === 'neq') query = query.neq(key, val);
                else if (op === 'lt') query = query.lt(key, val);
                else if (op === 'lte') query = query.lte(key, val);
                else if (op === 'gt') query = query.gt(key, val);
                else if (op === 'gte') query = query.gte(key, val);
                else if (op === 'ilike') query = query.ilike(key, val); // %val% handled in shim
                else if (op === 'is' && val === 'null') query = query.is(key, null);
                else if (op === 'not' && val === 'is.null') query = query.not(key, 'is', null);
            }
        });

        const { data, error, count } = await query;
        if (error) throw error;
        return { documents: data?.map(docToRow), total: count || 0 };
    },
    getDocument: async (dbId: string, collectionId: string, documentId: string) => {
        const idCol = collectionId === 'points_rules' ? 'key' : collectionId === 'org_subscriptions' ? 'org_id' : 'id';
        const { data, error } = await client.database
            .from(collectionId)
            .select('*')
            .eq(idCol, documentId)
            .single();
        if (error) throw error;
        return docToRow(data);
    },
    createDocument: async (dbId: string, collectionId: string, documentId: string, data: any) => {
        const payload = { ...data };
        if (documentId && documentId !== 'unique()') payload.id = documentId;

        const { data: result, error } = await client.database
            .from(collectionId)
            .insert(payload) // SDK handles single object or array
            .select()
            .single();
        if (error) throw error;
        return docToRow(result);
    },
    updateDocument: async (dbId: string, collectionId: string, documentId: string, data: any) => {
        const idCol = collectionId === 'org_subscriptions' ? 'org_id' : 'id';
        const { data: result, error } = await client.database
            .from(collectionId)
            .update(data)
            .eq(idCol, documentId)
            .select()
            .single();
        if (error) throw error;
        return docToRow(result);
    },
    deleteDocument: async (dbId: string, collectionId: string, documentId: string) => {
        const idCol = collectionId === 'org_subscriptions' ? 'org_id' : 'id';
        const { error } = await client.database
            .from(collectionId)
            .delete()
            .eq(idCol, documentId);
        if (error) throw error;
        return { success: true };
    },
};

// Storage implementation
export const storage = {
    getFileView: (bucketId: string, fileId: string) => ({
        href: `${INSFORGE_URL}/api/storage/buckets/${bucketId}/objects/${fileId}`
    }),
    createFile: async (bucketId: string, fileId: string, file: any) => {
        const { data, error } = await client.storage
            .from(bucketId)
            .upload(fileId, file);
        if (error) throw error;
        return data;
    },
};

export const functions = {
    createExecution: async (functionId: string, data?: string, async = true) => {
        const payload = data ? JSON.parse(data) : {};
        const { data: res, error } = await client.functions.invoke(functionId, payload);
        if (error) throw error;
        return res;
    }
};

// Helpers compatible with appwrite.ts exports
export const DATABASE_ID = 'main';
// COLLECTIONS is already defined above

export async function listDocuments<T>(collectionId: string, queries: string[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    return { data: res.documents as unknown as (T & { id: string })[], total: res.total };
}

export async function getDocument<T>(collectionId: string, documentId: string) {
    return (await databases.getDocument(DATABASE_ID, collectionId, documentId)) as unknown as (T & { id: string });
}

// Function signature compatible with Appwrite's createDocument
export async function createDocument(collectionId: string, data: any, documentId?: string) {
    return databases.createDocument(DATABASE_ID, collectionId, documentId || 'unique()', data);
}

export async function updateDocument(collectionId: string, documentId: string, data: any) {
    return databases.updateDocument(DATABASE_ID, collectionId, documentId, data);
}

export async function deleteDocument(collectionId: string, documentId: string) {
    return databases.deleteDocument(DATABASE_ID, collectionId, documentId);
}

// Function execution
export async function execFunction(functionId: string, payload: any = {}, asyncMode = true) {
    // Map known Appwrite functions to Postgres RPCs
    const rpcMap: Record<string, string> = {
        'award_points': 'award_points',
        'seed_default_categories': 'seed_default_categories',
        'seed_default_accounts': 'seed_default_accounts',
        'seed_default_labels': 'seed_default_labels',
        'validate_linking_code': 'validate_linking_code',
    };

    // Map Appwrite function IDs to InsForge Edge Function slugs
    const functionMap: Record<string, string> = {
        'join_org_with_code': 'join-org-with-code',
        'delete_category': 'delete-category',
    };

    const targetFunctionId = functionMap[functionId] || functionId;

    if (rpcMap[functionId]) {
        const { data, error } = await client.database.rpc(rpcMap[functionId], payload);
        if (error) throw error;
        // Mock Appwrite execution response
        return {
            responseBody: JSON.stringify(data),
            response: JSON.stringify(data),
            status: 'completed',
            statusCode: 200
        };
    }

    // Default to Edge Functions for others
    const { data, error } = await client.functions.invoke(targetFunctionId, payload);
    if (error) throw error;
    // Edge functions typically return data directly, but we need to match Appwrite shape if caller expects it
    return {
        responseBody: typeof data === 'string' ? data : JSON.stringify(data),
        response: typeof data === 'string' ? data : JSON.stringify(data),
        status: 'completed',
        statusCode: 200
    };
}

export type InsForgeDocument = any;
// Maps Insforge (Postgres) row to Appwrite document shape (adding $id for compatibility)
export function docToRow<T>(doc: any): T & { id: string; $id: string } {
    if (!doc) return doc;
    const id = doc.id ?? doc.$id ?? doc.org_id ?? doc.key; // org_subscriptions uses org_id, points_rules uses key
    return { ...doc, id, $id: id }; // Expose both id and $id for max compatibility
}

function documentToAppwriteShape(doc: any) {
    return docToRow(doc);
}

// Alias for compatibility
export type AppwriteDocument = InsForgeDocument;

/**
 * Link a migrated Appwrite profile to the current InsForge auth user by email.
 * Call only with the authenticated user's email and id (newUserId = session user id).
 * Returns the legacy profile id if link was done, null if no migration row or already linked.
 */
export async function tryLinkMigratedProfileByEmail(
    email: string | null | undefined,
    newUserId: string
): Promise<string | null> {
    if (!email || !newUserId) return null;
    const { data, error } = await client.database.rpc('try_link_migrated_profile_by_email', {
        p_email: email.trim(),
        p_new_id: newUserId,
    });
    if (error) return null;
    return data != null ? String(data) : null;
}
