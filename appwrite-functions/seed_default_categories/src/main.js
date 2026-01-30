/**
 * Appwrite Function: seed_default_categories
 * Input: { p_org_id: string, p_user_id: string }
 * Output: {}
 */
const { Client, Databases, Query, ID } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';
const DEFAULT_CATEGORIES = [
  { kind: 'EXPENSE', name: 'Alimentación', icon: 'UtensilsCrossed', color: '#e11d48' },
  { kind: 'EXPENSE', name: 'Transporte', icon: 'Car', color: '#2563eb' },
  { kind: 'EXPENSE', name: 'Vivienda', icon: 'Home', color: '#16a34a' },
  { kind: 'EXPENSE', name: 'Salud', icon: 'HeartPulse', color: '#dc2626' },
  { kind: 'EXPENSE', name: 'Entretenimiento', icon: 'Gamepad2', color: '#7c3aed' },
  { kind: 'EXPENSE', name: 'Educación', icon: 'GraduationCap', color: '#ea580c' },
  { kind: 'EXPENSE', name: 'Otros gastos', icon: 'Receipt', color: '#64748b' },
  { kind: 'INCOME', name: 'Nómina', icon: 'Wallet', color: '#0d9488' },
  { kind: 'INCOME', name: 'Freelance', icon: 'Briefcase', color: '#be185d' },
  { kind: 'INCOME', name: 'Otros ingresos', icon: 'DollarSign', color: '#0891b2' },
];

module.exports = async ({ req, res, log, error }) => {
  try {
    const body = req.bodyJson || {};
    const orgId = body.p_org_id;
    const userId = body.p_user_id;
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
