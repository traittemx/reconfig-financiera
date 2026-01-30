import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform } from 'react-native';
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

type OrgMember = { user_id: string; role_in_org: string; status: string; profiles?: { full_name: string | null } | null };

export default function OrgEmployeesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ORG_ADMIN' | 'EMPLOYEE'>('EMPLOYEE');
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

  async function sendInvite() {
    if (!inviteEmail.trim() || !profile?.org_id) return;
    if (subscription && subscription.seats_used >= subscription.seats_total) {
      Alert.alert('No hay plazas', 'Seats usados >= total. Ajusta la suscripción.');
      return;
    }
    setLoading(true);
    try {
      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await createDocument(COLLECTIONS.org_invites, {
        org_id: profile.org_id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        token,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, ID.unique());
      const link = `${typeof window !== 'undefined' ? window.location?.origin : ''}/invite/${token}`;
      Alert.alert('Invitación creada', `Envía este enlace por email: ${link}`);
      setInviteEmail('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo crear la invitación');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      {subscription && (
        <Text style={styles.seats}>
          Plazas: {subscription.seats_used} / {subscription.seats_total}
        </Text>
      )}
      <Text style={styles.section}>Invitar empleado</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={inviteEmail}
        onChangeText={setInviteEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Rol: EMPLOYEE o ORG_ADMIN"
        value={inviteRole}
        onChangeText={(t) => setInviteRole(t as 'ORG_ADMIN' | 'EMPLOYEE')}
        editable={!loading}
      />
      <Button theme="blue" onPress={sendInvite} disabled={loading}>
        {loading ? 'Enviando...' : 'Crear invitación'}
      </Button>
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
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
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
