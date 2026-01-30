import React, { createContext, useContext } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useMyPoints } from '@/lib/useMyPoints';

interface PointsState {
  totalPoints: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PointsContext = createContext<PointsState | null>(null);

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { totalPoints, loading, refresh } = useMyPoints(profile?.org_id ?? undefined, profile?.id ?? undefined);

  return (
    <PointsContext.Provider value={{ totalPoints, loading, refresh }}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const ctx = useContext(PointsContext);
  return ctx;
}
