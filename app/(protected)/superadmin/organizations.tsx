import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { DateField } from '@/components/DateField';

const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'canceled'] as const;

/** Genera un código de vinculación de 8 caracteres (sin 0/O, 1/l para evitar confusiones) */
function generateLinkingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

type Org = {
  id: string;
  name: string;
  slug: string;
  linking_code?: string | null;
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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newStatus, setNewStatus] = useState<string>('trial');
  const [newSeatsTotal, setNewSeatsTotal] = useState('10');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [creating, setCreating] = useState(false);

  const loadOrgs = useCallback(async () => {
    const { data: orgList } = await supabase.from('organizations').select('id, name, slug, linking_code').order('name');
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
    const list: Org[] = orgList.map((o: { id: string; name: string; slug: string; linking_code?: string | null }) => ({
      ...o,
      subscription: subMap.get(o.id) ?? null,
    }));
    setOrgs(list);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function registerCompany() {
    const name = newName.trim();
    const slug = (newSlug.trim().toLowerCase().replace(/\s+/g, '-') || name.toLowerCase().replace(/\s+/g, '-'));
    if (!name) {
      Alert.alert('Error', 'El nombre de la empresa es obligatorio');
      return;
    }
    setCreating(true);
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name, slug })
      .select('id')
      .single();
    if (orgError) {
      setCreating(false);
      Alert.alert('Error', 'No se pudo crear la empresa: ' + orgError.message);
      return;
    }
    const payload = {
      org_id: org.id,
      status: newStatus,
      seats_total: newSeatsTotal ? parseInt(newSeatsTotal, 10) : 10,
      seats_used: 0,
      period_start: newPeriodStart || null,
      period_end: newPeriodEnd || null,
    };
    const { error: subError } = await supabase.from('org_subscriptions').insert(payload);
    if (subError) {
      setCreating(false);
      Alert.alert('Error', 'Empresa creada pero falló la suscripción: ' + subError.message);
      await loadOrgs();
      return;
    }
    const linkingCode = generateLinkingCode();
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ linking_code: linkingCode })
      .eq('id', org.id);
    setCreating(false);
    if (updateError) {
      Alert.alert('Aviso', 'Empresa creada pero no se pudo generar el código de vinculación: ' + updateError.message);
    } else {
      Clipboard.setStringAsync(linkingCode).catch(() => {});
      Alert.alert(
        'Empresa creada',
        `Código de vinculación: ${linkingCode}\n\nComparte este código con los empleados para que se registren y se vinculen a la empresa. El código se ha copiado al portapapeles.`,
        [{ text: 'Entendido' }]
      );
    }
    setShowCreateForm(false);
    setNewName('');
    setNewSlug('');
    setNewStatus('trial');
    setNewSeatsTotal('10');
    setNewPeriodStart('');
    setNewPeriodEnd('');
    await loadOrgs();
  }

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
      {!showCreateForm ? (
        <Button theme="blue" size="$4" onPress={() => setShowCreateForm(true)} style={styles.createBtn}>
          Registrar empresa
        </Button>
      ) : (
        <View style={styles.createForm}>
          <Text style={styles.createFormTitle}>Registrar empresa</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre de la empresa"
            value={newName}
            onChangeText={(t) => {
              setNewName(t);
              if (!newSlug) setNewSlug(t.toLowerCase().replace(/\s+/g, '-'));
            }}
            editable={!creating}
          />
          <TextInput
            style={styles.input}
            placeholder="Slug (único, ej: mi-empresa)"
            value={newSlug}
            onChangeText={setNewSlug}
            autoCapitalize="none"
            editable={!creating}
          />
          <TextInput
            style={styles.input}
            placeholder="Estado: trial, active, past_due, canceled"
            value={newStatus}
            onChangeText={setNewStatus}
            editable={!creating}
          />
          <TextInput
            style={styles.input}
            placeholder="Plazas totales"
            value={newSeatsTotal}
            onChangeText={setNewSeatsTotal}
            keyboardType="number-pad"
            editable={!creating}
          />
          <Text style={styles.label}>Periodo inicio</Text>
          <DateField
            value={newPeriodStart}
            onChange={setNewPeriodStart}
            placeholder="Seleccionar fecha de inicio"
            editable={!creating}
            style={styles.dateField}
          />
          <Text style={styles.label}>Periodo fin</Text>
          <DateField
            value={newPeriodEnd}
            onChange={setNewPeriodEnd}
            placeholder="Seleccionar fecha de fin"
            editable={!creating}
            style={styles.dateField}
          />
          <View style={styles.createFormActions}>
            <Button theme="blue" onPress={registerCompany} disabled={creating}>
              {creating ? 'Creando...' : 'Crear empresa'}
            </Button>
            <Button theme="gray" onPress={() => setShowCreateForm(false)} disabled={creating}>
              Cancelar
            </Button>
          </View>
        </View>
      )}
      <FlatList
        data={orgs}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.slug}>{item.slug}</Text>
            {item.linking_code ? (
              <View style={styles.codeRow}>
                <Text style={styles.codeLabel}>Código vinculación: </Text>
                <Text style={styles.codeValue}>{item.linking_code}</Text>
                <Pressable
                  onPress={() => {
                    Clipboard.setStringAsync(item.linking_code!).then(() => Alert.alert('Copiado', 'Código copiado al portapapeles'));
                  }}
                  style={styles.copyBtn}
                >
                  <Text style={styles.copyBtnText}>Copiar</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.sub}>Sin código de vinculación</Text>
            )}
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
                <Text style={styles.label}>Periodo inicio</Text>
                <DateField
                  value={periodStart}
                  onChange={setPeriodStart}
                  placeholder="Seleccionar fecha de inicio"
                  editable={!saving}
                  style={styles.dateField}
                />
                <Text style={styles.label}>Periodo fin</Text>
                <DateField
                  value={periodEnd}
                  onChange={setPeriodEnd}
                  placeholder="Seleccionar fecha de fin"
                  editable={!saving}
                  style={styles.dateField}
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
  createBtn: { marginBottom: 16 },
  createForm: { marginBottom: 16, padding: 16, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8 },
  createFormTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  createFormActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  list: { flex: 1 },
  card: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 12,
  },
  name: { fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  slug: { fontSize: 14, color: '#666', marginBottom: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' },
  codeLabel: { fontSize: 12, color: '#666' },
  codeValue: { fontSize: 14, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginRight: 8 },
  copyBtn: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#e5e7eb', borderRadius: 6 },
  copyBtnText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  sub: { fontSize: 12, color: '#888', marginBottom: 12 },
  form: { marginTop: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  dateField: { marginBottom: 12 },
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
