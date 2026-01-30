import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Profile, OrgSubscription } from '@/types/database';
import { isSubscriptionValid } from '@/types/database';

const SESSION_TIMEOUT_MS = 6000;
const PROFILE_TIMEOUT_MS = 8000;
const AUTH_CACHE_KEY = 'finaria_auth_cache';
const AUTH_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function delay(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

type AuthCache = { userId: string; profile: Profile; subscription: OrgSubscription | null; ts: number };

function getAuthCacheSync(): AuthCache | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AuthCache;
    if (!data?.userId || !data?.profile || !data?.ts) return null;
    if (Date.now() - data.ts > AUTH_CACHE_MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function getAuthCacheAsync(): Promise<AuthCache | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AuthCache;
    if (!data?.userId || !data?.profile || !data?.ts) return null;
    if (Date.now() - data.ts > AUTH_CACHE_MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function setAuthCache(userId: string, profile: Profile | null, subscription: OrgSubscription | null): Promise<void> {
  if (!profile) return;
  const data: AuthCache = { userId, profile, subscription, ts: Date.now() };
  const raw = JSON.stringify(data);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(AUTH_CACHE_KEY, raw);
    } catch {}
  } else {
    try {
      await AsyncStorage.setItem(AUTH_CACHE_KEY, raw);
    } catch {}
  }
}

async function clearAuthCache(): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
    } catch {}
  }
  try {
    await AsyncStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  subscription: OrgSubscription | null;
  loading: boolean;
  canAccessApp: boolean;
  refresh: () => Promise<void>;
  /** Tras login: usa la sesión devuelta por Supabase y carga perfil/suscripción. Evita getSession() y race con storage (PWA). */
  setSessionAndLoadProfile: (session: Session) => Promise<void>;
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
    const profileData = (prof ?? null) as Profile | null;
    setProfile(profileData);
    const orgId = profileData?.org_id ?? null;
    if (!orgId) {
      setSubscription(null);
      if (profileData) setAuthCache(userId, profileData, null);
      return;
    }
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .single();
    const subData = (sub ?? null) as OrgSubscription | null;
    setSubscription(subData);
    if (profileData) setAuthCache(userId, profileData, subData);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);

    let s: Session | null = null;
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        delay(SESSION_TIMEOUT_MS),
      ]) as { data: { session: Session | null } };
      s = result?.data?.session ?? null;
    } catch {
      s = null;
    }
    setSession(s);
    setLoading(false);

    if (!s?.user) {
      setProfile(null);
      setSubscription(null);
      clearAuthCache();
      return;
    }

    const userId = s.user.id;

    // PWA / reapertura: usar caché local para abrir al instante; refrescar en segundo plano
    let cached: AuthCache | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      cached = getAuthCacheSync();
    } else {
      cached = await getAuthCacheAsync();
    }
    if (cached && cached.userId === userId) {
      setProfile(cached.profile);
      setSubscription(cached.subscription);
      loadProfileAndSubscription(userId); // refrescar en segundo plano
      return;
    }

    try {
      const profilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
      const { data: p } = await Promise.race([
        profilePromise,
        delay(PROFILE_TIMEOUT_MS),
      ]).catch(() => ({ data: null })) as { data: Profile | null };
      const prof = p ?? null;
      setProfile(prof);
      const orgId = prof?.org_id ?? null;
      if (!orgId) {
        setSubscription(null);
        if (prof) setAuthCache(userId, prof, null);
        return;
      }
      const { data: sub } = await Promise.race([
        supabase.from('org_subscriptions').select('*').eq('org_id', orgId).single(),
        delay(PROFILE_TIMEOUT_MS),
      ]).catch(() => ({ data: null })) as { data: OrgSubscription | null };
      const subData = sub ?? null;
      setSubscription(subData);
      if (prof) setAuthCache(userId, prof, subData);
    } catch {
      setProfile(null);
      setSubscription(null);
    }
  }, [loadProfileAndSubscription]);

  const setSessionAndLoadProfile = useCallback(async (newSession: Session) => {
    setSession(newSession);
    setLoading(true);
    if (!newSession?.user) {
      setProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const profilePromise = supabase.from('profiles').select('*').eq('id', newSession.user.id).single();
      const { data: p } = await Promise.race([
        profilePromise,
        delay(PROFILE_TIMEOUT_MS),
      ]).catch(() => ({ data: null })) as { data: Profile | null };
      const prof = p ?? null;
      setProfile(prof);
      const orgId = prof?.org_id ?? null;
      if (!orgId) {
        setSubscription(null);
        setLoading(false);
        return;
      }
      const { data: sub } = await Promise.race([
        supabase.from('org_subscriptions').select('*').eq('org_id', orgId).single(),
        delay(PROFILE_TIMEOUT_MS),
      ]).catch(() => ({ data: null })) as { data: OrgSubscription | null };
      const subData = sub ?? null;
      setSubscription(subData);
      if (prof) setAuthCache(newSession.user.id, prof, subData);
    } catch {
      setProfile(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
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
        clearAuthCache();
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
        setSessionAndLoadProfile,
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
