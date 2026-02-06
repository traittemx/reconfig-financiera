/**
 * Appwrite Function: award_points
 * Input: { p_org_id: string, p_user_id: string, p_event_key: string, p_ref_table?: string, p_ref_id?: string }
 * Output: number (points awarded)
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

function parseBody(req) {
  let data = null;
  if (req.bodyJson && typeof req.bodyJson === 'object') {
    data = req.bodyJson;
  } else {
    const raw = req.bodyText || req.body || '';
    if (typeof raw === 'string' && raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch (_) {}
    }
  }
  if (!data || typeof data !== 'object') return {};
  // Appwrite may forward the execution payload as { body: "<json string>", async: false }
  if (typeof data.body === 'string' && data.body.trim()) {
    try {
      return JSON.parse(data.body);
    } catch (_) {}
  }
  return data;
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const query = getQueryParams(req);
    const parsed = parseBody(req);
    const body = {
      p_org_id: query.p_org_id || parsed.p_org_id,
      p_user_id: query.p_user_id || parsed.p_user_id,
      p_event_key: query.p_event_key || parsed.p_event_key,
      p_ref_table: query.p_ref_table || parsed.p_ref_table,
      p_ref_id: query.p_ref_id || parsed.p_ref_id,
    };
    const orgId = body.p_org_id;
    const userId = body.p_user_id;
    const eventKey = body.p_event_key;
    const refTable = body.p_ref_table || null;
    const refId = body.p_ref_id || null;

    log('[award_points] body keys: ' + Object.keys(body).join(',') + ' | hasOrg: ' + !!orgId + ' hasUser: ' + !!userId + ' eventKey: ' + (eventKey || '(empty)'));

    if (!orgId || !userId || !eventKey) {
      log('[award_points] early exit: missing orgId/userId/eventKey');
      return res.json(0);
    }
    const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || req.headers['X-Appwrite-Key'] || '';
    if (!apiKey) {
      error('[award_points] APPWRITE_FUNCTION_API_KEY not set');
      return res.json(0, 500);
    }
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(apiKey);
    const databases = new Databases(client);
    let ruleDoc;
    try {
      ruleDoc = await databases.getDocument(DATABASE_ID, 'points_rules', eventKey);
    } catch (err) {
      log('[award_points] getDocument points_rules failed: ' + (err.message || String(err)));
      ruleDoc = null;
    }
    if (!ruleDoc || ruleDoc.is_active === false) {
      log('[award_points] no rule or inactive for eventKey: ' + eventKey);
      return res.json(0);
    }
    const points = ruleDoc.points ?? 0;
    if (points <= 0) {
      log('[award_points] rule points <= 0');
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
        log('[award_points] duplicate event, skipping');
        return res.json(0);
      }
    }
    log('[award_points] creating points_event and updating totals');
    try {
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
      log('[award_points] points_event created');
    } catch (err) {
      error('[award_points] createDocument points_events failed: ' + (err.message || String(err)));
      return res.json(0, 500);
    }
    const now = new Date().toISOString();
    const totalsList = await databases.listDocuments(DATABASE_ID, 'points_totals', [
      Query.equal('org_id', [orgId]),
      Query.equal('user_id', [userId]),
      Query.limit(1),
    ]);
    if (totalsList.documents && totalsList.documents.length > 0) {
      const tot = totalsList.documents[0];
      const newTotal = (tot.total_points ?? 0) + points;
      try {
        await databases.updateDocument(DATABASE_ID, 'points_totals', tot.$id, {
          total_points: newTotal,
          updated_at: now,
        });
        log('[award_points] points_totals updated');
      } catch (err) {
        error('[award_points] updateDocument points_totals failed: ' + (err.message || String(err)));
        return res.json(0, 500);
      }
    } else {
      try {
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
        log('[award_points] points_totals document created (new user)');
      } catch (err) {
        error('[award_points] createDocument points_totals failed: ' + (err.message || String(err)));
        return res.json(0, 500);
      }
    }
    log('[award_points] success, awarded ' + points);
    return res.json(points);
  } catch (e) {
    error('[award_points] unexpected error: ' + String(e));
    return res.json(0, 500);
  }
};
