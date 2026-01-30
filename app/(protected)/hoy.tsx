import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { getOrCreateDailyRecommendation } from '@/lib/pilot';
import type { PilotRecommendation } from '@/types/pilot';
import { PilotCard } from '@/components/pilot/PilotCard';
import { EmotionalCheckin } from '@/components/pilot/EmotionalCheckin';

const PILOT_CONTINUED_KEY = 'pilot_continued_date';

export default function HoyScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [recommendation, setRecommendation] = useState<PilotRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id || !profile.org_id) {
      setLoading(false);
      return;
    }
    (async () => {
      setError(null);
      const rec = await getOrCreateDailyRecommendation(profile.id, profile.org_id, new Date());
      setRecommendation(rec ?? null);
      setLoading(false);
    })();
  }, [profile?.id, profile?.org_id]);

  const handleContinuar = async () => {
    await AsyncStorage.setItem(PILOT_CONTINUED_KEY, format(new Date(), 'yyyy-MM-dd'));
    router.replace('/(tabs)/course');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Preparando tu recomendación del día...</Text>
      </View>
    );
  }

  if (error || !recommendation) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error ?? 'No pudimos cargar tu recomendación. Intenta de nuevo.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleContinuar}>
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tu Piloto Financiero</Text>
        <Text style={styles.subtitle}>Recomendación de hoy</Text>
      </View>
      <PilotCard recommendation={recommendation} />
      {profile?.id ? (
        <EmotionalCheckin userId={profile.id} date={new Date()} compact />
      ) : null}
      <TouchableOpacity
        style={styles.button}
        onPress={handleContinuar}
        activeOpacity={0.9}
        accessibilityLabel="Continuar a mi día"
      >
        <Text style={styles.buttonText}>Ver mi día</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 48 : 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 24,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748b',
  },
  errorText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
