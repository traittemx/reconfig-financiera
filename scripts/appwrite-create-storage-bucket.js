/**
 * Crea el bucket de Storage para los audios de lecciones en Appwrite.
 * 
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/appwrite-create-storage-bucket.js
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

const { Client, Storage, Permission, Role } = require('node-appwrite');

const BUCKET_ID = 'lesson-audio';

async function main() {
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new Storage(client);

  try {
    // Check if bucket already exists
    try {
      const bucket = await storage.getBucket(BUCKET_ID);
      console.log(`Bucket "${BUCKET_ID}" ya existe (ID: ${bucket.$id})`);
      return;
    } catch (err) {
      if (err.code !== 404) throw err;
    }

    // Create bucket
    await storage.createBucket(
      BUCKET_ID,
      'Lesson Audio',
      [
        Permission.read(Role.any()),  // Public read
        Permission.create(Role.users()),  // Authenticated users can upload
        Permission.update(Role.users()),
        Permission.delete(Role.users())
      ],
      false,  // fileSecurity = false (bucket-level permissions)
      true,   // enabled
      undefined,  // maximumFileSize (default)
      ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a'],  // allowedFileExtensions
      undefined,  // compression
      undefined,  // encryption
      undefined   // antivirus
    );

    console.log(`✓ Bucket "${BUCKET_ID}" creado exitosamente`);
    console.log('  - Permisos: lectura pública, escritura autenticada');
    console.log('  - Tipos permitidos: audio/mpeg, audio/mp3, audio/wav, audio/ogg, audio/aac, audio/m4a');
  } catch (err) {
    console.error('Error creando bucket:', err.message || err);
    process.exit(1);
  }
}

main();
