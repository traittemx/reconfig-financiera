import { AuthProvider } from '@/contexts/auth-context';
import { config } from '@/tamagui.config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import { TamaguiProvider } from 'tamagui';
import '../global.css';

export default function RootLayout() {
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
          </Stack>
          <StatusBar style="auto" />
        </View>
      </AuthProvider>
    </TamaguiProvider>
  );
}
