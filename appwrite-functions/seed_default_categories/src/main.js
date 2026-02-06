/**
 * Appwrite Function: seed_default_categories
 * Input: { p_org_id: string, p_user_id: string }
 * Output: {}
 */
const { Client, Databases, Query, ID } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const DEFAULT_CATEGORIES = [
  { kind: 'INCOME', name: 'Salario', icon: 'Wallet', color: '#0d9488' },
  { kind: 'INCOME', name: 'Otros ingresos', icon: 'DollarSign', color: '#0891b2' },
  { kind: 'EXPENSE', name: 'Comida', icon: 'UtensilsCrossed', color: '#e11d48' },
  { kind: 'EXPENSE', name: 'Transporte', icon: 'Car', color: '#2563eb' },
  { kind: 'EXPENSE', name: 'Diversión', icon: 'Gamepad2', color: '#7c3aed' },
  { kind: 'EXPENSE', name: 'Renta', icon: 'Home', color: '#16a34a' },
  { kind: 'EXPENSE', name: 'Gasolina', icon: 'Zap', color: '#ea580c' },
  { kind: 'EXPENSE', name: 'Salud', icon: 'HeartPulse', color: '#dc2626' },
  { kind: 'EXPENSE', name: 'Entretenimiento', icon: 'Gamepad2', color: '#7c3aed' },
  { kind: 'EXPENSE', name: 'Streaming', icon: 'Music', color: '#0891b2' },
  { kind: 'EXPENSE', name: 'Viajes', icon: 'Plane', color: '#0d9488' },
  { kind: 'EXPENSE', name: 'Café', icon: 'Coffee', color: '#ca8a04' },
  { kind: 'EXPENSE', name: 'Libros', icon: 'BookOpen', color: '#65a30d' },
  { kind: 'EXPENSE', name: 'Regalos', icon: 'Gift', color: '#be185d' },
];

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
    const existing = await databases.listDocuments(DATABASE_ID, 'categories', [
      Query.equal('org_id', [orgId]),
      Query.equal('user_id', [userId]),
      Query.limit(1),
    ]);
    if (existing.documents && existing.documents.length > 0) {
      return res.json({});
    }
    const now = new Date().toISOString();
    for (const c of DEFAULT_CATEGORIES) {
      await databases.createDocument(
        DATABASE_ID,
        'categories',
        ID.unique(),
        {
          org_id: orgId,
          user_id: userId,
          kind: c.kind,
          name: c.name,
          is_default: true,
          icon: c.icon,
          color: c.color,
          created_at: now,
        }
      );
    }
    return res.json({});
  } catch (e) {
    error(String(e));
    return res.json({ error: String(e.message || e) }, 500);
  }
};
