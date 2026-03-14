/**
 * import-transactions-csv-to-insforge.js
 * Lee un CSV de transacciones exportado de Appwrite, mapea IDs (usuarios, cuentas,
 * categorías, org) con data_import_ready/id_map.json e inserta en Insforge.
 *
 * Uso: node scripts/import-transactions-csv-to-insforge.js [ruta-al-csv]
 * Ejemplo: node scripts/import-transactions-csv-to-insforge.js "C:\Users\...\Transactions_2026-03-13_13-47-40.csv"
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

const CSV_PATH = process.argv[2] || path.join(__dirname, '../data_import_ready/transactions.csv');
const ID_MAP_PATH = path.join(__dirname, '../data_import_ready/id_map.json');

// id_map UUID -> ID real en InsForge (organizaciones y perfiles ya existen con otros UUIDs)
const ORG_ID_MAP = {
    'ac771ead-9257-420f-ac77-2a536ca1fa1c': '56081a62-a2ca-4e3a-98a0-9d46b3f31a48',
    'c0145c29-c470-4808-8ab2-79dc205bdb49': 'aea04c03-c0ef-454d-8e40-3244ecccae76',
    '7d8b7c64-f085-4465-9395-f638cf23c402': 'ef00e3d9-f04b-4b52-b227-ec40501e2dea',
};
const USER_ID_MAP = {
    'cf9c7934-3250-4872-b9b0-45dcde81068f': 'cea18be7-7ff7-4f17-b521-e75b7c0e3ebf',
    '623c41f6-d551-4827-8926-8b891ca27d88': '93ba976c-246f-4134-a669-1cbffa18cc2a',
    '9a859aff-89e0-4e51-b8de-af1910615247': 'ebc555f0-861a-42c2-a5f0-e040734272e1',
    '89025497-0a0d-43ff-a52a-b051d3740f83': '75061774-ac00-46f3-b75e-600f2afb0d27',
    'c8235dce-1f70-4d95-aa6e-943d9005b0d3': 'e9d2e222-0fa5-4ded-ab5d-cf29b1a38e4d',
    '206c4c7f-a673-4fe0-967e-ecce0f0124ec': '4f47598b-ca54-462e-a7b5-563f4860fc36',
    '900cfc54-2551-4271-b849-190402082b62': '0dda8d95-cf73-4844-9288-452da50ca167',
    '905a1bd1-5baf-4e52-8255-e0e0041cc632': '1d8cc04a-9daa-4613-8b9b-5d7e03b84a52',
    '6f27d2f7-7bed-42ed-882a-82f85b7690b5': 'a69ab7b1-83d2-4996-b012-cb7267b018b8',
    '1fc7ff42-c4d4-460a-a2ba-fa38ad56cf07': 'b1899601-91ac-4406-8540-55b429b6fd9f',
};

const pool = new Pool({
    connectionString: INSFORGE_PG_URL,
    ssl: process.env.INSFORGE_POSTGRES_SSL !== 'false' ? { rejectUnauthorized: false } : false
});

function genUUID() {
    return crypto.randomUUID();
}

/**
 * Parsea una línea CSV respetando comillas dobles (campos con comas).
 */
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

async function main() {
    let idMap = {};
    if (fs.existsSync(ID_MAP_PATH)) {
        idMap = JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf8'));
        console.log('id_map.json cargado:', Object.keys(idMap).length, 'entradas');
    } else {
        console.error('No se encontró', ID_MAP_PATH);
        process.exit(1);
    }

    if (!fs.existsSync(CSV_PATH)) {
        console.error('No se encontró el CSV:', CSV_PATH);
        console.log('Uso: node scripts/import-transactions-csv-to-insforge.js <ruta-transacciones.csv>');
        process.exit(1);
    }

    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parseCSV(csvContent);
    console.log('Filas en CSV:', rows.length);

    const cols = [
        'id', 'org_id', 'user_id', 'account_id', 'kind', 'amount', 'occurred_at',
        'category_id', 'note', 'transfer_account_id', 'is_recurring', 'recurrence_period',
        'recurrence_day_of_month', 'recurrence_interval_months', 'recurrence_total_occurrences',
        'expense_label', 'is_scheduled', 'created_at'
    ];

    let inserted = 0;
    let skipped = 0;
    const missingFk = { user_id: 0, org_id: 0, account_id: 0 };

    for (const row of rows) {
        const oldId = row['$id'];
        const mappedOrgId = idMap[row.org_id] || null;
        const mappedUserId = idMap[row.user_id] || null;
        const orgId = mappedOrgId ? (ORG_ID_MAP[mappedOrgId] || mappedOrgId) : null;
        const userId = mappedUserId ? (USER_ID_MAP[mappedUserId] ?? mappedUserId) : null;
        const accountId = idMap[row.account_id] || null;
        const categoryId = row.category_id ? (idMap[row.category_id] || null) : null;
        const transferAccountId = row.transfer_account_id ? (idMap[row.transfer_account_id] || null) : null;

        if (!userId) {
            missingFk.user_id++;
            skipped++;
            continue;
        }
        if (!orgId) {
            missingFk.org_id++;
            skipped++;
            continue;
        }
        if (!accountId) {
            missingFk.account_id++;
            skipped++;
            continue;
        }

        const id = idMap[oldId] || genUUID();
        const amount = row.amount != null && row.amount !== '' ? parseFloat(row.amount) : 0;
        const isRecurring = row.is_recurring === 'true';
        const recurrenceDay = row.recurrence_day_of_month ? parseInt(row.recurrence_day_of_month, 10) : null;
        const recurrenceInterval = row.recurrence_interval_months ? parseInt(row.recurrence_interval_months, 10) : null;
        const recurrenceTotal = row.recurrence_total_occurrences ? parseInt(row.recurrence_total_occurrences, 10) : null;
        const isScheduled = row.is_scheduled === 'true';

        const createdAt = row.$createdAt || row.created_at || new Date().toISOString();
        const note = (row.note != null && row.note !== '' && row.note !== 'null') ? row.note : null;

        const values = [
            id, orgId, userId, accountId, row.kind || 'EXPENSE', amount,
            row.occurred_at || createdAt,
            categoryId, note, transferAccountId,
            isRecurring, (row.recurrence_period && row.recurrence_period !== 'null') ? row.recurrence_period : null,
            recurrenceDay, recurrenceInterval, recurrenceTotal,
            (row.expense_label && row.expense_label !== 'null') ? row.expense_label : null,
            isScheduled, createdAt
        ];

        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = cols.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
        const query = `INSERT INTO transactions (${cols.join(', ')}) VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET ${updateSet}`;

        try {
            const res = await pool.query(query, values);
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            console.error('Error insertando transacción', oldId, err.message, err.detail || '', err.code || '');
        }
    }

    console.log('Listo.');
    console.log('Insertadas o actualizadas (con category_id):', inserted);
    console.log('Omitidas (FK faltante):', skipped);
    if (missingFk.user_id || missingFk.org_id || missingFk.account_id) {
        console.log('Faltantes en id_map: user_id', missingFk.user_id, 'org_id', missingFk.org_id, 'account_id', missingFk.account_id);
    }
    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
