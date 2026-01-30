import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { Mail, Lock, Eye, EyeOff } from '@tamagui/lucide-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { AuthIllustration } from '@/components/auth-illustration';
import { AuthInput } from '@/components/auth-input';

export default function AuthScreen() {
  const router = useRouter();
  const { setSessionAndLoadProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Introduce tu email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        Alert.alert('Error al entrar', error.message);
        return;
      }
      if (!data?.session) {
        Alert.alert('Error', 'No se recibió la sesión. Intenta de nuevo.');
        return;
      }
      await setSessionAndLoadProfile(data.session);
      router.replace('/(protected)/hoy');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
        <AuthIllustration variant="signin" />
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>
          Introduce tu email y contraseña para continuar
        </Text>

        <AuthInput
          leftIcon={<Mail size={20} color="#9ca3af" />}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!loading}
        />

        <AuthInput
          leftIcon={<Lock size={20} color="#9ca3af" />}
          rightIcon={
            showPassword ? (
              <EyeOff size={20} color="#9ca3af" />
            ) : (
              <Eye size={20} color="#9ca3af" />
            )
          }
          onRightPress={() => setShowPassword((v) => !v)}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          textContentType="password"
          editable={!loading}
        />

        <Link href="/(public)/forgot-password" asChild style={styles.forgotWrap}>
          <Pressable>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        </Link>

        <Button
          theme="blue"
          size="$4"
          onPress={signIn}
          disabled={loading}
          width="100%"
          style={styles.primaryButton}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            'Entrar'
          )}
        </Button>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>O continuar con</Text>
          <View style={styles.dividerLine} />
        </View>

        <Link href="/(public)/signup" asChild style={styles.signupLink}>
          <Button theme="gray" size="$4" variant="outlined" width="100%">
            Crear cuenta y vincularme a una empresa
          </Button>
        </Link>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <Link href="/(public)/signup" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Crear cuenta</Text>
            </Pressable>
          </Link>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingVertical: 32,
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
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  primaryButton: {
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#9ca3af',
  },
  signupLink: {
    width: '100%',
    marginBottom: 20,
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
