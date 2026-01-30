/**
 * Appwrite Function: join_org_with_code
 * Input: { p_code: string, p_full_name?: string }
 * Requires: X-Appwrite-Session header (authenticated user).
 * Output: {} on success; throws CODE_INVALID | NO_SEATS | ALREADY_MEMBER
 */
const { Client, Databases, Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

module.exports = async ({ req, res, log, error }) => {
  try {
    const userId = req.headers['x-appwrite-user-id'] || req.headers['X-Appwrite-User-Id'];
    if (!userId) {
      return res.json({ error: 'Not authenticated' }, 401);
    }
    const body = req.bodyJson || {};
    const pCode = typeof body.p_code === 'string' ? body.p_code.trim() : '';
    const pFullName = typeof body.p_full_name === 'string' ? body.p_full_name.trim() : '';
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
    const subDoc = await databases.getDocument(DATABASE_ID, 'org_subscriptions', orgId);
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
    await databases.updateDocument(DATABASE_ID, 'org_subscriptions', orgId, {
      seats_used: used,
      updated_at: new Date().toISOString(),
    });
    return res.json({});
  } catch (e) {
    error(String(e));
    return res.json({ error: String(e.message || e) }, 500);
  }
};
