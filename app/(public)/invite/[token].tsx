import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import {
  account,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  COLLECTIONS,
  Query,
  ID,
  docToRow,
  type AppwriteDocument,
} from '@/lib/appwrite';
import { useAuth } from '@/contexts/auth-context';
import { toLocalDateString } from '@/lib/business-days';

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [invite, setInvite] = useState<{
    id: string;
    org_id: string;
    email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
  } | null>(null);
  const [subscription, setSubscription] = useState<{ seats_used: number; seats_total: number } | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlaceholderInvite = invite?.email?.startsWith('invite-') && invite?.email?.endsWith('@invite.temp');
  const emailToUse = isPlaceholderInvite ? email.trim() : (invite?.email ?? '');

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      return;
    }
    (async () => {
      try {
        const { data: docs } = await listDocuments<AppwriteDocument>(
          COLLECTIONS.org_invites,
          [Query.equal('token', [token])]
        );
        const doc = docs[0];
        if (!doc) {
          setError('Invitación no encontrada o expirada');
          return;
        }
        const inv = docToRow(doc) as unknown as { id: string; org_id: string; email: string; role: string; expires_at: string; accepted_at: string | null };
        inv.id = (doc as AppwriteDocument).$id ?? inv.id;
        if (inv.accepted_at) {
          setError('Esta invitación ya fue aceptada');
          return;
        }
        if (new Date(inv.expires_at) < new Date()) {
          setError('Esta invitación ha expirado');
          return;
        }
        setInvite(inv);
        const subDoc = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, inv.org_id);
        setSubscription({
          seats_used: (subDoc.seats_used as number) ?? 0,
          seats_total: (subDoc.seats_total as number) ?? 0,
        });
      } catch {
        setError('Invitación no encontrada o expirada');
      }
    })();
  }, [token]);

  async function acceptInvite() {
    if (!invite || !subscription || !fullName.trim() || !password) {
      Alert.alert('Error', 'Completa nombre y contraseña');
      return;
    }
    if (isPlaceholderInvite && !email.trim()) {
      Alert.alert('Error', 'Introduce tu email');
      return;
    }
    if (subscription.seats_used >= subscription.seats_total) {
      Alert.alert('Error', 'No hay plazas disponibles. Contacta al administrador.');
      return;
    }
    setLoading(true);
    try {
      const finalEmail = emailToUse || invite.email;
      let userId: string;
      try {
        userId = ID.unique();
        await account.create(userId, finalEmail, password, fullName.trim());
        await account.createEmailPasswordSession(finalEmail, password);
      } catch (authError) {
        const msg = authError instanceof Error ? authError.message : String(authError);
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          await account.createEmailPasswordSession(finalEmail, password);
          const user = await account.get();
          if (!user?.$id) {
            setLoading(false);
            Alert.alert('Error', 'Ya existe una cuenta con este email. Usa "Iniciar sesión".');
            return;
          }
          userId = user.$id;
        } else {
          setLoading(false);
          Alert.alert('Error', msg);
          return;
        }
      }
      const now = new Date().toISOString();
      const memberId = `${invite.org_id}_${userId}`;
      await createDocument(
        COLLECTIONS.org_members,
        {
          org_id: invite.org_id,
          user_id: userId,
          role_in_org: invite.role,
          status: 'active',
          created_at: now,
        },
        memberId
      );
      try {
        await updateDocument(COLLECTIONS.profiles, userId, {
          full_name: fullName.trim(),
          org_id: invite.org_id,
          role: invite.role,
          start_date: toLocalDateString(new Date()),
          updated_at: now,
        });
      } catch {
        await createDocument(
          COLLECTIONS.profiles,
          {
            full_name: fullName.trim(),
            org_id: invite.org_id,
            role: invite.role,
            start_date: toLocalDateString(new Date()),
            created_at: now,
            updated_at: now,
          },
          userId
        );
      }
      await updateDocument(COLLECTIONS.org_invites, invite.id, { accepted_at: now });
      const subDoc = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, invite.org_id);
      const used = ((subDoc.seats_used as number) ?? 0) + 1;
      await updateDocument(COLLECTIONS.org_subscriptions, invite.org_id, {
        seats_used: used,
        updated_at: now,
      });
      await refresh();
      router.replace('/(protected)/hoy');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo aceptar la invitación.');
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <Button onPress={() => router.replace('/(public)')}>Volver</Button>
      </View>
    );
  }
  if (!invite) {
    return (
      <View style={styles.container}>
        <Text>Cargando invitación...</Text>
      </View>
    );
  }
  if (subscription && subscription.seats_used >= subscription.seats_total) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No hay plazas disponibles en esta empresa.</Text>
        <Button onPress={() => router.replace('/(public)')}>Volver</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unirte a la empresa</Text>
      {!isPlaceholderInvite && <Text style={styles.subtitle}>Email: {invite.email}</Text>}
      {isPlaceholderInvite && (
        <TextInput
          style={styles.input}
          placeholder="Tu email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Tu nombre completo"
        value={fullName}
        onChangeText={setFullName}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña (mín. 6)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <Button theme="blue" size="$4" onPress={acceptInvite} disabled={loading}>
        {loading ? 'Uniendo...' : 'Aceptar invitación'}
      </Button>
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { marginBottom: 24, textAlign: 'center', color: '#666' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  error: { color: '#b91c1c', marginBottom: 16, textAlign: 'center' },
});
