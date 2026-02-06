import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

export default function PublicLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { loading, session, canAccessApp } = useAuth();

  // Get current route name within public group
  const currentRoute = segments[1] || 'index';

  useEffect(() => {
    if (loading) return;
    
    // Only redirect authenticated users to protected area
    // BUT only if they're trying to access auth pages, not the landing
    if (session && canAccessApp && currentRoute !== 'index') {
      router.replace('/(protected)/hoy');
    }
  }, [loading, session, canAccessApp, currentRoute, router]);

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="invite/[token]" />
    </Stack>
  );
}
