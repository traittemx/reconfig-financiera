/**
 * Adds the is_scheduled attribute to the transactions collection.
 * Run this once to migrate the database schema.
 * 
 * Ejecutar: node scripts/add-is-scheduled-attribute.js
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
const COLLECTION_ID = 'transactions';

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  console.log('Adding is_scheduled attribute to transactions collection...');

  try {
    await databases.createBooleanAttribute(
      DATABASE_ID,
      COLLECTION_ID,
      'is_scheduled',
      false, // required
      false  // default value
    );
    console.log('Attribute is_scheduled created successfully!');
    console.log('Waiting for attribute to be processed...');
    
    // Wait for Appwrite to process the attribute
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Done! The is_scheduled attribute has been added to the transactions collection.');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Attribute is_scheduled already exists, nothing to do.');
    } else {
      console.error('Error creating attribute:', err.message);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
