import { AuthProvider } from '@/contexts/auth-context';
import { hasRequestedPermissions, requestNotificationPermissions } from '@/lib/notifications';
import { config } from '@/tamagui.config';
import * as QuickActions from "expo-quick-actions";
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import { TamaguiProvider } from 'tamagui';
import '../global.css';

export default function RootLayout() {
  const router = useRouter();

  // Handle Quick Actions
  useEffect(() => {
    // Set initial quick actions
    QuickActions.setItems([
      {
        title: "Nuevo Ingreso",
        subtitle: "Añadir dinero",
        icon: "add", // iOS SF Symbol or Android resource
        id: "new_income",
        params: { href: "/(protected)/(tabs)/finance/transactions?new=1&kind=INCOME" },
      },
      {
        title: "Nuevo Gasto",
        subtitle: "Registrar salida",
        icon: "minus",
        id: "new_expense",
        params: { href: "/(protected)/(tabs)/finance/transactions?new=1&kind=EXPENSE" },
      },
    ]);

    // Handle initial action if app launched from one
    if (QuickActions.initialAction) {
      const action = QuickActions.initialAction as any;
      if (action.params?.href) {
        // Short delay to ensure router is ready
        setTimeout(() => {
          router.push(action.params.href);
        }, 500);
      }
    }

    // Listen for quick actions while app is running
    const subscription = QuickActions.addListener((action: any) => {
      if (action.params?.href) {
        router.push(action.params.href);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
