import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

export default function PublicLayout() {
  const router = useRouter();
  const { loading, session, canAccessApp } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (session && canAccessApp) {
      router.replace('/(protected)/hoy');
    }
  }, [loading, session, canAccessApp, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="invite/[token]" />
    </Stack>
  );
}
