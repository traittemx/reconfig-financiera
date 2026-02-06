/**
 * Añade permisos Read, Create, Update y Delete para Users en la colección categories.
 * Si no puedes eliminar categorías (401/403), ejecuta este script.
 *
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/appwrite-fix-categories-permissions.js
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

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

const { Client, Databases, Permission, Role } = require('node-appwrite');

async function main() {
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  const permissions = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];

  try {
    const collection = await databases.getCollection(DATABASE_ID, 'categories');
    await databases.updateCollection({
      databaseId: DATABASE_ID,
      collectionId: 'categories',
      name: collection.name,
      permissions,
      documentSecurity: false, // Permisos de colección aplican a todos los documentos (permite eliminar los creados por el seed)
    });
    console.log('✓ Permisos de categories actualizados: Read, Create, Update, Delete para Users');
    console.log('✓ documentSecurity = false (permisos de colección aplican a todos los documentos)');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
