import { execFunction } from '@/lib/appwrite';

export async function awardPoints(
  orgId: string,
  userId: string,
  eventKey: string,
  refTable?: string | null,
  refId?: string | null
): Promise<number> {
  try {
    const exec = await execFunction(
      'award_points',
      {
        p_org_id: orgId,
        p_user_id: userId,
        p_event_key: eventKey,
        p_ref_table: refTable ?? null,
        p_ref_id: refId ?? null,
      },
      false
    );
    const raw = (exec as { responseBody?: string }).responseBody ?? '';
    const data = typeof raw === 'string' && raw ? JSON.parse(raw) : 0;
    return typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
}
