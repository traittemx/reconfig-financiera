import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, OrgSubscription } from '@/types/database';
import { isSubscriptionValid } from '@/types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  subscription: OrgSubscription | null;
  loading: boolean;
  canAccessApp: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndSubscription = useCallback(async (userId: string) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile((prof ?? null) as Profile | null);
    const orgId = (prof as Profile | null)?.org_id ?? null;
    if (!orgId) {
      setSubscription(null);
      return;
    }
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .single();
    setSubscription((sub ?? null) as OrgSubscription | null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (s?.user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
      const prof = (p ?? null) as Profile | null;
      setProfile(prof);
      const orgId = prof?.org_id ?? null;
      if (orgId) {
        const { data: sub } = await supabase
          .from('org_subscriptions')
          .select('*')
          .eq('org_id', orgId)
          .single();
        setSubscription((sub ?? null) as OrgSubscription | null);
      } else {
        setSubscription(null);
      }
    } else {
      setProfile(null);
      setSubscription(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        await loadProfileAndSubscription(s.user.id);
      } else {
        setProfile(null);
        setSubscription(null);
      }
    });
    return () => {
      authSub.unsubscribe();
    };
  }, [loadProfileAndSubscription, refresh]);

  const canAccessApp =
    !!session &&
    !!profile &&
    (profile.role === 'SUPER_ADMIN' ||
      (profile.org_id &&
        subscription &&
        isSubscriptionValid(subscription.status, subscription.period_end)));

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        subscription,
        loading,
        canAccessApp,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
