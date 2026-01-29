import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

export default function SuperadminLayout() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'SUPER_ADMIN') {
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
  if (profile?.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Super Admin' }} />
      <Stack.Screen name="organizations" options={{ title: 'Organizaciones' }} />
    </Stack>
  );
}
