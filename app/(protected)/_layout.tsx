import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

export default function ProtectedLayout() {
  const router = useRouter();
  const { session, profile, loading, canAccessApp } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(public)/auth');
      return;
    }
    if (!profile) {
      return;
    }
    if (!canAccessApp) {
      router.replace('/(protected)/subscription-required');
    }
  }, [loading, session, profile, canAccessApp, router]);

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="subscription-required" />
      <Stack.Screen name="org" />
      <Stack.Screen name="superadmin" />
    </Stack>
  );
}
