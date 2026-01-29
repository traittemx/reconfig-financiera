import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';

export default function SuperadminDashboardScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Super Admin</Text>
      <Text style={styles.subtitle}>Gestiona organizaciones y suscripciones manuales</Text>
      <Button
        theme="blue"
        size="$4"
        onPress={() => router.push('/superadmin/organizations')}
        style={styles.btn}
      >
        Organizaciones
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
