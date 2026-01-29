import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { supabase } from '@/lib/supabase';

const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'canceled'] as const;

type Org = {
  id: string;
  name: string;
  slug: string;
  subscription?: {
    status: string;
    seats_total: number;
    seats_used: number;
    period_start: string | null;
    period_end: string | null;
  } | null;
};

export default function SuperadminOrganizationsScreen() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('active');
  const [seatsTotal, setSeatsTotal] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: orgList } = await supabase.from('organizations').select('id, name, slug').order('name');
      if (!orgList?.length) {
        setOrgs([]);
        return;
      }
      const { data: subs } = await supabase
        .from('org_subscriptions')
        .select('org_id, status, seats_total, seats_used, period_start, period_end')
        .in('org_id', orgList.map((o: { id: string }) => o.id));
      const subMap = new Map(
        (subs ?? []).map((s: { org_id: string; status: string; seats_total: number; seats_used: number; period_start: string | null; period_end: string | null }) => [
          s.org_id,
          {
            status: s.status,
            seats_total: s.seats_total,
            seats_used: s.seats_used,
            period_start: s.period_start,
            period_end: s.period_end,
          },
        ])
      );
      const list: Org[] = orgList.map((o: { id: string; name: string; slug: string }) => ({
        ...o,
        subscription: subMap.get(o.id) ?? null,
      }));
      setOrgs(list);
    })();
  }, []);

  async function saveSubscription(orgId: string) {
    setSaving(true);
    const payload: {
      status: string;
      seats_total?: number;
      period_start?: string | null;
      period_end?: string | null;
      updated_at: string;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (seatsTotal !== '') payload.seats_total = parseInt(seatsTotal, 10);
    if (periodStart !== '') payload.period_start = periodStart || null;
    if (periodEnd !== '') payload.period_end = periodEnd || null;
    const { error } = await supabase.from('org_subscriptions').update(payload).eq('org_id', orgId);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setEditing(null);
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('status, seats_total, seats_used, period_start, period_end')
      .eq('org_id', orgId)
      .single();
    setOrgs((prev) =>
      prev.map((o) =>
        o.id === orgId ? { ...o, subscription: sub ?? o.subscription } : o
      )
    );
  }

  function startEdit(org: Org) {
    setEditing(org.id);
    setStatus(org.subscription?.status ?? 'trial');
    setSeatsTotal(String(org.subscription?.seats_total ?? 10));
    setPeriodStart(org.subscription?.period_start ?? '');
    setPeriodEnd(org.subscription?.period_end ?? '');
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orgs}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.slug}>{item.slug}</Text>
            {item.subscription && (
              <Text style={styles.sub}>
                {item.subscription.status} · {item.subscription.seats_used}/{item.subscription.seats_total} plazas
                {item.subscription.period_end && ` · Hasta ${item.subscription.period_end}`}
              </Text>
            )}
            {editing === item.id ? (
              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  placeholder="Status: trial, active, past_due, canceled"
                  value={status}
                  onChangeText={setStatus}
                  editable={!saving}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Seats total"
                  value={seatsTotal}
                  onChangeText={setSeatsTotal}
                  keyboardType="number-pad"
                  editable={!saving}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Period start (YYYY-MM-DD)"
                  value={periodStart}
                  onChangeText={setPeriodStart}
                  editable={!saving}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Period end (YYYY-MM-DD)"
                  value={periodEnd}
                  onChangeText={setPeriodEnd}
                  editable={!saving}
                />
                <Button theme="blue" onPress={() => saveSubscription(item.id)} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button theme="gray" onPress={() => setEditing(null)} disabled={saving}>
                  Cancelar
                </Button>
              </View>
            ) : (
              <Button theme="blue" size="$3" onPress={() => startEdit(item)}>
                Editar suscripción
              </Button>
            )}
          </View>
        )}
      />
      <Button onPress={() => router.back()} theme="gray" size="$3">
        Volver
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  list: { flex: 1 },
  card: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 12,
  },
  name: { fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  slug: { fontSize: 14, color: '#666', marginBottom: 4 },
  sub: { fontSize: 12, color: '#888', marginBottom: 12 },
  form: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
});
