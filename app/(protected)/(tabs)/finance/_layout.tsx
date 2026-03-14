import { PointsBadge } from '@/components/PointsBadge';
import { ChevronLeft } from '@tamagui/lucide-icons';
import { Stack, useRouter } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';

function HeaderBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(protected)/(tabs)/finance')}
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
        headerTitleStyle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f8fafc' },
        headerRight: () => <PointsBadge />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Finanzas' }} />
      <Stack.Screen name="accounts" options={{ title: 'Cuentas', ...backHeaderOptions }} />
      <Stack.Screen name="transactions" options={{ title: 'Transacciones', ...backHeaderOptions }} />
      <Stack.Screen name="budgets" options={{ title: 'Presupuestos', ...backHeaderOptions }} />
      <Stack.Screen name="categories" options={{ title: 'Categorías', ...backHeaderOptions }} />
      <Stack.Screen name="net-worth" options={{ title: 'Patrimonio Líquido', ...backHeaderOptions }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventario de Bienes', ...backHeaderOptions }} />
      <Stack.Screen name="presupuesto-seguro-estilo" options={{ title: 'Presupuesto Seguro y Estilo', ...backHeaderOptions }} />
      <Stack.Screen name="flujo-efectivo" options={{ title: 'Flujo de efectivo', ...backHeaderOptions }} />
      <Stack.Screen name="credit-cards" options={{ title: 'Tarjetas de Crédito', ...backHeaderOptions }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendario Financiero', ...backHeaderOptions }} />
      <Stack.Screen name="analysis" options={{ title: 'Análisis', ...backHeaderOptions }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    marginLeft: Platform.OS === 'web' ? 4 : 8,
  },
});
