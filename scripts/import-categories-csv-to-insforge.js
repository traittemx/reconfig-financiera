/**
 * Genera SQL INSERT para categorías desde CSV (Appwrite) a InsForge.
 * Usa id_map.json para IDs; reemplaza org_id y user_id por IDs reales de la DB.
 * Ejecutar el SQL generado vía MCP run-raw-sql (o run-remaining-transaction-batches style).
 *
 * Uso: node scripts/import-categories-csv-to-insforge.js [ruta-csv]
 * CSV por defecto: data_import_ready/categories_appwrite.csv o Downloads/Categories_*.csv
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CSV_PATH = process.argv[2] || path.join(__dirname, '../data_import_ready/categories_appwrite.csv');
const ID_MAP_PATH = path.join(__dirname, '../data_import_ready/id_map.json');
const OUT_SQL = path.join(__dirname, '../data_import_ready/categories_import.sql');

// Mismo mapeo que transacciones: id_map UUID -> ID real en InsForge
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

if (!fs.existsSync(CSV_PATH)) {
  console.error('CSV no encontrado:', CSV_PATH);
  process.exit(1);
}

const idMap = JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf8'));
const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(csvContent);

const BATCH_SIZE = 50;
const values = [];

for (const row of rows) {
  const appwriteId = row['$id'];
  const mappedId = idMap[appwriteId] || crypto.randomUUID();
  const mappedOrgId = idMap[row.org_id];
  const mappedUserId = row.user_id ? idMap[row.user_id] : null;
  const realOrgId = mappedOrgId ? (ORG_ID_MAP[mappedOrgId] || mappedOrgId) : null;
  const realUserId = mappedUserId ? (USER_ID_MAP[mappedUserId] ?? mappedUserId) : null;
  const parentId = row.parent_id && row.parent_id !== 'null' ? idMap[row.parent_id] : null;

  if (!realOrgId) continue;

  const kind = row.kind || 'EXPENSE';
  const name = row.name || 'Sin nombre';
  const isDefault = row.is_default === 'true' || row.is_default === true;
  const icon = row.icon != null && row.icon !== '' ? row.icon : null;
  const color = row.color != null && row.color !== '' ? row.color : null;
  const createdAt = row.created_at || row['$createdAt'] || new Date().toISOString();

  values.push(
    [
      sqlEscape(mappedId),
      sqlEscape(realOrgId),
      realUserId ? sqlEscape(realUserId) : 'NULL',
      sqlEscape(kind),
      sqlEscape(name),
      parentId ? sqlEscape(parentId) : 'NULL',
      isDefault,
      icon ? sqlEscape(icon) : 'NULL',
      color ? sqlEscape(color) : 'NULL',
      sqlEscape(createdAt),
    ].join(',')
  );
}

const batches = [];
for (let i = 0; i < values.length; i += BATCH_SIZE) {
  const chunk = values.slice(i, i + BATCH_SIZE);
  batches.push(
    `INSERT INTO categories (id,org_id,user_id,kind,name,parent_id,is_default,icon,color,created_at) VALUES (${chunk.join('),(')}) ON CONFLICT (id) DO NOTHING`
  );
}

const fullSql = batches.join(';\n');
fs.writeFileSync(OUT_SQL, fullSql, 'utf8');
console.log('Written', batches.length, 'batch(es),', values.length, 'rows to', OUT_SQL);
console.log('Run each statement via MCP run-raw-sql (split by ";").');
