import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  account,
  getDocument,
  createDocument,
  listDocuments,
  COLLECTIONS,
  Query,
  docToRow,
  type AppwriteDocument,
} from '@/lib/appwrite';
import type { Profile, OrgSubscription } from '@/types/database';
import { isSubscriptionValid } from '@/types/database';

const SESSION_TIMEOUT_MS = 6000;
const PROFILE_TIMEOUT_MS = 8000;
const AUTH_CACHE_KEY = 'finaria_auth_cache';
const AUTH_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function delay(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/** Minimal session shape for compatibility (Appwrite has no Session type in client; we use user id). */
export interface AppwriteAuthSession {
  user: { id: string; email?: string };
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

async function setAuthCache(
  userId: string,
  profile: Profile | null,
  subscription: OrgSubscription | null
): Promise<void> {
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

function mapSubscriptionDoc(doc: AppwriteDocument): OrgSubscription {
  return {
    org_id: (doc.$id ?? doc.org_id) as string,
    status: doc.status as OrgSubscription['status'],
    seats_total: (doc.seats_total as number) ?? 0,
    seats_used: (doc.seats_used as number) ?? 0,
    period_start: (doc.period_start as string) ?? null,
    period_end: (doc.period_end as string) ?? null,
    updated_at: (doc.$updatedAt ?? doc.updated_at) as string,
  };
}

/**
 * Obtiene el perfil por userId sin provocar 404: usa listDocuments (200 + lista vacía)
 * en lugar de getDocument (404 cuando no existe).
 */
async function getProfileByUserId(userId: string): Promise<AppwriteDocument | null> {
  const { data, total } = await listDocuments<AppwriteDocument>(COLLECTIONS.profiles, [
    Query.equal('$id', [userId]),
    Query.limit(1),
  ]);
  if (total === 0 || !data?.[0]) return null;
  return data[0];
}

/** Si el usuario tiene sesión pero no tiene documento en profiles, intenta crear uno mínimo. */
async function tryCreateMinimalProfile(userId: string): Promise<Profile | null> {
  try {
    const user = await account.get();
    const name = (user as { name?: string }).name ?? (user as { email?: string }).email ?? 'Usuario';
    const now = new Date().toISOString();
    await createDocument(
      COLLECTIONS.profiles,
      {
        full_name: name,
        role: 'EMPLOYEE',
        created_at: now,
        updated_at: now,
      },
      userId
    );
    const doc = await getProfileByUserId(userId);
    if (!doc) return null;
    const profileData = docToRow(doc) as unknown as Profile;
    if (!profileData.id) profileData.id = userId;
    return profileData;
  } catch {
    return null;
  }
}

interface AuthState {
  session: AppwriteAuthSession | null;
  profile: Profile | null;
  subscription: OrgSubscription | null;
  loading: boolean;
  canAccessApp: boolean;
  refresh: () => Promise<void>;
  /** After login/signup: pass user id and load profile/subscription. Returns { ok: true } or { ok: false, error?: string }. */
  setSessionAndLoadProfile: (userId: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppwriteAuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndSubscription = useCallback(async (userId: string) => {
    try {
      let doc = await getProfileByUserId(userId);
      if (!doc) doc = (await tryCreateMinimalProfile(userId)) ? await getProfileByUserId(userId) : null;
      if (!doc) {
        setProfile(null);
        setSubscription(null);
        return;
      }
      const profileData = docToRow(doc) as unknown as Profile;
      if (!profileData.id) profileData.id = userId;
      setProfile(profileData);
      const orgId = profileData?.org_id ?? null;
      if (!orgId) {
        setSubscription(null);
        if (profileData) setAuthCache(userId, profileData, null);
        return;
      }
      const subDoc = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, orgId);
      const subData = mapSubscriptionDoc(subDoc);
      setSubscription(subData);
      if (profileData) setAuthCache(userId, profileData, subData);
    } catch {
      setProfile(null);
      setSubscription(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    let user: { $id: string; email?: string } | null = null;
    try {
      const result = await Promise.race([account.get(), delay(SESSION_TIMEOUT_MS)]);
      user = result as { $id: string; email?: string };
    } catch {
      user = null;
    }
    setLoading(false);
    if (!user?.$id) {
      setSession(null);
      setProfile(null);
      setSubscription(null);
      clearAuthCache();
      return;
    }
    const userId = user.$id;
    setSession({ user: { id: userId, email: user.email } });

    let cached: AuthCache | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      cached = getAuthCacheSync();
    } else {
      cached = await getAuthCacheAsync();
    }
    if (cached && cached.userId === userId) {
      setProfile(cached.profile);
      setSubscription(cached.subscription);
      loadProfileAndSubscription(userId);
      return;
    }
    setLoading(true);
    try {
      let doc = await getProfileByUserId(userId);
      let prof: Profile | null = doc ? (docToRow(doc) as unknown as Profile) : null;
      if (!prof) {
        prof = await tryCreateMinimalProfile(userId);
      }
      if (prof && !prof.id) prof.id = userId;
      setProfile(prof);
      const orgId = prof?.org_id ?? null;
      if (!orgId) {
        setSubscription(null);
        if (prof) setAuthCache(userId, prof, null);
        setLoading(false);
        return;
      }
      const subDoc = await getDocument<AppwriteDocument>(
        COLLECTIONS.org_subscriptions,
        orgId
      ).catch(() => null);
      const subData = subDoc ? mapSubscriptionDoc(subDoc) : null;
      setSubscription(subData);
      if (prof) setAuthCache(userId, prof, subData);
    } catch {
      setProfile(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [loadProfileAndSubscription]);

  const setSessionAndLoadProfile = useCallback(async (userId: string): Promise<{ ok: boolean; error?: string }> => {
    setSession({ user: { id: userId } });
    setLoading(true);
    try {
      let doc = await Promise.race([
        getProfileByUserId(userId),
        delay(PROFILE_TIMEOUT_MS),
      ]).catch(() => null);
      let prof: Profile | null = doc ? (docToRow(doc) as unknown as Profile) : null;
      if (!prof) {
        prof = await tryCreateMinimalProfile(userId);
      }
      if (prof && !prof.id) prof.id = userId;
      setProfile(prof);
      const orgId = prof?.org_id ?? null;
      if (!orgId) {
        setSubscription(null);
        setLoading(false);
        return { ok: !!prof };
      }
      const subDoc = await getDocument<AppwriteDocument>(
        COLLECTIONS.org_subscriptions,
        orgId
      ).catch(() => null);
      const subData = subDoc ? mapSubscriptionDoc(subDoc) : null;
      setSubscription(subData);
      if (prof) setAuthCache(userId, prof, subData);
      setLoading(false);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProfile(null);
      setSubscription(null);
      setLoading(false);
      return { ok: false, error: message };
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
