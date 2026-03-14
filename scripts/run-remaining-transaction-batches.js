/**
 * Ejecuta los lotes 2-6 de transacciones contra InsForge Postgres.
 * Requiere: INSFORGE_POSTGRES_URL en .env
 * El lote 1 ya se ejecutó vía MCP.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const INSFORGE_PG_URL = process.env.INSFORGE_POSTGRES_URL;
if (!INSFORGE_PG_URL) {
  console.error('Falta INSFORGE_POSTGRES_URL en .env');
  process.exit(1);
}

const fixedPath = path.join(__dirname, '../data_import_ready/transactions_import_batches_fixed.txt');
const content = fs.readFileSync(fixedPath, 'utf8');
const batches = content.split('---BATCH---').map((b) => b.trim()).filter(Boolean);

async function run() {
  const client = new Client({
    connectionString: INSFORGE_PG_URL,
    ssl: process.env.INSFORGE_POSTGRES_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    for (let i = 1; i < batches.length; i++) {
      const q = batches[i];
      await client.query(q);
      console.log('Batch', i + 1, 'OK');
    }
    console.log('Done. Total batches run:', batches.length - 1);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
