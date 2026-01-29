import { supabase } from '@/lib/supabase';

export async function awardPoints(
  orgId: string,
  userId: string,
  eventKey: string,
  refTable?: string | null,
  refId?: string | null
): Promise<number> {
  const { data, error } = await supabase.rpc('award_points', {
    p_org_id: orgId,
    p_user_id: userId,
    p_event_key: eventKey,
    p_ref_table: refTable ?? null,
    p_ref_id: refId ?? null,
  });
  if (error) {
    console.warn('award_points error:', error);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}
