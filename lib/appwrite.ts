// lib/appwrite.ts
// Redirects all calls to InsForge implementation
// This file exists to maintain compatibility with existing imports

export * from './insforge';

// Explicitly re-export constants if they were default exported or named differently in the original
export {
  COLLECTIONS, DATABASE_ID, ID,
  Query, STORAGE_BUCKET_LESSON_AUDIO, account, client, databases, functions, storage
} from './insforge';

