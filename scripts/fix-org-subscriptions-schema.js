/**
 * Agrega los atributos faltantes a la colección org_subscriptions.
 * Ejecutar: node scripts/fix-org-subscriptions-schema.js
 */

const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Faltan variables de entorno: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const { Client, Databases } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const COLLECTION_ID = 'org_subscriptions';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log('Verificando colección org_subscriptions...\n');

  // Get existing attributes
  let existingAttrs = [];
  try {
    const collection = await databases.getCollection(DATABASE_ID, COLLECTION_ID);
    existingAttrs = collection.attributes.map(a => a.key);
    console.log('Atributos existentes:', existingAttrs.join(', '));
  } catch (e) {
    console.error('Error: La colección org_subscriptions no existe. Ejecuta primero: node scripts/appwrite-create-collections.js');
    process.exit(1);
  }

  // Attributes that should exist
  const requiredAttrs = [
    { type: 'string', key: 'status', size: 32, required: false },
    { type: 'integer', key: 'seats_total', required: false, default: 10 },
    { type: 'integer', key: 'seats_used', required: false, default: 0 },
    { type: 'string', key: 'period_start', size: 16, required: false },
    { type: 'string', key: 'period_end', size: 16, required: false },
    { type: 'float', key: 'membership_cost', required: false },
    { type: 'string', key: 'notes', size: 4096, required: false },
    { type: 'datetime', key: 'updated_at', required: false },
  ];

  // Add missing attributes
  for (const attr of requiredAttrs) {
    if (existingAttrs.includes(attr.key)) {
      console.log(`✓ Atributo "${attr.key}" ya existe.`);
      continue;
    }

    console.log(`+ Creando atributo "${attr.key}"...`);
    try {
      if (attr.type === 'string') {
        await databases.createStringAttribute(
          DATABASE_ID,
          COLLECTION_ID,
          attr.key,
          attr.size || 255,
          attr.required || false,
          attr.default
        );
      } else if (attr.type === 'integer') {
        await databases.createIntegerAttribute(
          DATABASE_ID,
          COLLECTION_ID,
          attr.key,
          attr.required || false,
          undefined, // min
          undefined, // max
          attr.default
        );
      } else if (attr.type === 'float') {
        await databases.createFloatAttribute(
          DATABASE_ID,
          COLLECTION_ID,
          attr.key,
          attr.required || false,
          undefined, // min
          undefined, // max
          attr.default
        );
      } else if (attr.type === 'datetime') {
        await databases.createDatetimeAttribute(
          DATABASE_ID,
          COLLECTION_ID,
          attr.key,
          attr.required || false,
          attr.default
        );
      }
      console.log(`  ✓ Atributo "${attr.key}" creado.`);
      await sleep(2000); // Wait for Appwrite to process
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log(`  ✓ Atributo "${attr.key}" ya existía.`);
      } else {
        console.error(`  ✗ Error creando "${attr.key}":`, e.message);
      }
    }
  }

  console.log('\n--- Schema de org_subscriptions actualizado ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
