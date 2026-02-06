import {
  execFunction,
  getDocument,
  listDocuments,
  createDocument,
  updateDocument,
  COLLECTIONS,
  Query,
  ID,
} from '@/lib/appwrite';

/** Execution result may expose response as responseBody or response depending on SDK/platform. */
function getResponseBody(exec: unknown): string {
  const o = exec as { responseBody?: string; response?: string };
  return o.responseBody ?? o.response ?? '';
}

/**
 * Fallback: write points directly to DB when the function returns 0.
 * Requires points_events and points_totals to allow create/update for "users" in Appwrite Console.
 */
async function awardPointsDirect(
  orgId: string,
  userId: string,
  eventKey: string,
  refTable: string | null,
  refId: string | null
): Promise<number> {
  try {
    const ruleDoc = await getDocument<{ points?: number; is_active?: boolean }>(
      COLLECTIONS.points_rules,
      eventKey
    );
    if (!ruleDoc || ruleDoc.is_active === false) return 0;
    const points = ruleDoc.points ?? 0;
    if (points <= 0) return 0;

    if (refTable && refId) {
      const { data: existing } = await listDocuments(COLLECTIONS.points_events, [
        Query.equal('user_id', [userId]),
        Query.equal('event_key', [eventKey]),
        Query.equal('ref_table', [refTable]),
        Query.equal('ref_id', [refId]),
        Query.limit(1),
      ]);
      if (existing && existing.length > 0) return 0;
    }

    const now = new Date().toISOString();
    await createDocument(COLLECTIONS.points_events, {
      org_id: orgId,
      user_id: userId,
      event_key: eventKey,
      points,
      ref_table: refTable,
      ref_id: refId,
      created_at: now,
    });

    const { data: totalsList } = await listDocuments(COLLECTIONS.points_totals, [
      Query.equal('org_id', [orgId]),
      Query.equal('user_id', [userId]),
      Query.limit(1),
    ]);
    const tot = totalsList?.[0] as { $id?: string; total_points?: number } | undefined;
    if (tot?.$id) {
      const newTotal = (tot.total_points ?? 0) + points;
      await updateDocument(COLLECTIONS.points_totals, tot.$id, {
        total_points: newTotal,
        updated_at: now,
      });
    } else {
      await createDocument(COLLECTIONS.points_totals, {
        org_id: orgId,
        user_id: userId,
        total_points: points,
        updated_at: now,
      });
    }
    return points;
  } catch (e) {
    if (__DEV__ && e != null) {
      console.warn('[awardPointsDirect]', eventKey, e);
    }
    return 0;
  }
}

export async function awardPoints(
  orgId: string,
  userId: string,
  eventKey: string,
  refTable?: string | null,
  refId?: string | null
): Promise<number> {
  const refT = refTable ?? null;
  const refI = refId ?? null;

  try {
    const exec = await execFunction(
      'award_points',
      {
        p_org_id: orgId,
        p_user_id: userId,
        p_event_key: eventKey,
        p_ref_table: refT,
        p_ref_id: refI,
      },
      false
    );
    const raw = getResponseBody(exec);
    const data = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : 0;
    const points = typeof data === 'number' ? data : 0;
    if (points > 0) return points;
  } catch (e) {
    if (__DEV__ && e != null) {
      console.warn('[awardPoints] function failed, trying direct:', eventKey, e);
    }
  }

  return awardPointsDirect(orgId, userId, eventKey, refT, refI);
}
