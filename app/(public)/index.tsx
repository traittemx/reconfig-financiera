import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button } from 'tamagui';

export default function LandingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="mb-2 text-2xl font-bold text-gray-900">
        Reprogramación Financiera
      </Text>
      <Text className="mb-8 text-center text-gray-600">
        Finanzas personales y curso de 23 días para tu equipo
      </Text>
      <Link href="/(public)/auth" asChild>
        <Button theme="blue" size="$4">
          Iniciar sesión
        </Button>
      </Link>
      <Link href="/(public)/signup" asChild className="mt-4">
        <Button theme="gray" size="$4" variant="outlined">
          Registrar empresa
        </Button>
      </Link>
    </View>
  );
}
