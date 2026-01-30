import { useState, useCallback, useEffect } from 'react';
import { listDocuments, COLLECTIONS, Query } from '@/lib/appwrite';

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
    try {
      const { data } = await listDocuments(COLLECTIONS.points_totals, [
        Query.equal('org_id', [orgId]),
        Query.equal('user_id', [userId]),
        Query.limit(1),
      ]);
      const doc = data[0];
      setTotalPoints((doc as { total_points?: number })?.total_points ?? 0);
    } catch {
      setTotalPoints(0);
    }
    setLoading(false);
  }, [orgId, userId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return { totalPoints, loading, refresh: fetchPoints };
}
