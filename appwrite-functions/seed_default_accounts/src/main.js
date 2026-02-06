/**
 * Appwrite Function: seed_default_accounts
 * Input: { p_org_id: string, p_user_id: string }
 * Output: {}
 */
const { Client, Databases, Query, ID } = require('node-appwrite');

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
    const orgId = query.p_org_id || body.p_org_id;
    const userId = query.p_user_id || body.p_user_id;
    if (!orgId || !userId) {
      return res.json({ error: 'Missing p_org_id or p_user_id' }, 400);
    }
    const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || req.headers['X-Appwrite-Key'] || '';
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(apiKey);
    const databases = new Databases(client);
    const existing = await databases.listDocuments(DATABASE_ID, 'accounts', [
      Query.equal('user_id', [userId]),
      Query.limit(1),
    ]);
    if (existing.documents && existing.documents.length > 0) {
      return res.json({});
    }
    const now = new Date().toISOString();
    await databases.createDocument(
      DATABASE_ID,
      'accounts',
      ID.unique(),
      {
        user_id: userId,
        org_id: orgId,
        name: 'Efectivo',
        type: 'CASH',
        currency: 'MXN',
        opening_balance: 0,
        created_at: now,
      }
    );
    return res.json({});
  } catch (e) {
    error(String(e));
    return res.json({ error: String(e.message || e) }, 500);
  }
};
