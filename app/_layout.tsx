import '../global.css';
import { TamaguiProvider } from 'tamagui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { config } from '@/tamagui.config';
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="(public)">
          <Stack.Screen name="(public)" />
          <Stack.Screen name="(protected)" />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </TamaguiProvider>
  );
}
