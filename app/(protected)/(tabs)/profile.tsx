import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { account } from '@/lib/appwrite';
import { EmotionalCheckin } from '@/components/pilot/EmotionalCheckin';
import { listDocuments, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { Sparkles, Star } from '@tamagui/lucide-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, subscription, refresh } = useAuth();
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean | null>(null);
  const [hasCompletedArchetypeQuiz, setHasCompletedArchetypeQuiz] = useState<boolean | null>(null);

  const fetchQuizStatus = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await listDocuments<AppwriteDocument>(
        COLLECTIONS.financial_personality_results,
        [Query.equal('user_id', [profile.id]), Query.limit(1)]
      );
      setHasCompletedQuiz(data.length > 0);
    } catch {
      setHasCompletedQuiz(false);
    }
    try {
      const { data: archetypeData } = await listDocuments<AppwriteDocument>(
        COLLECTIONS.financial_archetype_results,
        [Query.equal('user_id', [profile.id]), Query.limit(1)]
      );
      setHasCompletedArchetypeQuiz(archetypeData.length > 0);
    } catch {
      setHasCompletedArchetypeQuiz(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchQuizStatus();
  }, [fetchQuizStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchQuizStatus();
    }, [fetchQuizStatus])
  );

  async function signOut() {
    try {
      await account.deleteSessions();
    } catch {}
    await refresh();
    router.replace('/(public)/auth');
  }

  function handleQuizPress() {
    if (hasCompletedQuiz) {
      router.push('/(tabs)/financial-personality-results');
    } else {
      router.push('/(tabs)/financial-personality-quiz');
    }
  }

  function handleArchetypeQuizPress() {
    if (hasCompletedArchetypeQuiz) {
      router.push('/(tabs)/financial-archetype-results');
    } else {
      router.push('/(tabs)/financial-archetype-quiz');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{profile?.full_name || 'Usuario'}</Text>
      {profile?.id ? (
        <View style={styles.checkinWrap}>
          <EmotionalCheckin userId={profile.id} date={new Date()} compact />
        </View>
      ) : null}
      <Button
        theme={hasCompletedQuiz ? 'green' : 'blue'}
        size="$4"
        onPress={handleQuizPress}
        style={[
          { marginTop: 16, marginBottom: 16 },
          hasCompletedQuiz && styles.completedButton,
        ]}
        icon={Sparkles}
      >
        {hasCompletedQuiz === null
          ? 'Cargando...'
          : hasCompletedQuiz
          ? 'Ver mi Personalidad Financiera'
          : 'Descubre tu Personalidad Financiera'}
      </Button>
      <Button
        theme={hasCompletedArchetypeQuiz ? 'green' : 'blue'}
        size="$4"
        onPress={handleArchetypeQuizPress}
        style={[
          { marginTop: 0, marginBottom: 16 },
          hasCompletedArchetypeQuiz && styles.completedButton,
        ]}
        icon={Star}
      >
        {hasCompletedArchetypeQuiz === null
          ? 'Cargando...'
          : hasCompletedArchetypeQuiz
          ? 'Ver mi Arquetipo Financiero'
          : 'Descubre tu Arquetipo Financiero'}
      </Button>
      <Text style={styles.role}>Rol: {profile?.role}</Text>
      {subscription && (
        <Text style={styles.sub}>
          Suscripción: {subscription.status} · {subscription.seats_used}/{subscription.seats_total} plazas
        </Text>
      )}
      {(profile?.role === 'ORG_ADMIN' || profile?.role === 'SUPER_ADMIN') && (
        <Button
          theme="blue"
          size="$4"
          onPress={() => router.push('/org')}
          style={{ marginTop: 24 }}
        >
          Admin empresa
        </Button>
      )}
      {profile?.role === 'SUPER_ADMIN' && (
        <Button
          theme="red"
          size="$4"
          onPress={() => router.push('/superadmin')}
          style={{ marginTop: 16 }}
        >
          Super Admin
        </Button>
      )}
      <Button theme="gray" size="$4" onPress={signOut} style={{ marginTop: 32 }}>
        Cerrar sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && { minHeight: '100%' }),
  },
  name: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  role: { fontSize: 16, color: '#666', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 16 },
  checkinWrap: { marginBottom: 20 },
  completedButton: {
    backgroundColor: '#059669',
  },
});
