/**
 * Establece un usuario como SUPER_ADMIN sin organización vinculada.
 * 
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/set-super-admin.js <USER_ID>
 * 
 * Ejemplo: node scripts/set-super-admin.js 69853900001b5bfd41b3
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

// ID del usuario a promover (puede pasarse como argumento o usar el valor por defecto)
const userId = process.argv[2] || '69853900001b5bfd41b3';

if (!userId) {
  console.error('Uso: node scripts/set-super-admin.js <USER_ID>');
  console.error('Ejemplo: node scripts/set-super-admin.js 69853900001b5bfd41b3');
  process.exit(1);
}

const { Client, Databases } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const COLLECTION_PROFILES = 'profiles';

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log(`\n🔧 Estableciendo usuario ${userId} como SUPER_ADMIN...\n`);

  try {
    // Verificar si el perfil existe
    let profile;
    let isNewProfile = false;

    try {
      profile = await databases.getDocument(DATABASE_ID, COLLECTION_PROFILES, userId);
      console.log('📋 Perfil actual:');
      console.log(`   - Nombre: ${profile.full_name || '(sin nombre)'}`);
      console.log(`   - Rol actual: ${profile.role}`);
      console.log(`   - Org ID: ${profile.org_id || '(ninguna)'}`);
    } catch (getErr) {
      if (getErr.code === 404) {
        console.log('📋 El perfil no existe, se creará uno nuevo.');
        isNewProfile = true;
      } else {
        throw getErr;
      }
    }

    const now = new Date().toISOString();

    if (isNewProfile) {
      // Crear perfil como SUPER_ADMIN
      await databases.createDocument(DATABASE_ID, COLLECTION_PROFILES, userId, {
        full_name: 'Super Admin',
        role: 'SUPER_ADMIN',
        org_id: null,
        start_date: null,
        avatar_url: null,
        created_at: now,
        updated_at: now,
      });
      console.log('\n✅ Perfil creado exitosamente como SUPER_ADMIN');
    } else {
      // Actualizar a SUPER_ADMIN sin organización
      await databases.updateDocument(DATABASE_ID, COLLECTION_PROFILES, userId, {
        role: 'SUPER_ADMIN',
        org_id: null,
        updated_at: now,
      });
      console.log('\n✅ Usuario actualizado exitosamente:');
    }

    console.log('   - Rol: SUPER_ADMIN');
    console.log('   - Org ID: null (sin organización vinculada)');
    console.log('\n📝 El usuario ahora puede:');
    console.log('   - Acceder a la app sin pertenecer a una organización');
    console.log('   - Crear nuevas empresas desde /superadmin/organizations');
    console.log('   - Gestionar suscripciones de todas las empresas');
    console.log('   - Administrar contenido del curso desde /superadmin/lessons');
    console.log('\n⚠️  NOTA: El usuario debe cerrar sesión y volver a iniciar sesión');
    console.log('   para que los cambios surtan efecto en el cliente.\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
