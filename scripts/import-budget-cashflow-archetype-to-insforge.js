/**
 * import-budget-cashflow-archetype-to-insforge.js
 * Importa CSVs de Appwrite (Cash Flow Income, Budgets, Budget Safe Style Expenses,
 * Budget Items, Financial Archetype Results) a InsForge usando id_map.json para
 * vincular user_id, org_id, budget_id, category_id.
 *
 * Uso:
 *   node scripts/import-budget-cashflow-archetype-to-insforge.js [dir-o-ruta-csv...]
 * Si se pasa un directorio: busca en él los CSV por nombre.
 * Si se pasan 5 rutas: cash_flow, budgets, safe_style, budget_items, archetype (en ese orden).
 *
 * Requiere: INSFORGE_POSTGRES_URL en .env
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const INSFORGE_PG_URL = process.env.INSFORGE_POSTGRES_URL;
if (!INSFORGE_PG_URL) {
    console.error('Falta INSFORGE_POSTGRES_URL en .env');
    process.exit(1);
}

const ID_MAP_PATH = path.join(__dirname, '../data_import_ready/id_map.json');
const DEFAULT_DIR = path.join(__dirname, '../data_import_ready');

// Optional: id_map UUID -> real InsForge profile/org ID (same as import-categories-csv-to-insforge.js)
const ORG_ID_MAP = {
    'ac771ead-9257-420f-ac77-2a536ca1fa1c': '56081a62-a2ca-4e3a-98a0-9d46b3f31a48',
    'c0145c29-c470-4808-8ab2-79dc205bdb49': 'aea04c03-c0ef-454d-8e40-3244ecccae76',
    '7d8b7c64-f085-4465-9395-f638cf23c402': 'ef00e3d9-f04b-4b52-b227-ec40501e2dea'
};
const USER_ID_MAP = {
    'cf9c7934-3250-4872-b9b0-45dcde81068f': 'cea18be7-7ff7-4f17-b521-e75b7c0e3ebf',
    '623c41f6-d551-4827-8926-8b891ca27d88': '93ba976c-246f-4134-a669-1cbffa18cc2a',
    '9a859aff-89e0-4e51-b8de-af1910615247': 'ebc555f0-861a-42c2-a5f0-e040734272e1',
    '89025497-0a0d-43ff-a52a-b051d3740f83': '75061774-ac00-46f3-b75e-600f2afb0d27',
    'c8235dce-1f70-4d95-aa6e-943d9005b0d3': 'e9d2e222-0fa5-4ded-ab5d-cf29b1a38e4d',
    '206c4c7f-a673-4fe0-967e-ecce0f0124ec': '4f47598b-ca54-462e-a7b5-563f4860fc36',
    '905a1bd1-5baf-4e52-8255-e0e0041cc632': '1d8cc04a-9daa-4613-8b9b-5d7e03b84a52',
    '6f27d2f7-7bed-42ed-882a-82f85b7690b5': 'a69ab7b1-83d2-4996-b012-cb7267b018b8',
    '1fc7ff42-c4d4-460a-a2ba-fa38ad56cf07': 'b1899601-91ac-4406-8540-55b429b6fd9f'
};

function resolveUserId(idMap, appwriteUserId) {
    const u = idMap[appwriteUserId] || null;
    return u ? (USER_ID_MAP[u] || u) : null;
}
function resolveOrgId(idMap, appwriteOrgId) {
    const o = idMap[appwriteOrgId] || null;
    return o ? (ORG_ID_MAP[o] || o) : null;
}

const pool = new Pool({
    connectionString: INSFORGE_PG_URL,
    ssl: process.env.INSFORGE_POSTGRES_SSL !== 'false' ? { rejectUnauthorized: false } : false
});

function genUUID() {
    return crypto.randomUUID();
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (!inQuotes && c === ',') {
            result.push(current.trim());
            current = '';
            continue;
        }
        current += c;
    }
    result.push(current.trim());
    return result;
}

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const header = parseCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        header.forEach((h, idx) => {
            let v = values[idx];
            if (v === undefined) v = '';
            if (v === 'null' || v === '') v = null;
            row[h] = v;
        });
        rows.push(row);
    }
    return rows;
}

function findCsvInDir(dir, substring) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    const files = fs.readdirSync(dir);
    const match = files.find((f) => f.includes(substring) && f.endsWith('.csv'));
    return match ? path.join(dir, match) : null;
}

function resolvePaths(argv) {
    const args = argv.slice(2).filter(Boolean);
    if (args.length >= 5) {
        return {
            cashFlow: args[0],
            budgets: args[1],
            safeStyle: args[2],
            budgetItems: args[3],
            archetype: args[4]
        };
    }
    const dir = args.length === 1 ? args[0] : DEFAULT_DIR;
    return {
        cashFlow: findCsvInDir(dir, 'Cash Flow Income') || path.join(dir, 'Cash Flow Income.csv'),
        budgets: findCsvInDir(dir, 'Budgets_') || path.join(dir, 'Budgets.csv'),
        safeStyle: findCsvInDir(dir, 'Budget Safe Style') || path.join(dir, 'Budget Safe Style Expenses.csv'),
        budgetItems: findCsvInDir(dir, 'Budget Items_') || path.join(dir, 'Budget Items.csv'),
        archetype: findCsvInDir(dir, 'Financial Archetype Results') || path.join(dir, 'Financial Archetype Results.csv')
    };
}

function toNum(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
}

function toTimestamp(v, fallback) {
    if (v == null || v === '') return fallback || null;
    const s = String(v).trim();
    return s || fallback || null;
}

function nullable(val) {
    if (val == null || val === '' || val === 'null') return null;
    return val;
}

async function importCashFlowIncome(pool, idMap, csvPath) {
    if (!fs.existsSync(csvPath)) {
        console.log('Omitido (no existe):', csvPath);
        return { inserted: 0, skipped: 0 };
    }
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    let inserted = 0;
    let skipped = 0;
    const cols = ['id', 'user_id', 'org_id', 'month', 'source_type', 'amount', 'note', 'created_at'];
    for (const row of rows) {
        const userId = resolveUserId(idMap, row.user_id);
        const orgId = resolveOrgId(idMap, row.org_id);
        if (!userId || !orgId) {
            skipped++;
            continue;
        }
        const id = idMap[row['$id']] || genUUID();
        const amount = toNum(row.amount);
        if (amount == null) {
            skipped++;
            continue;
        }
        const createdAt = toTimestamp(row.created_at || row.$createdAt) || new Date().toISOString();
        const values = [
            id,
            userId,
            orgId,
            nullable(row.month) || '',
            nullable(row.source_type) || '',
            amount,
            nullable(row.note),
            createdAt
        ];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        try {
            const res = await pool.query(
                `INSERT INTO cash_flow_income (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
                values
            );
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            console.error('cash_flow_income:', row['$id'], (err && (err.message || err.code || String(err))));
        }
    }
    return { inserted, skipped };
}

async function importBudgets(pool, idMap, csvPath) {
    if (!fs.existsSync(csvPath)) {
        console.log('Omitido (no existe):', csvPath);
        return { inserted: 0, skipped: 0 };
    }
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    let inserted = 0;
    let skipped = 0;
    const cols = ['id', 'org_id', 'user_id', 'month', 'name', 'created_at'];
    for (const row of rows) {
        const orgId = resolveOrgId(idMap, row.org_id);
        const userId = resolveUserId(idMap, row.user_id);
        if (!userId || !orgId) {
            skipped++;
            continue;
        }
        const id = idMap[row['$id']] || genUUID();
        const createdAt = toTimestamp(row.created_at || row.$createdAt) || new Date().toISOString();
        const values = [
            id,
            orgId,
            userId,
            nullable(row.month) || '',
            nullable(row.name) || 'Presupuesto',
            createdAt
        ];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        try {
            const res = await pool.query(
                `INSERT INTO budgets (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
                values
            );
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            console.error('budgets:', row['$id'], err.message, err.detail || '');
        }
    }
    return { inserted, skipped };
}

async function importBudgetSafeStyleExpenses(pool, idMap, csvPath) {
    if (!fs.existsSync(csvPath)) {
        console.log('Omitido (no existe):', csvPath);
        return { inserted: 0, skipped: 0 };
    }
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    let inserted = 0;
    let skipped = 0;
    const cols = ['id', 'user_id', 'org_id', 'month', 'category', 'subcategory', 'amount', 'budget_type', 'note', 'created_at'];
    for (const row of rows) {
        const userId = resolveUserId(idMap, row.user_id);
        const orgId = resolveOrgId(idMap, row.org_id);
        if (!userId || !orgId) {
            skipped++;
            continue;
        }
        const id = idMap[row['$id']] || genUUID();
        const amount = toNum(row.amount);
        if (amount == null) {
            skipped++;
            continue;
        }
        const createdAt = toTimestamp(row.created_at || row.$createdAt) || new Date().toISOString();
        const values = [
            id,
            userId,
            orgId,
            nullable(row.month) || '',
            nullable(row.category) || '',
            nullable(row.subcategory) || '',
            amount,
            nullable(row.budget_type),
            nullable(row.note),
            createdAt
        ];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        try {
            const res = await pool.query(
                `INSERT INTO budget_safe_style_expenses (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
                values
            );
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            console.error('budget_safe_style_expenses:', row['$id'], err.message, err.detail || '');
        }
    }
    return { inserted, skipped };
}

async function importFinancialArchetypeResults(pool, idMap, csvPath) {
    if (!fs.existsSync(csvPath)) {
        console.log('Omitido (no existe):', csvPath);
        return { inserted: 0, skipped: 0 };
    }
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    let inserted = 0;
    let skipped = 0;
    const cols = ['id', 'user_id', 'org_id', 'archetype_type', 'answers', 'dominant_archetype', 'secondary_archetype', 'tertiary_archetype', 'scores', 'completed_at', 'created_at'];
    for (const row of rows) {
        const userId = resolveUserId(idMap, row.user_id);
        const orgId = resolveOrgId(idMap, row.org_id);
        if (!userId || !orgId) {
            skipped++;
            continue;
        }
        const id = idMap[row['$id']] || genUUID();
        const dominant = nullable(row.dominant_archetype) || '';
        let scoresJson = null;
        if (row.scores) {
            try {
                scoresJson = JSON.parse(String(row.scores).replace(/""/g, '"'));
            } catch {
                scoresJson = null;
            }
        }
        const completedAt = toTimestamp(row.completed_at);
        const createdAt = toTimestamp(row.created_at || row.$createdAt) || new Date().toISOString();
        const values = [
            id,
            userId,
            orgId,
            dominant,
            scoresJson,
            dominant,
            nullable(row.secondary_archetype),
            nullable(row.tertiary_archetype),
            scoresJson,
            completedAt,
            createdAt
        ];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        try {
            const res = await pool.query(
                `INSERT INTO financial_archetype_results (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
                values
            );
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            console.error('financial_archetype_results:', row['$id'], err.message, err.detail || '');
        }
    }
    return { inserted, skipped };
}

async function importBudgetItems(pool, idMap, csvPath) {
    if (!fs.existsSync(csvPath)) {
        console.log('Omitido (no existe):', csvPath);
        return { inserted: 0, skipped: 0 };
    }
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    let inserted = 0;
    let skipped = 0;
    const cols = ['id', 'budget_id', 'category_id', 'limit_amount', 'created_at'];
    for (const row of rows) {
        const budgetId = idMap[row.budget_id] || null;
        const categoryId = idMap[row.category_id] || null;
        if (!budgetId || !categoryId) {
            skipped++;
            continue;
        }
        const id = idMap[row['$id']] || genUUID();
        const limitAmount = toNum(row.limit_amount);
        if (limitAmount == null) {
            skipped++;
            continue;
        }
        const createdAt = toTimestamp(row.created_at || row.$createdAt) || new Date().toISOString();
        const values = [id, budgetId, categoryId, limitAmount, createdAt];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        try {
            const res = await pool.query(
                `INSERT INTO budget_items (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
                values
            );
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            console.error('budget_items:', row['$id'], err.message, err.detail || '');
        }
    }
    return { inserted, skipped };
}

async function main() {
    let idMap = {};
    if (fs.existsSync(ID_MAP_PATH)) {
        idMap = JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf8'));
        console.log('id_map.json cargado:', Object.keys(idMap).length, 'entradas');
    } else {
        console.error('No se encontró', ID_MAP_PATH);
        process.exit(1);
    }

    const paths = resolvePaths(process.argv);
    console.log('CSVs:', paths);

    const results = {};

    console.log('\n1. Cash Flow Income...');
    results.cashFlow = await importCashFlowIncome(pool, idMap, paths.cashFlow);
    console.log('   Insertadas:', results.cashFlow.inserted, 'Omitidas:', results.cashFlow.skipped);

    console.log('\n2. Budgets...');
    results.budgets = await importBudgets(pool, idMap, paths.budgets);
    console.log('   Insertadas:', results.budgets.inserted, 'Omitidas:', results.budgets.skipped);

    console.log('\n3. Budget Safe Style Expenses...');
    results.safeStyle = await importBudgetSafeStyleExpenses(pool, idMap, paths.safeStyle);
    console.log('   Insertadas:', results.safeStyle.inserted, 'Omitidas:', results.safeStyle.skipped);

    console.log('\n4. Financial Archetype Results...');
    results.archetype = await importFinancialArchetypeResults(pool, idMap, paths.archetype);
    console.log('   Insertadas:', results.archetype.inserted, 'Omitidas:', results.archetype.skipped);

    console.log('\n5. Budget Items...');
    results.budgetItems = await importBudgetItems(pool, idMap, paths.budgetItems);
    console.log('   Insertadas:', results.budgetItems.inserted, 'Omitidas:', results.budgetItems.skipped);

    console.log('\nListo.');
    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
