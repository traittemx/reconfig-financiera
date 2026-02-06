/**
 * Appwrite Function: join_org_with_code
 * Input: { p_code: string, p_full_name?: string }
 * Requires: X-Appwrite-Session header (authenticated user).
 * Output: {} on success; throws CODE_INVALID | NO_SEATS | ALREADY_MEMBER
 */
const { Client, Databases, Query } = require('node-appwrite');

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
    const userId = req.headers['x-appwrite-user-id'] || req.headers['X-Appwrite-User-Id'];
    if (!userId) {
      return res.json({ error: 'Not authenticated' }, 401);
    }
    const query = getQueryParams(req);
    let pCode = typeof query.p_code === 'string' ? query.p_code.trim() : '';
    let pFullName = typeof query.p_full_name === 'string' ? query.p_full_name.trim() : '';
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
      pFullName = typeof body.p_full_name === 'string' ? body.p_full_name.trim() : pFullName;
    }
    if (!pCode) {
      return res.json({ error: 'CODE_INVALID:Código de vinculación inválido' }, 400);
    }
    const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || req.headers['X-Appwrite-Key'] || '';
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(apiKey);
    const databases = new Databases(client);
    const orgList = await databases.listDocuments(
      DATABASE_ID,
      'organizations',
      [Query.equal('linking_code', [pCode])]
    );
    const orgDoc = orgList.documents && orgList.documents[0];
    if (!orgDoc) {
      return res.json({ error: 'CODE_INVALID:Código de vinculación inválido' }, 400);
    }
    const orgId = orgDoc.$id;
    let subDoc;
    const subData = {
      status: 'trial',
      seats_total: 10,
      seats_used: 0,
      updated_at: new Date().toISOString(),
    };
    const subPermissions = ['read("users")'];
    try {
      subDoc = await databases.getDocument(DATABASE_ID, 'org_subscriptions', orgId);
    } catch (e) {
      if (e.code === 404 || e.message?.includes('not found')) {
        await databases.createDocument(
          DATABASE_ID,
          'org_subscriptions',
          orgId,
          subData,
          subPermissions
        );
        subDoc = await databases.getDocument(DATABASE_ID, 'org_subscriptions', orgId);
      } else {
        throw e;
      }
    }
    const seatsUsed = subDoc.seats_used ?? 0;
    const seatsTotal = subDoc.seats_total ?? 10;
    if (seatsUsed >= seatsTotal) {
      return res.json({ error: 'NO_SEATS:No hay plazas disponibles en esta empresa' }, 400);
    }
    const membersList = await databases.listDocuments(DATABASE_ID, 'org_members', [
      Query.equal('org_id', [orgId]),
      Query.equal('user_id', [userId]),
    ]);
    if (membersList.documents && membersList.documents.length > 0) {
      const existing = membersList.documents[0];
      await databases.updateDocument(DATABASE_ID, 'org_members', existing.$id, {
        status: 'active',
        role_in_org: 'EMPLOYEE',
      });
    } else {
      const memberId = `${orgId}_${userId}`;
      await databases.createDocument(
        DATABASE_ID,
        'org_members',
        memberId,
        {
          org_id: orgId,
          user_id: userId,
          role_in_org: 'EMPLOYEE',
          status: 'active',
          created_at: new Date().toISOString(),
        }
      );
    }
    try {
      await databases.updateDocument(DATABASE_ID, 'profiles', userId, {
        org_id: orgId,
        role: 'EMPLOYEE',
        full_name: pFullName || undefined,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      await databases.createDocument(
        DATABASE_ID,
        'profiles',
        userId,
        {
          full_name: pFullName || '',
          org_id: orgId,
          role: 'EMPLOYEE',
          start_date: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );
    }
    const countList = await databases.listDocuments(DATABASE_ID, 'org_members', [
      Query.equal('org_id', [orgId]),
      Query.equal('status', ['active']),
    ]);
    const used = countList.total ?? 0;
    const updatedAt = new Date().toISOString();
    await databases.updateDocument(DATABASE_ID, 'org_subscriptions', orgId, {
      seats_used: used,
      updated_at: updatedAt,
    });
    subDoc = await databases.getDocument(DATABASE_ID, 'org_subscriptions', orgId);
    return res.json({
      org_id: orgId,
      status: subDoc.status || 'trial',
      seats_total: subDoc.seats_total ?? 10,
      seats_used: subDoc.seats_used ?? used,
      period_start: subDoc.period_start ?? null,
      period_end: subDoc.period_end ?? null,
      updated_at: subDoc.updated_at ?? updatedAt,
    });
  } catch (e) {
    error(String(e));
    return res.json({ error: String(e.message || e) }, 500);
  }
};
