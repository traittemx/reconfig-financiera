import { Tabs } from 'expo-router';
import { BookOpen, Wallet, Trophy, User } from '@tamagui/lucide-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
      }}
    >
      <Tabs.Screen
        name="course"
        options={{
          title: 'Curso',
          tabBarLabel: 'Curso',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
          headerTitle: 'Curso 23 días',
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finanzas',
          tabBarLabel: 'Finanzas',
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
          headerTitle: 'Finanzas',
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarLabel: 'Ranking',
          tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} />,
          headerTitle: 'Leaderboard',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          headerTitle: 'Mi perfil',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
    </Tabs>
  );
}
