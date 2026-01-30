/**
 * Generates:
 *   - supabase/migrations/017_lesson_content.sql (reference; Supabase migrations kept for docs)
 *   - supabase/seed-data/lessons-seed-block.sql (reference)
 *   - appwrite-seed-data/lessons.json (for Appwrite: import lessons via API or Console)
 * from supabase/seed-data/lessons-content.ts (or Reconfiguracion-Financiera/supabase/... if run from repo root)
 * Run: node scripts/generate-lesson-sql.js
 */

const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, '../supabase/seed-data/lessons-content.ts');
const raw = fs.readFileSync(tsPath, 'utf8');

// Parse TS: split by "  }," to get each lesson block, then extract day, title, summary, mission
const lessons = [];
const start = raw.indexOf('export const lessonsContent');
const arrayStart = raw.indexOf('= [', start) + 2; // "= [" -> index of '['
const arrayBody = raw.slice(arrayStart + 1);
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
  console.error('Expected 23 lessons, got', lessons.length);
  process.exit(1);
}

function sqlEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

function toEscapeLiteral(s) {
  return sqlEscape(s).replace(/\n/g, '\\n');
}

// Generate migration 017
const migrationLines = [
  '-- Lesson content: title, summary, mission for days 1..23',
  '-- Generated from supabase/seed-data/lessons-content.ts',
  '',
];
for (const l of lessons) {
  migrationLines.push(`UPDATE lessons SET title = E'${toEscapeLiteral(l.title)}', summary = E'${toEscapeLiteral(l.summary)}', mission = E'${toEscapeLiteral(l.mission)}' WHERE day = ${l.day};`);
}

const migrationPath = path.join(__dirname, '../supabase/migrations/017_lesson_content.sql');
fs.writeFileSync(migrationPath, migrationLines.join('\n') + '\n', 'utf8');
console.log('Wrote', migrationPath);

// Generate seed block (VALUES only, for manual paste or full seed)
const seedValues = lessons
  .map(
    (l) =>
      `(${l.day}, E'${toEscapeLiteral(l.title)}', E'${toEscapeLiteral(l.summary)}', E'${toEscapeLiteral(l.mission)}', NULL)`
  )
  .join(',\n');
const seedBlock = `INSERT INTO lessons (day, title, summary, mission, audio_url) VALUES
${seedValues}
ON CONFLICT (day) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, mission = EXCLUDED.mission;
`;
const seedSnippetPath = path.join(__dirname, '../supabase/seed-data/lessons-seed-block.sql');
fs.writeFileSync(seedSnippetPath, seedBlock, 'utf8');
console.log('Wrote', seedSnippetPath);

// Appwrite: JSON for lessons collection (document ID = day string "1".."23")
const appwriteDir = path.join(__dirname, '../appwrite-seed-data');
if (!fs.existsSync(appwriteDir)) {
  fs.mkdirSync(appwriteDir, { recursive: true });
}
const appwriteLessons = lessons.map((l) => ({
  documentId: String(l.day),
  title: l.title,
  summary: l.summary,
  mission: l.mission,
  audio_url: null,
}));
const appwritePath = path.join(appwriteDir, 'lessons.json');
fs.writeFileSync(appwritePath, JSON.stringify(appwriteLessons, null, 2), 'utf8');
console.log('Wrote', appwritePath);
