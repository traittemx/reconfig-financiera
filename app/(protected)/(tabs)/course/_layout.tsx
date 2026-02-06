import { Stack } from 'expo-router';

export default function CourseLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Finaria' }} />
      <Stack.Screen name="[day]" options={{ headerShown: false }} />
    </Stack>
  );
}
