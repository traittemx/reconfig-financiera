/**
 * Genera SQL INSERT para transacciones (desde CSV + id_map) para ejecutar vía MCP run-raw-sql.
 * Uso: node scripts/generate-transactions-import-sql.js [ruta-csv] [ruta-id-map]
 * Salida: SQL por lotes de 25 filas, separados por ";\n---BATCH---\n"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CSV_PATH = process.argv[2] || path.join(__dirname, '../data_import_ready/transactions_appwrite_2026-03-13.csv');
const ID_MAP_PATH = process.argv[3] || path.join(__dirname, '../data_import_ready/id_map.json');

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

function sqlEscape(s) {
    if (s == null || s === '') return 'NULL';
    return "'" + String(s).replace(/'/g, "''") + "'";
}

const idMap = JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf8'));
const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(csvContent);

const BATCH_SIZE = 25;
const batches = [];
let currentBatch = [];

for (const row of rows) {
    const orgId = idMap[row.org_id];
    const userId = idMap[row.user_id];
    const accountId = idMap[row.account_id];
    if (!userId || !orgId || !accountId) continue;

    const id = idMap[row['$id']] || crypto.randomUUID();
    const categoryId = row.category_id ? idMap[row.category_id] : null;
    const transferAccountId = row.transfer_account_id ? idMap[row.transfer_account_id] : null;
    const amount = row.amount != null && row.amount !== '' ? parseFloat(row.amount) : 0;
    const isRecurring = row.is_recurring === 'true';
    const recurrenceDay = row.recurrence_day_of_month ? parseInt(row.recurrence_day_of_month, 10) : null;
    const recurrenceInterval = row.recurrence_interval_months ? parseInt(row.recurrence_interval_months, 10) : null;
    const recurrenceTotal = row.recurrence_total_occurrences ? parseInt(row.recurrence_total_occurrences, 10) : null;
    const isScheduled = row.is_scheduled === 'true';
    const createdAt = row['$createdAt'] || row.created_at || new Date().toISOString();
    const occurredAt = row.occurred_at || createdAt;
    const note = (row.note != null && row.note !== '' && row.note !== 'null') ? row.note : null;
    const recurrencePeriod = (row.recurrence_period && row.recurrence_period !== 'null') ? row.recurrence_period : null;
    const expenseLabel = (row.expense_label && row.expense_label !== 'null') ? row.expense_label : null;

    const valueRow = [
        sqlEscape(id),
        sqlEscape(orgId),
        sqlEscape(userId),
        sqlEscape(accountId),
        sqlEscape(row.kind || 'EXPENSE'),
        amount,
        sqlEscape(occurredAt),
        categoryId ? sqlEscape(categoryId) : 'NULL',
        note !== null ? sqlEscape(note) : 'NULL',
        transferAccountId ? sqlEscape(transferAccountId) : 'NULL',
        isRecurring,
        recurrencePeriod ? sqlEscape(recurrencePeriod) : 'NULL',
        (recurrenceDay != null ? recurrenceDay : 'NULL'),
        (recurrenceInterval != null ? recurrenceInterval : 'NULL'),
        (recurrenceTotal != null ? recurrenceTotal : 'NULL'),
        expenseLabel ? sqlEscape(expenseLabel) : 'NULL',
        isScheduled,
        sqlEscape(createdAt)
    ].join(',');

    currentBatch.push(`(${valueRow})`);
    if (currentBatch.length >= BATCH_SIZE) {
        batches.push(
            `INSERT INTO transactions (id,org_id,user_id,account_id,kind,amount,occurred_at,category_id,note,transfer_account_id,is_recurring,recurrence_period,recurrence_day_of_month,recurrence_interval_months,recurrence_total_occurrences,expense_label,is_scheduled,created_at) VALUES ${currentBatch.join(',')} ON CONFLICT (id) DO UPDATE SET org_id=EXCLUDED.org_id,user_id=EXCLUDED.user_id,account_id=EXCLUDED.account_id,kind=EXCLUDED.kind,amount=EXCLUDED.amount,occurred_at=EXCLUDED.occurred_at,category_id=EXCLUDED.category_id,note=EXCLUDED.note,transfer_account_id=EXCLUDED.transfer_account_id,is_recurring=EXCLUDED.is_recurring,recurrence_period=EXCLUDED.recurrence_period,recurrence_day_of_month=EXCLUDED.recurrence_day_of_month,recurrence_interval_months=EXCLUDED.recurrence_interval_months,recurrence_total_occurrences=EXCLUDED.recurrence_total_occurrences,expense_label=EXCLUDED.expense_label,is_scheduled=EXCLUDED.is_scheduled,created_at=EXCLUDED.created_at`
        );
        currentBatch = [];
    }
}
if (currentBatch.length > 0) {
    batches.push(
        `INSERT INTO transactions (id,org_id,user_id,account_id,kind,amount,occurred_at,category_id,note,transfer_account_id,is_recurring,recurrence_period,recurrence_day_of_month,recurrence_interval_months,recurrence_total_occurrences,expense_label,is_scheduled,created_at) VALUES ${currentBatch.join(',')} ON CONFLICT (id) DO UPDATE SET org_id=EXCLUDED.org_id,user_id=EXCLUDED.user_id,account_id=EXCLUDED.account_id,kind=EXCLUDED.kind,amount=EXCLUDED.amount,occurred_at=EXCLUDED.occurred_at,category_id=EXCLUDED.category_id,note=EXCLUDED.note,transfer_account_id=EXCLUDED.transfer_account_id,is_recurring=EXCLUDED.is_recurring,recurrence_period=EXCLUDED.recurrence_period,recurrence_day_of_month=EXCLUDED.recurrence_day_of_month,recurrence_interval_months=EXCLUDED.recurrence_interval_months,recurrence_total_occurrences=EXCLUDED.recurrence_total_occurrences,expense_label=EXCLUDED.expense_label,is_scheduled=EXCLUDED.is_scheduled,created_at=EXCLUDED.created_at`
    );
}

const outPath = path.join(__dirname, '../data_import_ready/transactions_import_batches.txt');
fs.writeFileSync(outPath, batches.join(';\n---BATCH---\n'), 'utf8');
console.log('Written', batches.length, 'batches to', outPath);
console.log('Total rows mapped:', rows.filter(r => idMap[r.user_id] && idMap[r.org_id] && idMap[r.account_id]).length);
