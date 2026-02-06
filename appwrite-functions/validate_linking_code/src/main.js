/**
 * Appwrite Function: validate_linking_code
 * Input: { p_code: string }
 * Output: [{ valid: boolean, org_name: string | null }] or { valid, org_name }
 */
const { Client, Databases, Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const COLLECTION_ORGANIZATIONS = 'organizations';

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
    let pCode = typeof query.p_code === 'string' ? query.p_code.trim() : '';
    if (!pCode) {
      let body = req.bodyJson || null;
      if (!body || typeof body !== 'object') {
        const raw = req.bodyText || req.body || '';
        if (typeof raw === 'string' && raw.trim()) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = {};
          }
        } else {
          body = {};
        }
      }
      pCode = typeof body.p_code === 'string' ? body.p_code.trim() : '';
    }
    if (!pCode) {
      return res.json({ valid: false, org_name: null });
    }
    const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || req.headers['X-Appwrite-Key'] || '';
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(apiKey);
    const databases = new Databases(client);
    const list = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ORGANIZATIONS,
      [Query.equal('linking_code', [pCode])]
    );
    const doc = list.documents && list.documents[0];
    if (doc) {
      const orgName = doc.name ?? doc['name'] ?? null;
      return res.json({ valid: true, org_name: orgName });
    }
    return res.json({ valid: false, org_name: null });
  } catch (e) {
    error(String(e));
    return res.json({ valid: false, org_name: null }, 500);
  }
};
