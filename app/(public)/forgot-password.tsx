import { useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Button } from 'tamagui';
import { Mail } from '@tamagui/lucide-icons';
import * as Linking from 'expo-linking';
import { account } from '@/lib/appwrite';
import { AuthIllustration } from '@/components/auth-illustration';
import { AuthInput } from '@/components/auth-input';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendReset() {
    if (!email.trim()) {
      Alert.alert('Email necesario', 'Introduce el email asociado a tu cuenta.');
      return;
    }
    setLoading(true);
    try {
      const url = Linking.createURL('/(public)/auth');
      await account.createRecovery(email.trim(), url);
      Alert.alert(
        'Revisa tu correo',
        'Te hemos enviado un enlace para restablecer tu contraseña. Revisa la bandeja de entrada y la carpeta de spam.'
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar el enlace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <AuthIllustration variant="forgot" />
        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          No te preocupes. Introduce el email asociado a tu cuenta y te enviaremos un enlace.
        </Text>

        <AuthInput
          leftIcon={<Mail size={20} color="#9ca3af" />}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!loading}
        />

        <Button
          theme="blue"
          size="$4"
          onPress={sendReset}
          disabled={loading}
          width="100%"
          style={styles.primaryButton}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            'Enviar enlace'
          )}
        </Button>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Recuerdas tu contraseña? </Text>
          <Link href="/(public)/auth" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Iniciar sesión</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f3f4f6',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
});
