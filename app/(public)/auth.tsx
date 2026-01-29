import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export default function AuthScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Email y contraseña requeridos');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await refresh();
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <Button theme="blue" size="$4" onPress={signIn} disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>
      <Link href="/(public)/signup" asChild style={{ marginTop: 16 }}>
        <Button theme="gray" size="$3" variant="outlined">
          Registrar empresa
        </Button>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
});
