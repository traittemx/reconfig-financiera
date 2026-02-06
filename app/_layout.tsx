import 'react-native-url-polyfill/auto';
import '../global.css';
import { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import 'react-native-reanimated';
import { config } from '@/tamagui.config';
import { AuthProvider } from '@/contexts/auth-context';
import { requestNotificationPermissions, hasRequestedPermissions } from '@/lib/notifications';

export default function RootLayout() {
  // Request notification permissions on first launch
  useEffect(() => {
    (async () => {
      const alreadyRequested = await hasRequestedPermissions();
      if (!alreadyRequested) {
        await requestNotificationPermissions();
      }
    })();
  }, []);

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <AuthProvider>
        <View
          style={{
            flex: 1,
            ...(Platform.OS === 'web' && { minHeight: '100vh' }),
          }}
        >
          <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(protected)" />
          </Stack>
          <StatusBar style="auto" />
        </View>
      </AuthProvider>
    </TamaguiProvider>
  );
}
