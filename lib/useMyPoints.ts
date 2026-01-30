import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useMyPoints(orgId: string | undefined, userId: string | undefined) {
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPoints = useCallback(async () => {
    if (!orgId || !userId) {
      setTotalPoints(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('points_totals')
      .select('total_points')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    setTotalPoints(data?.total_points ?? 0);
    setLoading(false);
  }, [orgId, userId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return { totalPoints, loading, refresh: fetchPoints };
}
