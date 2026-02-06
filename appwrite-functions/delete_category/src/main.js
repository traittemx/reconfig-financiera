/**
 * Appwrite Function: delete_category
 * Input: { category_id: string, user_id: string } (query params)
 * Deletes the category document if it belongs to the user (user_id match).
 * Use when client deleteDocument fails due to permissions.
 */
const { Client, Databases } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

function getQueryParams(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const path = req.path || '';
  const i = path.indexOf('?');
  if (i === -1) return {};
  try {
    return Object.fromEntries(new URLSearchParams(path.slice(i)));
  } catch {
    return {};
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const query = getQueryParams(req);
    const body = req.bodyJson || {};
    const categoryId = query.category_id || body.category_id;
    const userId = query.user_id || body.user_id;
    if (!categoryId || !userId) {
      return res.json({ error: 'Missing category_id or user_id' }, 400);
    }
    const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || req.headers['X-Appwrite-Key'] || '';
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(apiKey);
    const databases = new Databases(client);
    const doc = await databases.getDocument(DATABASE_ID, 'categories', categoryId);
    const docUserId = doc.user_id || doc.userId;
    if (docUserId !== userId) {
      return res.json({ error: 'Category does not belong to user' }, 403);
    }
    await databases.deleteDocument(DATABASE_ID, 'categories', categoryId);
    return res.json({ ok: true });
  } catch (e) {
    error(String(e));
    return res.json({ error: String(e.message || e) }, 500);
  }
};
