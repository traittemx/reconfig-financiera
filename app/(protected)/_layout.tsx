import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { PointsProvider } from '@/contexts/points-context';

const PILOT_CONTINUED_KEY = 'pilot_continued_date';

export default function ProtectedLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, loading, canAccessApp, refresh } = useAuth();

  const loadingProfile = !!session && profile === null && loading;
  const profileFailed = !!session && profile === null && !loading;

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(public)/auth');
      return;
    }
    if (!profile) return;
    if (!canAccessApp) {
      router.replace('/(protected)/subscription-required');
      return;
    }
    if (!profile.org_id) return;
    if (pathname?.includes('hoy')) return;
    if (pathname?.includes('org') || pathname?.includes('superadmin')) return;
    if (pathname?.includes('subscription-required')) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    AsyncStorage.getItem(PILOT_CONTINUED_KEY).then((stored) => {
      if (stored !== today) {
        router.replace('/(protected)/hoy');
      }
    });
  }, [loading, session, profile, canAccessApp, pathname, router]);

  if (loading || loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>{loading ? 'Verificando sesión...' : 'Cargando perfil...'}</Text>
      </View>
    );
  }
  if (profileFailed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>No se pudo cargar tu perfil</Text>
        <Text style={styles.errorMessage}>Revisa tu conexión y pulsa Reintentar.</Text>
        <Pressable style={styles.retryButton} onPress={() => refresh()}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.replace('/(public)/auth')}>
          <Text style={styles.linkText}>Volver al login</Text>
        </Pressable>
      </View>
    );
  }
  if (!session) {
    return null;
  }

  return (
    <PointsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="hoy" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="subscription-required" />
        <Stack.Screen name="org" />
        <Stack.Screen name="superadmin" />
      </Stack>
    </PointsProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: { marginTop: 8, fontSize: 16, color: '#374151' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8, textAlign: 'center' },
  errorMessage: { fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { paddingVertical: 8 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
});
