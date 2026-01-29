import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';

export default function SubscriptionRequiredScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
        Suscripción requerida
      </Text>
      <Text style={{ textAlign: 'center', color: '#666', marginBottom: 24 }}>
        Tu período de prueba ha terminado o la suscripción no está activa. Contacta al administrador de tu empresa.
      </Text>
      <Button onPress={() => router.replace('/(public)/auth')}>Cerrar sesión</Button>
    </View>
  );
}
