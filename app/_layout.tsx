import { config } from '@/tamagui.config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import { TamaguiProvider } from 'tamagui';
import '../global.css';

const rootViewStyle: StyleProp<ViewStyle> = [
  { flex: 1 },
  Platform.OS === 'web' && ({ minHeight: '100vh' } as unknown as ViewStyle),
];

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <View style={rootViewStyle}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="index" />
        </Stack>
        <StatusBar style="auto" />
      </View>
    </TamaguiProvider>
  );
}
