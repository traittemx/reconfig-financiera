import { Stack } from 'expo-router';

export default function FinanceLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Overview' }} />
      <Stack.Screen name="accounts" options={{ title: 'Cuentas' }} />
      <Stack.Screen name="transactions" options={{ title: 'Transacciones' }} />
      <Stack.Screen name="budgets" options={{ title: 'Presupuestos' }} />
      <Stack.Screen name="categories" options={{ title: 'Categorías' }} />
    </Stack>
  );
}
