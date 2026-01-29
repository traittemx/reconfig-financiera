import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';

export default function OrgDashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin empresa</Text>
      <Text style={styles.subtitle}>Gestiona empleados, progreso y ranking</Text>
      <Button
        theme="blue"
        size="$4"
        onPress={() => router.push('/org/employees')}
        style={styles.btn}
      >
        Empleados
      </Button>
      <Button
        theme="blue"
        size="$4"
        onPress={() => router.push('/org/progress')}
        style={styles.btn}
      >
        Progreso del curso
      </Button>
      <Button
        theme="blue"
        size="$4"
        onPress={() => router.push('/org/leaderboard')}
        style={styles.btn}
      >
        Leaderboard
      </Button>
      <Button onPress={() => router.back()} theme="gray" size="$3" style={{ marginTop: 24 }}>
        Volver
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24 },
  btn: { marginBottom: 12 },
});
