import { useAuth } from '@/contexts/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PILOT_CONTINUED_KEY = 'pilot_continued_date';

export default function HoyScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  useEffect(() => {
    handleContinuar();
  }, []);

  const handleContinuar = async () => {
    await AsyncStorage.setItem(PILOT_CONTINUED_KEY, format(new Date(), 'yyyy-MM-dd'));
    router.replace('/(tabs)/course');
  };

  if (false) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>¡Hola!</Text>
        <Text style={styles.subtitle}>Preparando tu día...</Text>
      </View>
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
