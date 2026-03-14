/**
 * Genera SQL para importar organizaciones y cuentas desde CSV (Appwrite) a InsForge.
 * Usa id_map.json para mapear IDs. Ejecutar el SQL generado vía MCP run-raw-sql.
 *
 * Uso: node scripts/import-orgs-accounts-csv-to-insforge.js
 */

const fs = require('fs');
const path = require('path');

const ID_MAP_PATH = path.join(__dirname, '../data_import_ready/id_map.json');
const ORGS_CSV = path.join(__dirname, '../data_import_ready/organizations_appwrite.csv');
const ACCOUNTS_CSV = path.join(__dirname, '../data_import_ready/accounts_appwrite.csv');

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

// Organizations
const orgsContent = fs.readFileSync(ORGS_CSV, 'utf8');
const orgRows = parseCSV(orgsContent);
const orgValues = [];
let firstOrgId = null;
for (const row of orgRows) {
    const id = idMap[row['$id']];
    if (!id) continue;
    if (!firstOrgId) firstOrgId = id;
    orgValues.push([
        sqlEscape(id),
        sqlEscape(row.name),
        sqlEscape(row.slug),
        (row.linking_code != null && row.linking_code !== 'null') ? sqlEscape(row.linking_code) : 'NULL',
        sqlEscape(row.$createdAt || row.created_at || new Date().toISOString())
    ].join(','));
}

// Accounts (org_id NOT NULL en InsForge; si viene vacío usamos primera org)
const accountsContent = fs.readFileSync(ACCOUNTS_CSV, 'utf8');
const accountRows = parseCSV(accountsContent);
const accountValues = [];
for (const row of accountRows) {
    const id = idMap[row['$id']];
    const userId = idMap[row.user_id];
    let orgId = idMap[row.org_id];
    if (!orgId && firstOrgId) orgId = firstOrgId; // cuenta sin org → primera org
    if (!id || !userId || !orgId) continue;
    const openingBalance = row.opening_balance != null && row.opening_balance !== '' ? parseFloat(row.opening_balance) : 0;
    const cutOff = (row.cut_off_day != null && row.cut_off_day !== '' && row.cut_off_day !== 'null') ? parseInt(row.cut_off_day, 10) : null;
    const paymentDay = (row.payment_day != null && row.payment_day !== '' && row.payment_day !== 'null') ? parseInt(row.payment_day, 10) : null;
    const creditLimit = (row.credit_limit != null && row.credit_limit !== '' && row.credit_limit !== 'null') ? parseFloat(row.credit_limit) : null;
    const createdAt = row.$createdAt || row.created_at || new Date().toISOString();
    accountValues.push([
        sqlEscape(id),
        sqlEscape(userId),
        sqlEscape(orgId),
        sqlEscape(row.name),
        sqlEscape(row.type || 'CASH'),
        sqlEscape(row.currency || 'MXN'),
        openingBalance,
        cutOff != null ? cutOff : 'NULL',
        paymentDay != null ? paymentDay : 'NULL',
        creditLimit != null ? creditLimit : 'NULL',
        sqlEscape(createdAt)
    ].join(','));
}

const orgSql = orgValues.length
    ? `INSERT INTO organizations (id,name,slug,linking_code,created_at) VALUES (${orgValues.join('),(')}) ON CONFLICT (id) DO NOTHING`
    : '';
// NOTE: If orgs/profiles already exist in InsForge with different IDs, replace in generated SQL:
// Orgs by slug: empresa-demo, notaria-2, traitte -> use actual IDs from SELECT id,slug FROM organizations.
// Profiles: id_map user_id -> use actual profile id (match by full_name from profiles.json vs DB profiles).
const accountSql = accountValues.length
    ? `INSERT INTO accounts (id,user_id,org_id,name,type,currency,opening_balance,cut_off_day,payment_day,credit_limit,created_at) VALUES (${accountValues.join('),(')}) ON CONFLICT (id) DO NOTHING`
    : '';

const outPath = path.join(__dirname, '../data_import_ready/orgs_accounts_import.sql');
fs.writeFileSync(outPath, [orgSql, accountSql].filter(Boolean).join(';\n') + '\n', 'utf8');
console.log('Organizations:', orgValues.length);
console.log('Accounts:', accountValues.length);
console.log('SQL written to', outPath);
