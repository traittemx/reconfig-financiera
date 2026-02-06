import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import { format } from 'date-fns';
import {
  listDocuments,
  getDocument,
  updateDocument,
  COLLECTIONS,
  Query,
  type AppwriteDocument,
} from '@/lib/appwrite';

type OrgMemberWithProgress = {
  user_id: string;
  member_doc_id: string;
  full_name: string | null;
  role_in_org: string;
  completed_count: number;
  completed_days: number[];
  last_completed: string | null;
  start_date: string | null;
};

const TOTAL_LESSONS = 23;

export default function SuperadminOrgDetailsScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [linkingCode, setLinkingCode] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string;
    seats_total: number;
    seats_used: number;
    period_start: string | null;
    period_end: string | null;
  } | null>(null);
  const [members, setMembers] = useState<OrgMemberWithProgress[]>([]);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orgId) {
      setError('Organización no especificada');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [orgDoc, membersRes, profilesRes, progressRes] = await Promise.all([
        getDocument<AppwriteDocument>(COLLECTIONS.organizations, orgId).catch(() => null),
        listDocuments<AppwriteDocument>(COLLECTIONS.org_members, [
          Query.equal('org_id', [orgId]),
          Query.equal('status', ['active']),
          Query.limit(200),
        ]),
        listDocuments<AppwriteDocument>(COLLECTIONS.profiles, [
          Query.equal('org_id', [orgId]),
          Query.limit(200),
        ]),
        listDocuments<AppwriteDocument>(COLLECTIONS.user_lesson_progress, [
          Query.equal('org_id', [orgId]),
          Query.limit(500),
        ]),
      ]);

      if (!orgDoc) {
        setError('Organización no encontrada');
        setLoading(false);
        return;
      }

      setOrgName((orgDoc.name as string) ?? '');
      setOrgSlug((orgDoc.slug as string) ?? '');
      setLinkingCode((orgDoc.linking_code as string | null) ?? null);

      try {
        const sub = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, orgId);
        setSubscription({
          status: (sub.status as string) ?? 'trial',
          seats_total: (sub.seats_total as number) ?? 10,
          seats_used: (sub.seats_used as number) ?? 0,
          period_start: (sub.period_start as string | null) ?? null,
          period_end: (sub.period_end as string | null) ?? null,
        });
      } catch {
        setSubscription(null);
      }

      const membersData = membersRes.data ?? [];
      const profilesData = profilesRes.data ?? [];
      const progressData = progressRes.data ?? [];

      const profileById = new Map(
        profilesData.map((p) => [
          ((p as AppwriteDocument).$id ?? (p as { id?: string }).id) as string,
          p as AppwriteDocument,
        ])
      );

      const progressByUser = new Map<string, { days: number[]; last: string | null }>();
      progressData.forEach((p) => {
        const doc = p as AppwriteDocument;
        const userId = doc.user_id as string;
        const completedAt = doc.completed_at as string | null;
        if (!completedAt) return;
        if (!progressByUser.has(userId)) progressByUser.set(userId, { days: [], last: null });
        const entry = progressByUser.get(userId)!;
        const dayNum = Number(doc.day ?? 0);
        entry.days.push(dayNum);
        if (!entry.last || completedAt > entry.last) entry.last = completedAt;
      });

      const list: OrgMemberWithProgress[] = membersData.map((m) => {
        const doc = m as AppwriteDocument;
        const memberDocId = (doc.$id ?? (doc as { id?: string }).id) as string;
        const userId = doc.user_id as string;
        const roleInOrg = (doc.role_in_org as string) ?? 'EMPLOYEE';
        const p = profileById.get(userId);
        const entry = progressByUser.get(userId) ?? { days: [], last: null };
        const startDate = (p?.start_date as string | null) ?? null;
        return {
          user_id: userId,
          member_doc_id: memberDocId,
          full_name: (p?.full_name as string | null) ?? null,
          role_in_org: roleInOrg,
          completed_count: entry.days.length,
          completed_days: entry.days.sort((a, b) => a - b),
          last_completed: entry.last,
          start_date: startDate,
        };
      });

      setMembers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handlePromoteToOrgAdmin(member: OrgMemberWithProgress) {
    Alert.alert(
      'Designar ORG_ADMIN',
      `¿Designar a ${member.full_name || member.user_id} como administrador de la organización?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setPromotingUserId(member.user_id);
            try {
              const now = new Date().toISOString();
              await updateDocument(COLLECTIONS.org_members, member.member_doc_id, {
                role_in_org: 'ORG_ADMIN',
              });
              await updateDocument(COLLECTIONS.profiles, member.user_id, {
                role: 'ORG_ADMIN',
                updated_at: now,
              });
              await loadData();
              Alert.alert('Listo', 'El usuario ha sido designado como ORG_ADMIN.');
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'No se pudo designar como ORG_ADMIN'
              );
            }
            setPromotingUserId(null);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.error}>{error}</Text>
        <Button onPress={() => router.back()} theme="gray" size="$3">
          Volver
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.title}>{orgName}</Text>
        <Text style={styles.slug}>{orgSlug}</Text>
        {linkingCode ? (
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>Código vinculación: </Text>
            <Text style={styles.codeValue}>{linkingCode}</Text>
            <Pressable
              onPress={() => {
                Clipboard.setStringAsync(linkingCode).then(() =>
                  Alert.alert('Copiado', 'Código copiado al portapapeles')
                );
              }}
              style={styles.copyBtn}
            >
              <Text style={styles.copyBtnText}>Copiar</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.sub}>Sin código de vinculación</Text>
        )}
        {subscription && (
          <Text style={styles.sub}>
            {subscription.status} · {subscription.seats_used}/{subscription.seats_total} plazas
            {subscription.period_start && ` · Desde ${subscription.period_start}`}
            {subscription.period_end && ` · Hasta ${subscription.period_end}`}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usuarios vinculados</Text>
        {members.length === 0 ? (
          <Text style={styles.empty}>No hay usuarios vinculados con el código de esta organización.</Text>
        ) : (
          members.map((m) => (
            <View key={m.user_id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.full_name || m.user_id}</Text>
                <Text style={styles.userId}>{m.user_id.slice(0, 8)}...</Text>
                <Text style={styles.roleBadge}>{m.role_in_org}</Text>
                <Text style={styles.progress}>
                  Progreso: {m.completed_count} / {TOTAL_LESSONS} (
                  {((m.completed_count / TOTAL_LESSONS) * 100).toFixed(0)}%)
                </Text>
                {m.last_completed && (
                  <Text style={styles.date}>
                    Última lección: {format(new Date(m.last_completed), 'dd/MM/yyyy')}
                  </Text>
                )}
              </View>
              {m.role_in_org === 'EMPLOYEE' && (
                <Button
                  theme="blue"
                  size="$3"
                  onPress={() => handlePromoteToOrgAdmin(m)}
                  disabled={promotingUserId === m.user_id}
                >
                  {promotingUserId === m.user_id ? 'Designando...' : 'Designar ORG_ADMIN'}
                </Button>
              )}
            </View>
          ))
        )}
      </View>

      <Button onPress={() => router.back()} theme="gray" size="$3" style={styles.backBtn}>
        Volver
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  error: { marginBottom: 16, color: '#c00', textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  title: { fontWeight: 'bold', fontSize: 22, marginBottom: 4 },
  slug: { fontSize: 14, color: '#666', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' },
  codeLabel: { fontSize: 12, color: '#666' },
  codeValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 8,
  },
  copyBtn: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#e5e7eb', borderRadius: 6 },
  copyBtnText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  sub: { fontSize: 12, color: '#888', marginBottom: 4 },
  empty: { fontSize: 14, color: '#888', fontStyle: 'italic' },
  memberRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 12,
  },
  memberInfo: { marginBottom: 8 },
  memberName: { fontWeight: '600', fontSize: 16 },
  userId: { fontSize: 12, color: '#888', marginTop: 2 },
  roleBadge: {
    fontSize: 12,
    color: '#0a7ea4',
    fontWeight: '600',
    marginTop: 4,
  },
  progress: { color: '#666', marginTop: 4 },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  backBtn: { marginTop: 8 },
});
