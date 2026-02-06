/**
 * Verifica la conexión con Appwrite (endpoint, proyecto, base de datos).
 *
 * Uso:
 *   node scripts/verify-appwrite-connection.js
 *
 * Variables de entorno (desde .env o shell):
 *   - APPWRITE_ENDPOINT o EXPO_PUBLIC_APPWRITE_ENDPOINT (ej. https://nyc.cloud.appwrite.io/v1)
 *   - APPWRITE_PROJECT_ID o EXPO_PUBLIC_APPWRITE_PROJECT_ID
 *   - APPWRITE_API_KEY (opcional; si está, prueba listar base de datos y colección profiles)
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
const databaseId = process.env.APPWRITE_DATABASE_ID || 'finaria';

async function main() {
  console.log('--- Verificación de conexión Appwrite ---\n');

  if (!endpoint || !projectId) {
    console.error('Faltan variables: EXPO_PUBLIC_APPWRITE_ENDPOINT y EXPO_PUBLIC_APPWRITE_PROJECT_ID (o APPWRITE_*)');
    console.error('Configúralas en .env (ver .env.example).');
    process.exit(1);
  }

  console.log('Endpoint:', endpoint);
  console.log('Project ID:', projectId);
  console.log('Database ID (esperado):', databaseId);
  console.log('API Key:', apiKey ? '***' : '(no definida)\n');

  // Comprobar que el endpoint responde (ping)
  try {
    const baseUrl = endpoint.replace(/\/v1\/?$/, '');
    const res = await fetch(`${baseUrl}/health/version`);
    if (res.ok) {
      const data = await res.json();
      console.log('Appwrite reachable:', data.version || 'OK');
    } else {
      console.log('Appwrite health check:', res.status);
    }
  } catch (err) {
    console.warn('No se pudo hacer health check al endpoint:', err.message);
  }

  if (!apiKey) {
    console.log('\nPara verificar base de datos y colecciones, define APPWRITE_API_KEY en .env');
    console.log('(Dashboard → Settings → API Keys → Create API Key, con permisos de lectura).');
    process.exit(0);
  }

  const { Client, Databases } = require('node-appwrite');
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  try {
    const db = await databases.get(databaseId);
    console.log('\nBase de datos "' + databaseId + '" encontrada:', db.name || db.$id);
  } catch (err) {
    console.error('\nError al acceder a la base de datos "' + databaseId + '":', err.message);
    if (err.code === 404) {
      console.error('Crea la base con: node scripts/appwrite-create-collections.js');
    }
    if (err.code === 401) {
      console.error('API Key inválida o sin permisos. Revisa APPWRITE_API_KEY en .env.');
    }
    process.exit(1);
  }

  try {
    const list = await databases.listDocuments(databaseId, 'profiles', [], 1);
    console.log('Colección "profiles": OK (total documentos:', list.total + ')');
  } catch (err) {
    console.error('Error al leer colección "profiles":', err.message);
    if (err.code === 404) {
      console.error('Crea las colecciones con: node scripts/appwrite-create-collections.js');
    }
    if (err.code === 401) {
      console.error('API Key sin permiso de lectura en la base de datos.');
    }
    process.exit(1);
  }

  console.log('\n--- Conexión verificada correctamente ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
