import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { PointsProvider } from '@/contexts/points-context';

const PILOT_CONTINUED_KEY = 'pilot_continued_date';

export default function ProtectedLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, loading, canAccessApp } = useAuth();

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Cargando...</Text>
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
