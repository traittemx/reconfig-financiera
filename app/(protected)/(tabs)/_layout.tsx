import { Tabs } from 'expo-router';
import { BookOpen, Wallet, Trophy, User } from '@tamagui/lucide-icons';
import { PointsBadge } from '@/components/PointsBadge';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
        sceneContainerStyle: { flex: 1 },
        headerRight: () => <PointsBadge />,
      }}
    >
      <Tabs.Screen
        name="course"
        options={{
          title: 'Curso',
          tabBarLabel: 'Curso',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
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
      <Tabs.Screen
        name="financial-personality-quiz"
        options={{ href: null, headerShown: true, title: 'Quiz Personalidad Financiera' }}
      />
      <Tabs.Screen
        name="financial-personality-results"
        options={{ href: null, headerShown: true, title: 'Tu Personalidad Financiera' }}
      />
      <Tabs.Screen
        name="financial-archetype-quiz"
        options={{ href: null, headerShown: true, title: 'Quiz Arquetipo Financiero' }}
      />
      <Tabs.Screen
        name="financial-archetype-results"
        options={{ href: null, headerShown: true, title: 'Tu Arquetipo Financiero' }}
      />
    </Tabs>
  );
}
