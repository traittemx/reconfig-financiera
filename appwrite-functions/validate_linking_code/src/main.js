/**
 * Appwrite Function: validate_linking_code
 * Input: { p_code: string }
 * Output: [{ valid: boolean, org_name: string | null }] or { valid, org_name }
 */
const { Client, Databases, Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const COLLECTION_ORGANIZATIONS = 'organizations';

module.exports = async ({ req, res, log, error }) => {
  try {
    const body = req.bodyJson || {};
    const pCode = typeof body.p_code === 'string' ? body.p_code.trim() : '';
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
      return res.json({ valid: true, org_name: doc.name || null });
    }
    return res.json({ valid: false, org_name: null });
  } catch (e) {
    error(String(e));
    return res.json({ valid: false, org_name: null }, 500);
  }
};
