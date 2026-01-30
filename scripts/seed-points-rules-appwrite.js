/**
 * Inserta los documentos de points_rules en Appwrite (colección points_rules).
 * Document ID = clave del evento (ej. CREATE_EXPENSE, LESSON_COMPLETED).
 *
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/seed-points-rules-appwrite.js
 */

const path = require('path');
const fs = require('fs');

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
const COLLECTION = 'points_rules';

const RULES = [
  { key: 'CREATE_EXPENSE', points: 10 },
  { key: 'CREATE_INCOME', points: 10 },
  { key: 'CREATE_ACCOUNT', points: 15 },
  { key: 'CREATE_CATEGORY', points: 15 },
  { key: 'CREATE_BUDGET', points: 20 },
  { key: 'LESSON_COMPLETED', points: 50 },
  { key: 'MISSION_COMPLETED', points: 30 },
  { key: 'CREATE_INCOME_SOURCE', points: 25 },
  { key: 'STREAK_5_DAYS', points: 100 },
  { key: 'RECOMMENDATION_FOLLOWED', points: 25 },
  { key: 'CRITICAL_DAY_LOGGED', points: 15 },
  { key: 'RESCUE', points: 10 },
];

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log(`Insertando ${RULES.length} reglas en ${DATABASE_ID}/${COLLECTION}...`);

  for (const rule of RULES) {
    try {
      await databases.getDocument(DATABASE_ID, COLLECTION, rule.key);
      await databases.updateDocument(DATABASE_ID, COLLECTION, rule.key, {
        points: rule.points,
        is_active: true,
      });
      console.log(`  ${rule.key}: actualizado (${rule.points} pts)`);
    } catch (err) {
      if (err.code === 404) {
        await databases.createDocument(DATABASE_ID, COLLECTION, rule.key, {
          points: rule.points,
          is_active: true,
        });
        console.log(`  ${rule.key}: creado (${rule.points} pts)`);
      } else {
        console.error(`  ${rule.key}: error`, err.message || err);
      }
    }
  }

  console.log('✓ points_rules listos.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
