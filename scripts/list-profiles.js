/**
 * Lista todos los perfiles de usuarios en Appwrite.
 * 
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/list-profiles.js
 */

const path = require('path');
const fs = require('fs');

// Cargar variables de entorno desde .env
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

const { Client, Databases, Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const COLLECTION_PROFILES = 'profiles';

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log('\n📋 Listando perfiles de usuarios...\n');

  try {
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_PROFILES, [
      Query.limit(100),
      Query.orderDesc('$createdAt'),
    ]);

    if (result.documents.length === 0) {
      console.log('No hay perfiles registrados.\n');
      return;
    }

    console.log(`Total de perfiles: ${result.total}\n`);
    console.log('ID                       | Nombre                  | Rol          | Org ID');
    console.log('-------------------------|-------------------------|--------------|------------------------');

    for (const doc of result.documents) {
      const id = doc.$id.padEnd(24);
      const name = (doc.full_name || '(sin nombre)').slice(0, 23).padEnd(23);
      const role = (doc.role || 'EMPLOYEE').padEnd(12);
      const orgId = doc.org_id || '(ninguna)';
      console.log(`${id} | ${name} | ${role} | ${orgId}`);
    }

    console.log('');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
