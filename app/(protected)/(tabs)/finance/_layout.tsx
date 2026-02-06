import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from '@tamagui/lucide-icons';

function HeaderBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.navigate('/(tabs)/finance')}
      style={styles.backButton}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityLabel="Volver"
    >
      <ChevronLeft size={28} color="#0f172a" />
    </TouchableOpacity>
  );
}

const backHeaderOptions = {
  headerLeft: () => <HeaderBackButton />,
  headerBackVisible: false,
};

export default function FinanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f1f5f9' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Finanzas' }} />
      <Stack.Screen name="accounts" options={{ title: 'Cuentas', ...backHeaderOptions }} />
      <Stack.Screen name="transactions" options={{ title: 'Transacciones', ...backHeaderOptions }} />
      <Stack.Screen name="budgets" options={{ title: 'Presupuestos', ...backHeaderOptions }} />
      <Stack.Screen name="categories" options={{ title: 'Categorías', ...backHeaderOptions }} />
      <Stack.Screen name="net-worth" options={{ title: 'Patrimonio Líquido', ...backHeaderOptions }} />
      <Stack.Screen name="presupuesto-seguro-estilo" options={{ title: 'Presupuesto Seguro y Estilo', ...backHeaderOptions }} />
      <Stack.Screen name="flujo-efectivo" options={{ title: 'Flujo de efectivo', ...backHeaderOptions }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    marginLeft: Platform.OS === 'web' ? 4 : 8,
  },
});
