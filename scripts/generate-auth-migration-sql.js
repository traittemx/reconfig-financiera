/**
 * generate-auth-migration-sql.js
 * Reads appwrite_users.json (id + email) and outputs SQL inserts for auth_migration.
 *
 * Important: When importing profiles to InsForge, use the same legacy_auth_id for profile.id
 * (i.e. the deterministic UUID from stringToUuid(appwrite_user_id)) so that the first-login
 * rekey (try_link_migrated_profile_by_email) can find and link the profile.
 *
 * Run after: node scripts/fetch-appwrite-users.js
 * Output: data_import_ready/auth_migration.sql and auth_migration.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_PATH = path.join(__dirname, '../data_import_ready/appwrite_users.json');
const SQL_OUT = path.join(__dirname, '../data_import_ready/auth_migration.sql');
const JSON_OUT = path.join(__dirname, '../data_import_ready/auth_migration.json');

const NAMESPACE = 'finaria-auth-migration';

/** Deterministic UUID v4-style from string (so same Appwrite id => same UUID across runs). */
function stringToUuid(str) {
  const hash = crypto.createHash('sha256').update(NAMESPACE + str).digest();
  const hex = hash.slice(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hex.slice(18, 22),
    hex.slice(22, 32)
  ].join('-');
}

function main() {
  if (!fs.existsSync(USERS_PATH)) {
    console.error('Missing', USERS_PATH, '- run: node scripts/fetch-appwrite-users.js');
    process.exit(1);
  }
  const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  const rows = [];
  for (const u of users) {
    if (!u.email) continue;
    const legacyAuthId = stringToUuid(u.id);
    rows.push({ legacy_auth_id: legacyAuthId, email: u.email });
  }
  const sqlLines = [
    '-- Auth migration: link legacy Appwrite user id (as deterministic UUID) to email.',
    '-- Run this after importing profiles that used the same UUID for profile.id.',
    'INSERT INTO auth_migration (legacy_auth_id, email) VALUES'
  ];
  const values = rows.map(
    r => `  ('${r.legacy_auth_id}', '${r.email.replace(/'/g, "''")}')`
  );
  sqlLines.push(values.join(',\n'));
  sqlLines.push('ON CONFLICT (legacy_auth_id) DO UPDATE SET email = EXCLUDED.email;');
  fs.writeFileSync(SQL_OUT, sqlLines.join('\n'));
  fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
  console.log('Wrote', SQL_OUT, 'and', JSON_OUT, `(${rows.length} rows)`);
}

main();
