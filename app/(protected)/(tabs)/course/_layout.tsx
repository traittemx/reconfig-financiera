import { Stack } from 'expo-router';

export default function CourseLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Reprogramación Financiera' }} />
      <Stack.Screen name="[day]" options={{ title: 'Lección' }} />
    </Stack>
  );
}
