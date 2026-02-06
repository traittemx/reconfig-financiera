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
import type { OrgSubscription } from '@/types/database';
import { AuthIllustration } from '@/components/auth-illustration';
import { AuthInput } from '@/components/auth-input';

/** En web Alert.alert no se muestra; usamos window.alert o mensaje en pantalla. */
function showError(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function SignupScreen() {
  const router = useRouter();
  const { setSessionAndLoadProfile, refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkingCode, setLinkingCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [orgPreview, setOrgPreview] = useState<{ valid: boolean; org_name: string | null } | null>(null);

  const validateCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setOrgPreview(null);
      return;
    }
    try {
      const exec = await execFunction('validate_linking_code', { p_code: trimmed }, false);
      const raw = exec.responseBody ?? (exec as { response?: string }).response ?? '';
      let data: unknown = null;
      if (typeof raw === 'string' && raw) {
        try {
          data = JSON.parse(raw);
          // Algunos entornos devuelven el body como string anidado
          if (typeof data === 'string') data = JSON.parse(data as string);
        } catch {
          data = null;
        }
      } else if (typeof raw === 'object' && raw !== null) {
        data = raw;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const result = row && typeof row === 'object' && (row as { valid?: boolean }).valid === true
        ? { valid: true as const, org_name: (row as { org_name?: string | null }).org_name ?? null }
        : { valid: false as const, org_name: null };
      setOrgPreview(result);
    } catch {
      setOrgPreview({ valid: false, org_name: null });
    }
  }, []);

  async function signUp() {
    setSignupError(null);
    if (!fullName.trim() || !email.trim() || !password || !linkingCode.trim()) {
      const msg = 'Completa todos los campos (nombre, email, contraseña y código de vinculación).';
      setSignupError(msg);
      showError('Error', msg);
      return;
    }
    if (password.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres';
      setSignupError(msg);
      showError('Error', msg);
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
      let subscriptionFromJoin: OrgSubscription | null = null;
      try {
        const exec = await execFunction(
          'join_org_with_code',
          { p_code: linkingCode.trim(), p_full_name: fullName.trim() },
          false
        );
        const raw = exec.responseBody ?? (exec as { response?: string }).response ?? '';
        if (typeof raw === 'string' && raw.trim()) {
          try {
            const data = JSON.parse(raw);
            if (data && typeof data.org_id === 'string' && !data.error) {
              subscriptionFromJoin = {
                org_id: data.org_id,
                status: (data.status === 'active' || data.status === 'trial' ? data.status : 'trial') as OrgSubscription['status'],
                seats_total: typeof data.seats_total === 'number' ? data.seats_total : 10,
                seats_used: typeof data.seats_used === 'number' ? data.seats_used : 0,
                period_start: data.period_start ?? null,
                period_end: data.period_end ?? null,
                updated_at: typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString(),
              };
            }
          } catch {
            /* ignorar si no viene suscripción */
          }
        }
      } catch (joinErr) {
        const msg = joinErr instanceof Error ? joinErr.message : String(joinErr);
        setSignupError(msg);
        if (msg.includes('CODE_INVALID')) {
          showError('Código inválido', 'El código de vinculación no es correcto. Verifica el código que te dio tu empresa.');
        } else if (msg.includes('NO_SEATS')) {
          showError('Sin plazas', 'No hay plazas disponibles en esta empresa. Contacta al administrador.');
        } else if (msg.includes('ALREADY_MEMBER')) {
          showError('Ya eres miembro', 'Ya perteneces a esta empresa.');
        } else {
          showError('Error', msg);
        }
        setLoading(false);
        return;
      }
      const result = await setSessionAndLoadProfile(actualUserId, subscriptionFromJoin);
      if (!result.ok) {
        const msg =
          result.error?.includes('not authorized') || result.error?.includes('401')
            ? 'Revisa los permisos en Appwrite: colecciones profiles y org_subscriptions deben tener Read (y Create en profiles) para el rol Users.'
            : result.error || 'Intenta iniciar sesión de nuevo desde la pantalla de login.';
        setSignupError(msg);
        showError('Cuenta creada pero no se pudo cargar el perfil', msg);
        setLoading(false);
        return;
      }
      router.replace('/(protected)/hoy');
    } catch (authError) {
      const msg = authError instanceof Error ? authError.message : 'No se pudo crear la cuenta.';
      setSignupError(msg);
      showError('Error', msg);
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
              const upper = t.toUpperCase();
              setLinkingCode(upper);
              validateCode(upper);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          {orgPreview?.valid && orgPreview.org_name && (
            <Text style={styles.orgPreview}>Te unirás a: {orgPreview.org_name}</Text>
          )}
          {orgPreview?.valid && !orgPreview.org_name && linkingCode.trim().length >= 4 && (
            <Text style={styles.orgPreview}>Código válido</Text>
          )}
          {orgPreview?.valid === false && linkingCode.trim().length >= 4 && (
            <Text style={styles.orgPreviewInvalid}>Código no reconocido</Text>
          )}

          {signupError ? (
            <Text style={styles.signupError}>{signupError}</Text>
          ) : null}

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
  signupError: {
    fontSize: 14,
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
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
