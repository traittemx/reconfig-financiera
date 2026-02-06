import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Share, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import {
  listDocuments,
  getDocument,
  createDocument,
  COLLECTIONS,
  Query,
  ID,
  type AppwriteDocument,
} from '@/lib/appwrite';

function generateInviteToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const PLACEHOLDER_EMAIL_PREFIX = 'invite-';
const PLACEHOLDER_EMAIL_SUFFIX = '@invite.temp';

type OrgMember = { user_id: string; role_in_org: string; status: string; profiles?: { full_name: string | null } | null };

export default function OrgEmployeesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<{ seats_used: number; seats_total: number } | null>(null);

  useEffect(() => {
    if (!profile?.org_id) return;
    (async () => {
      try {
        const sub = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, profile.org_id!);
        setSubscription({
          seats_used: (sub.seats_used as number) ?? 0,
          seats_total: (sub.seats_total as number) ?? 0,
        });
      } catch {
        setSubscription(null);
      }
      const { data: membersData } = await listDocuments<AppwriteDocument>(COLLECTIONS.org_members, [
        Query.equal('org_id', [profile.org_id!]),
        Query.equal('status', ['active']),
        Query.limit(200),
      ]);
      const userIds = membersData.map((m) => (m as AppwriteDocument).user_id as string);
      const profileMap = new Map<string, string | null>();
      for (const uid of userIds) {
        try {
          const p = await getDocument<AppwriteDocument>(COLLECTIONS.profiles, uid);
          profileMap.set(uid, (p.full_name as string | null) ?? null);
        } catch {}
      }
      const list: OrgMember[] = membersData.map((m) => {
        const doc = m as AppwriteDocument;
        return {
          user_id: doc.user_id as string,
          role_in_org: doc.role_in_org as string,
          status: doc.status as string,
          profiles: { full_name: profileMap.get(doc.user_id as string) ?? null },
        };
      });
      setMembers(list);
    })();
  }, [profile?.org_id]);

  async function generateInviteCode() {
    if (!profile?.org_id) return;
    if (subscription && subscription.seats_used >= subscription.seats_total) {
      Alert.alert('No hay plazas', 'Plazas usadas >= total. Ajusta la suscripción.');
      return;
    }
    setLoading(true);
    try {
      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const placeholderEmail = `${PLACEHOLDER_EMAIL_PREFIX}${token}${PLACEHOLDER_EMAIL_SUFFIX}`;
      await createDocument(COLLECTIONS.org_invites, {
        org_id: profile.org_id,
        email: placeholderEmail,
        role: 'EMPLOYEE',
        token,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, ID.unique());
      const origin = typeof window !== 'undefined' ? window.location?.origin ?? '' : '';
      const link = `${origin}/invite/${token}`;
      setInviteToken(token);
      setInviteLink(link);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar el código');
    }
    setLoading(false);
  }

  async function shareInviteLink() {
    if (!inviteLink) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        Alert.alert('Copiado', 'El enlace se ha copiado al portapapeles.');
      } else if (Share.share) {
        await Share.share({ message: inviteLink, url: inviteLink, title: 'Invitación a la empresa' });
      }
    } catch {
      Alert.alert('Error', 'No se pudo compartir el enlace');
    }
  }

  return (
    <View style={styles.container}>
      {subscription && (
        <Text style={styles.seats}>
          Plazas: {subscription.seats_used} / {subscription.seats_total}
        </Text>
      )}
      <Text style={styles.section}>Código de invitación</Text>
      <Text style={styles.instructions}>
        Comparte el enlace o el código con los empleados. Cada empleado debe abrir el enlace una sola vez para registrarse y unirse a la organización.
      </Text>
      {inviteLink ? (
        <View style={styles.codeBlock}>
          <Text style={styles.codeLabel}>Enlace de invitación</Text>
          <Text style={styles.codeValue} selectable>{inviteLink}</Text>
          <Text style={styles.codeLabel}>Código (solo si te lo piden)</Text>
          <Text style={styles.codeValue} selectable>{inviteToken}</Text>
          <Button theme="blue" size="$3" onPress={shareInviteLink} marginTop={12}>
            Copiar / Compartir enlace
          </Button>
        </View>
      ) : null}
      <Button theme="blue" onPress={generateInviteCode} disabled={loading} marginTop={inviteLink ? 8 : 0}>
        {loading ? 'Generando...' : inviteLink ? 'Generar otro código' : 'Generar código de invitación'}
      </Button>

      <Text style={[styles.section, styles.instructionsTitle]}>Cómo registrarse (para empleados)</Text>
      <Text style={styles.instructions}>
        1. Abre el enlace de invitación que te ha enviado tu empresa.{'\n'}
        2. Si no tienes cuenta, escribe tu nombre completo, tu email y una contraseña.{'\n'}
        3. Si ya tienes cuenta con ese email, inicia sesión y acepta unirte.{'\n'}
        4. Tras aceptar, quedarás unido a la organización.
      </Text>

      <Text style={[styles.section, { marginTop: 24 }]}>Empleados</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.user_id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>
              {(item.profiles as { full_name: string } | null)?.full_name ?? item.user_id}
            </Text>
            <Text style={styles.role}>{item.role_in_org}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  seats: { marginBottom: 16, fontWeight: '600', color: '#666' },
  section: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  instructionsTitle: { marginTop: 8 },
  instructions: { fontSize: 14, color: '#444', marginBottom: 12, lineHeight: 22 },
  codeBlock: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  codeLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  codeValue: { fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 12 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  name: { flex: 1, fontWeight: '600' },
  role: { fontSize: 12, color: '#666' },
});
