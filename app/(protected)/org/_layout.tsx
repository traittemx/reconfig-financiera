import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

export default function OrgLayout() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const canAccess = profile?.role === 'ORG_ADMIN' || profile?.role === 'SUPER_ADMIN';
    if (!canAccess) {
      router.replace('/(tabs)');
    }
  }, [loading, profile?.role, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Cargando...</Text>
      </View>
    );
  }
  if (profile?.role !== 'ORG_ADMIN' && profile?.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Admin empresa' }} />
      <Stack.Screen name="employees" options={{ title: 'Empleados' }} />
      <Stack.Screen name="progress" options={{ title: 'Progreso curso' }} />
      <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
    </Stack>
  );
}
