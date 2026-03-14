/**
 * Ejecuta los lotes 5 y 6 de transacciones (tx_batch5.txt, tx_batch6.txt) contra InsForge.
 * Requiere: INSFORGE_POSTGRES_URL en .env
 * Uso: node scripts/run-tx-batches-5-6.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INSFORGE_POSTGRES_URL,
  ssl: process.env.INSFORGE_POSTGRES_SSL !== 'false' ? { rejectUnauthorized: false } : false
});

const dir = path.join(__dirname, '../data_import_ready');

async function main() {
  for (const name of ['tx_batch5.txt', 'tx_batch6.txt']) {
    const file = path.join(dir, name);
    const sql = fs.readFileSync(file, 'utf8').trim();
    if (!sql) continue;
    try {
      const res = await pool.query(sql);
      console.log(name, 'OK, rowCount:', res.rowCount);
    } catch (err) {
      console.error(name, 'Error:', err.message);
      process.exit(1);
    }
  }
  await pool.end();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
