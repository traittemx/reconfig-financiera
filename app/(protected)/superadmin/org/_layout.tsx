import { Stack } from 'expo-router';

export default function OrgDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="[orgId]" options={{ title: 'Detalles organización' }} />
    </Stack>
  );
}
