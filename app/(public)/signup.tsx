import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { User, Mail, Lock, Eye, EyeOff, KeyRound } from '@tamagui/lucide-icons';
import { account, execFunction, ID, createDocument, COLLECTIONS } from '@/lib/appwrite';
import { useAuth } from '@/contexts/auth-context';
import { AuthIllustration } from '@/components/auth-illustration';
import { AuthInput } from '@/components/auth-input';

export default function SignupScreen() {
  const router = useRouter();
  const { setSessionAndLoadProfile, refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkingCode, setLinkingCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orgPreview, setOrgPreview] = useState<{ valid: boolean; org_name: string | null } | null>(null);

  const validateCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setOrgPreview(null);
      return;
    }
    try {
      const exec = await execFunction('validate_linking_code', { p_code: trimmed }, false);
      const raw = exec.responseBody ?? exec.response ?? '';
      const data = typeof raw === 'string' ? (raw ? JSON.parse(raw) : null) : raw;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.valid && row?.org_name) {
        setOrgPreview({ valid: true, org_name: row.org_name });
      } else {
        setOrgPreview({ valid: false, org_name: null });
      }
    } catch {
      setOrgPreview({ valid: false, org_name: null });
    }
  }, []);

  async function signUp() {
    if (!fullName.trim() || !email.trim() || !password || !linkingCode.trim()) {
      Alert.alert('Error', 'Completa todos los campos (nombre, email, contraseña y código de vinculación).');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const userId = ID.unique();
      const user = await account.create(userId, email.trim(), password, fullName.trim());
      const actualUserId = (user as { $id?: string })?.$id ?? userId;
      await account.createEmailPasswordSession(email.trim(), password);
      const now = new Date().toISOString();
      await createDocument(
        COLLECTIONS.profiles,
        {
          full_name: fullName.trim(),
          role: 'EMPLOYEE',
          created_at: now,
          updated_at: now,
        },
        actualUserId
      );
      try {
        await execFunction(
          'join_org_with_code',
          { p_code: linkingCode.trim(), p_full_name: fullName.trim() },
          false
        );
      } catch (joinErr) {
        const msg = joinErr instanceof Error ? joinErr.message : String(joinErr);
        if (msg.includes('CODE_INVALID')) {
          Alert.alert('Código inválido', 'El código de vinculación no es correcto. Verifica el código que te dio tu empresa.');
        } else if (msg.includes('NO_SEATS')) {
          Alert.alert('Sin plazas', 'No hay plazas disponibles en esta empresa. Contacta al administrador.');
        } else if (msg.includes('ALREADY_MEMBER')) {
          Alert.alert('Ya eres miembro', 'Ya perteneces a esta empresa.');
        } else {
          Alert.alert('Error', msg);
        }
        setLoading(false);
        return;
      }
      await setSessionAndLoadProfile(actualUserId);
      router.replace('/(protected)/hoy');
    } catch (authError) {
      Alert.alert('Error', authError instanceof Error ? authError.message : 'No se pudo crear la cuenta.');
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
          <AuthIllustration variant="signup" />
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>
            Introduce tus datos y el código de vinculación que te dio tu empresa
          </Text>

          <AuthInput
            leftIcon={<User size={20} color="#9ca3af" />}
            placeholder="Tu nombre completo"
            value={fullName}
            onChangeText={setFullName}
            editable={!loading}
          />

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
            placeholder="Contraseña (mín. 6 caracteres)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            editable={!loading}
          />

          <AuthInput
            leftIcon={<KeyRound size={20} color="#9ca3af" />}
            placeholder="Código de vinculación"
            value={linkingCode}
            onChangeText={(t) => {
              setLinkingCode(t.toUpperCase());
              validateCode(t);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          {orgPreview?.valid && orgPreview.org_name && (
            <Text style={styles.orgPreview}>Te unirás a: {orgPreview.org_name}</Text>
          )}
          {orgPreview?.valid === false && linkingCode.trim().length >= 4 && (
            <Text style={styles.orgPreviewInvalid}>Código no reconocido</Text>
          )}

          <Text style={styles.terms}>
            Al registrarte aceptas nuestros{' '}
            <Text style={styles.termsLink}>Términos y Condiciones</Text>
            {' '}y{' '}
            <Text style={styles.termsLink}>Política de Privacidad</Text>.
          </Text>

          <Button
            theme="blue"
            size="$4"
            onPress={signUp}
            disabled={loading}
            width="100%"
            style={styles.primaryButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              'Crear cuenta'
            )}
          </Button>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <Link href="/(public)/auth" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Iniciar sesión</Text>
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
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingVertical: 32, justifyContent: 'center' },
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
  orgPreview: { fontSize: 13, color: '#059669', marginTop: -8, marginBottom: 12 },
  orgPreviewInvalid: { fontSize: 13, color: '#dc2626', marginTop: -8, marginBottom: 12 },
  terms: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  termsLink: {
    color: '#2563eb',
    fontWeight: '500',
  },
  primaryButton: {
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
