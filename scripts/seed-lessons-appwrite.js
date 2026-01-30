/**
 * Inserta el contenido de las 23 lecciones en la colección "lessons" de Appwrite.
 * Lee desde supabase/seed-data/lessons-content.ts (mismo formato que generate-lesson-sql.js).
 *
 * Requiere: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 * Ejecutar: node scripts/seed-lessons-appwrite.js
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

const { Client, Databases, ID } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const COLLECTION_LESSONS = 'lessons';

// Parse lessons from lessons-content.ts (same logic as generate-lesson-sql.js)
const tsPath = path.join(__dirname, '..', 'supabase', 'seed-data', 'lessons-content.ts');
const raw = fs.readFileSync(tsPath, 'utf8');

const lessons = [];
const arrayBody = raw.slice(raw.indexOf('= [') + 2 + 1);
const rawBlocks = arrayBody.split(/\n  \},\s*\n/);
const blocks = rawBlocks
  .map((b) => b.replace(/^\[\s*/, '').replace(/\s*\];?\s*$/, '').trim())
  .filter((b) => b.startsWith('{') && b.includes('day:'));

for (let i = 0; i < blocks.length; i++) {
  const block = blocks[i];
  const dayMatch = block.match(/day:\s*(\d+),/);
  const titleMatch = block.match(/title:\s*'([^']*)',/);
  const summaryStart = block.indexOf('summary: `') + 'summary: `'.length;
  const summaryEnd = block.indexOf('`,\n    mission: `');
  const missionStart = block.indexOf('mission: `') + 'mission: `'.length;
  const missionEnd = block.lastIndexOf('`');
  if (!dayMatch || !titleMatch || summaryEnd <= summaryStart || missionEnd <= missionStart) {
    console.error('Parse error for block', i, 'day', dayMatch?.[1]);
    process.exit(1);
  }
  lessons.push({
    day: parseInt(dayMatch[1], 10),
    title: titleMatch[1],
    summary: block.slice(summaryStart, summaryEnd),
    mission: block.slice(missionStart, missionEnd),
  });
}

if (lessons.length !== 23) {
  console.error('Expected 23 lessons from lessons-content.ts, got', lessons.length);
  process.exit(1);
}

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log(`Insertando ${lessons.length} lecciones en Appwrite (${DATABASE_ID}/${COLLECTION_LESSONS})...`);

  for (const lesson of lessons) {
    const documentId = String(lesson.day);
    const data = {
      title: lesson.title,
      summary: lesson.summary,
      mission: lesson.mission,
      audio_url: '', // vacío; se puede subir audio después desde superadmin
    };

    try {
      await databases.getDocument(DATABASE_ID, COLLECTION_LESSONS, documentId);
      await databases.updateDocument(DATABASE_ID, COLLECTION_LESSONS, documentId, data);
      console.log(`  Día ${documentId}: actualizado`);
    } catch (err) {
      if (err.code === 404) {
        await databases.createDocument(DATABASE_ID, COLLECTION_LESSONS, documentId, data);
        console.log(`  Día ${documentId}: creado`);
      } else {
        console.error(`  Día ${documentId}: error`, err.message || err);
      }
    }
  }

  console.log('✓ Contenido de lecciones insertado en Appwrite.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
