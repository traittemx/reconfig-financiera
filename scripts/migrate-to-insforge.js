/**
 * navigate-to-insforge.js
 * Migrates data from Appwrite collections to InsForge PostgreSQL.
 */
const { Client, Databases, Query } = require('node-appwrite');
const { Pool } = require('pg');
require('dotenv').config();

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = 'finaria';
const INSFORGE_PG_URL = process.env.INSFORGE_POSTGRES_URL;

const appwrite = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setKey(APPWRITE_KEY);

const db = new Databases(appwrite);
const pool = new Pool({
    connectionString: INSFORGE_PG_URL,
    ssl: { rejectUnauthorized: false }
});

// Debug connection
pool.connect().then(client => {
    console.log('Postgres connected successfully');
    client.release();
}).catch(err => {
    console.error('Postgres connection ERROR:', err);
});

console.log('Appwrite Endpoint:', APPWRITE_ENDPOINT);
console.log('Appwrite Key (Masked):', APPWRITE_KEY ? APPWRITE_KEY.substring(0, 5) + '...' : 'UNDEFINED');
console.log('Postgres URL (Masked):', INSFORGE_PG_URL ? INSFORGE_PG_URL.replace(/:[^:@]+@/, ':***@') : 'UNDEFINED');

const SCHEMA = {
    organizations: ['id', 'name', 'slug', 'linking_code', 'created_at'],
    profiles: ['id', 'full_name', 'org_id', 'role', 'start_date', 'avatar_url', 'created_at', 'updated_at'],
    org_members: ['id', 'org_id', 'user_id', 'role_in_org', 'status', 'created_at'],
    lessons: ['day', 'title', 'summary', 'mission', 'audio_url'], // ID is serial, excludes it
    user_lesson_progress: ['id', 'user_id', 'lesson_id', 'day', 'org_id', 'unlocked_at', 'completed_at', 'notes'],
    accounts: ['id', 'user_id', 'org_id', 'name', 'type', 'currency', 'opening_balance', 'cut_off_day', 'payment_day', 'credit_limit', 'created_at'],
    categories: ['id', 'org_id', 'user_id', 'kind', 'name', 'parent_id', 'is_default', 'icon', 'color', 'created_at'],
    transactions: ['id', 'org_id', 'user_id', 'account_id', 'kind', 'amount', 'occurred_at', 'category_id', 'note', 'transfer_account_id', 'is_recurring', 'recurrence_period', 'recurrence_day_of_month', 'recurrence_interval_months', 'recurrence_total_occurrences', 'expense_label', 'is_scheduled', 'created_at'],
    budgets: ['id', 'org_id', 'user_id', 'month', 'name', 'created_at'],
    budget_items: ['id', 'budget_id', 'category_id', 'limit_amount', 'created_at'],
    points_rules: ['key', 'points', 'is_active'],
    points_events: ['id', 'org_id', 'user_id', 'event_key', 'points', 'ref_table', 'ref_id', 'created_at'],
    points_totals: ['org_id', 'user_id', 'total_points', 'updated_at'],
    savings_goals: ['id', 'account_id', 'name', 'target_amount', 'target_date', 'created_at', 'updated_at'],
    physical_assets: ['id', 'user_id', 'org_id', 'name', 'amount', 'created_at'],
    pilot_daily_recommendations: ['id', 'user_id', 'org_id', 'recommendation_date', 'state', 'message_main', 'message_why', 'suggested_limit', 'suggested_action', 'flexibility', 'signals_snapshot', 'created_at'],
    pilot_emotional_checkins: ['id', 'user_id', 'checkin_date', 'value', 'created_at']
};

const ORDERED_COLLECTIONS = [
    'organizations',
    'profiles',
    'org_members',
    'lessons',
    'user_lesson_progress',
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'budget_items',
    'points_rules', // seeded?
    'points_events',
    'points_totals',
    'savings_goals',
    'physical_assets',
    'pilot_daily_recommendations',
    'pilot_emotional_checkins'
];

// Map OldID -> NewUUID
let ID_MAP = {};

async function fetchAllDocuments(collectionName) {
    let cursor = null;
    let allDocs = [];
    while (true) {
        const queries = [Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        try {
            const res = await db.listDocuments(DATABASE_ID, collectionName, queries);
            if (res.documents.length === 0) break;
            allDocs.push(...res.documents);
            cursor = res.documents[res.documents.length - 1].$id;
        } catch (e) {
            console.warn(`Failed to list ${collectionName}:`, e.message);
            break;
        }
    }
    return allDocs;
}

// Simple UUID generator for Node < 14 (or just use crypto)
const crypto = require('crypto');
function genUUID() {
    return crypto.randomUUID();
}

async function migrateCollection(name) {
    console.log(`Migrating ${name}...`);
    const docs = await fetchAllDocuments(name);
    console.log(`Found ${docs.length} docs in ${name}`);

    const allowedCols = SCHEMA[name];
    if (!allowedCols) {
        console.warn(`No schema definition for ${name}, skipping.`);
        return;
    }

    for (const doc of docs) {
        try {
            const row = {};
            const oldId = doc.$id;

            // Generate New ID (except specially handled ones)
            let newId = genUUID();

            // SPECIAL: Lessons. ID is Serial. We don't generate UUID.
            // But we might need to map old Id to the Serial one.
            if (name === 'lessons') {
                newId = null; // Let Postgres generate
            }

            ID_MAP[oldId] = newId;

            // Map Columns
            allowedCols.forEach(col => {
                let val = doc[col];

                // FK Mapping Strategy: if column ends in _id, try to map it
                // organization.id is excluded here? No, SCHEMA includes id.
                // But we manually set id below.

                if (col === 'id') return; // Skip, handled manually

                if ((col.endsWith('_id') || col === 'parent_id') && typeof val === 'string') {
                    // Try to map
                    if (ID_MAP[val]) {
                        val = ID_MAP[val];
                    } else {
                        // If not found in map, it might be a user_id that wasn't in profiles?
                        // Or an external ref.
                        // Warning: if val key is not UUID, Postgres will fail.
                        // We must assume if it's not in map, we can't insert it validly if strict UUID.
                        // But maybe it's a new user?
                        // Log warning?
                        // For now, if we can't map it, and it looks like Appwrite ID (20 chars), we set to NULL or generate a fake one?
                        // Setting to NULL might violate constraints.
                        if (val.length === 20 && !val.includes('-')) {
                            console.warn(`Warning: Unmapped FK ${col}=${val} in ${name} ${oldId}`);
                            // Dangerous: insert might fail.
                        }
                    }
                }

                if (val !== undefined) row[col] = val;
            });

            if (name !== 'lessons') {
                row.id = newId;
            }

            // Timestamp mapping
            if (allowedCols.includes('created_at')) row.created_at = doc.$createdAt || doc.created_at;
            if (allowedCols.includes('updated_at')) row.updated_at = doc.$updatedAt || doc.updated_at;

            // Special: Lessons logic (same as before)
            if (name === 'lessons') {
                const day = doc.day;
                const existing = await pool.query('SELECT id FROM lessons WHERE day = $1', [day]);
                if (existing.rows.length > 0) {
                    ID_MAP[oldId] = existing.rows[0].id;
                    continue;
                }
            }

            // Construct Insert
            const cols = Object.keys(row);
            if (cols.length === 0) continue;

            const vals = Object.values(row).map(v => {
                if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v);
                return v;
            });
            const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

            let query = `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`;

            if (name === 'lessons') query += ` RETURNING id`;
            else if (name === 'points_rules') { // points_rules uses 'key' as PK, not 'id'
                query += ` ON CONFLICT (key) DO NOTHING`;
            } else if (name === 'user_lesson_progress') { // user_lesson_progress uses (user_id, lesson_id) as PK
                query += ` ON CONFLICT (user_id, lesson_id) DO NOTHING`;
            }
            else { // Default for tables with UUID 'id' as PK
                query += ` ON CONFLICT (id) DO NOTHING`;
            }

            const res = await pool.query(query, vals);

            if (name === 'lessons' && res.rows.length > 0) {
                ID_MAP[oldId] = res.rows[0].id;
            }

        } catch (err) {
            console.error(`Error migrating ${name} doc ${doc.$id}:`, err);
            const debugInfo = {
                query,
                vals,
                error: err,
                message: err.message,
                stack: err.stack
            };
            require('fs').appendFileSync('migration_error.txt', `${name} ${doc.$id}: ${JSON.stringify(debugInfo, null, 2)}\n`);
        }
    }
}

async function main() {
    try {
        require('fs').writeFileSync('migration_error.txt', ''); // Clear log

        for (const col of ORDERED_COLLECTIONS) {
            await migrateCollection(col);
        }
        console.log('Migration finished.');
    } catch (e) {
        console.error('Fatal:', e);
    } finally {
        await pool.end();
    }
}

main();
