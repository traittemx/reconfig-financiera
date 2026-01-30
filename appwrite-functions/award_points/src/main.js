/**
 * Appwrite Function: award_points
 * Input: { p_org_id: string, p_user_id: string, p_event_key: string, p_ref_table?: string, p_ref_id?: string }
 * Output: number (points awarded)
 */
const { Client, Databases, Query, ID } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'finaria';

module.exports = async ({ req, res, log, error }) => {
  try {
    const body = req.bodyJson || {};
    const orgId = body.p_org_id;
    const userId = body.p_user_id;
    const eventKey = body.p_event_key;
    const refTable = body.p_ref_table || null;
    const refId = body.p_ref_id || null;
    if (!orgId || !userId || !eventKey) {
      return res.json(0);
    }
    const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || req.headers['X-Appwrite-Key'] || '';
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(apiKey);
    const databases = new Databases(client);
    let ruleDoc;
    try {
      ruleDoc = await databases.getDocument(DATABASE_ID, 'points_rules', eventKey);
    } catch {
      ruleDoc = null;
    }
    if (!ruleDoc || ruleDoc.is_active === false) {
      return res.json(0);
    }
    const points = ruleDoc.points ?? 0;
    if (points <= 0) {
      return res.json(0);
    }
    if (refTable && refId) {
      const eventsList = await databases.listDocuments(DATABASE_ID, 'points_events', [
        Query.equal('user_id', [userId]),
        Query.equal('event_key', [eventKey]),
        Query.equal('ref_table', [refTable]),
        Query.equal('ref_id', [refId]),
        Query.limit(1),
      ]);
      if (eventsList.documents && eventsList.documents.length > 0) {
        return res.json(0);
      }
    }
    await databases.createDocument(
      DATABASE_ID,
      'points_events',
      ID.unique(),
      {
        org_id: orgId,
        user_id: userId,
        event_key: eventKey,
        points,
        ref_table: refTable,
        ref_id: refId,
        created_at: new Date().toISOString(),
      }
    );
    const now = new Date().toISOString();
    const totalsList = await databases.listDocuments(DATABASE_ID, 'points_totals', [
      Query.equal('org_id', [orgId]),
      Query.equal('user_id', [userId]),
      Query.limit(1),
    ]);
    if (totalsList.documents && totalsList.documents.length > 0) {
      const tot = totalsList.documents[0];
      const newTotal = (tot.total_points ?? 0) + points;
      await databases.updateDocument(DATABASE_ID, 'points_totals', tot.$id, {
        total_points: newTotal,
        updated_at: now,
      });
    } else {
      await databases.createDocument(
        DATABASE_ID,
        'points_totals',
        ID.unique(),
        {
          org_id: orgId,
          user_id: userId,
          total_points: points,
          updated_at: now,
        }
      );
    }
    return res.json(points);
  } catch (e) {
    error(String(e));
    return res.json(0, 500);
  }
};
