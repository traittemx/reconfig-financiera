import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  COLLECTIONS,
  Query,
  ID,
  type AppwriteDocument,
} from '@/lib/appwrite';
import { DateField } from '@/components/DateField';

const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'canceled'] as const;

const STATUS_LABELS: Record<string, string> = {
  trial: 'Prueba',
  active: 'Activo',
  past_due: 'Vencido',
  canceled: 'Cancelado',
};

const isWeb = Platform.OS === 'web';

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
    membership_cost: number | null;
    notes: string | null;
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
  const [newMembershipCost, setNewMembershipCost] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showNewStatusPicker, setShowNewStatusPicker] = useState(false);
  const [creating, setCreating] = useState(false);

  // Estados para edición
  const [membershipCost, setMembershipCost] = useState('');
  const [notes, setNotes] = useState('');
  const [showEditStatusPicker, setShowEditStatusPicker] = useState(false);

  const loadOrgs = useCallback(async () => {
    const { data: orgList } = await listDocuments<AppwriteDocument>(COLLECTIONS.organizations, [
      Query.orderAsc('name'),
      Query.limit(200),
    ]);
    if (!orgList?.length) {
      setOrgs([]);
      return;
    }
    const subMap = new Map<string, { status: string; seats_total: number; seats_used: number; period_start: string | null; period_end: string | null; membership_cost: number | null; notes: string | null }>();
    for (const o of orgList) {
      const doc = o as AppwriteDocument;
      const orgId = doc.$id ?? (doc as { id?: string }).id;
      try {
        const sub = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, orgId);
        subMap.set(orgId, {
          status: (sub.status as string) ?? 'trial',
          seats_total: (sub.seats_total as number) ?? 10,
          seats_used: (sub.seats_used as number) ?? 0,
          period_start: (sub.period_start as string | null) ?? null,
          period_end: (sub.period_end as string | null) ?? null,
          membership_cost: (sub.membership_cost as number | null) ?? null,
          notes: (sub.notes as string | null) ?? null,
        });
      } catch {
        try {
          await createDocument(
            COLLECTIONS.org_subscriptions,
            {
              status: 'trial',
              seats_total: 10,
              seats_used: 0,
            },
            orgId
          );
          subMap.set(orgId, {
            status: 'trial',
            seats_total: 10,
            seats_used: 0,
            period_start: null,
            period_end: null,
            membership_cost: null,
            notes: null,
          });
        } catch {
          // leave as null
        }
      }
    }
    const list: Org[] = orgList.map((o) => {
      const doc = o as AppwriteDocument;
      const id = doc.$id ?? (doc as { id?: string }).id;
      return {
        id,
        name: (doc.name as string) ?? '',
        slug: (doc.slug as string) ?? '',
        linking_code: (doc.linking_code as string | null) ?? null,
        subscription: subMap.get(id) ?? null,
      };
    });
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
    try {
      const orgId = ID.unique();
      const now = new Date().toISOString();
      await createDocument(
        COLLECTIONS.organizations,
        { name, slug, created_at: now },
        orgId
      );
      const subPayload: Record<string, unknown> = {
        status: newStatus,
        seats_total: newSeatsTotal ? parseInt(newSeatsTotal, 10) : 10,
        seats_used: 0,
      };
      if (newPeriodStart) subPayload.period_start = newPeriodStart;
      if (newPeriodEnd) subPayload.period_end = newPeriodEnd;
      if (newMembershipCost) subPayload.membership_cost = parseFloat(newMembershipCost);
      if (newNotes) subPayload.notes = newNotes;

      try {
        await createDocument(
          COLLECTIONS.org_subscriptions,
          subPayload,
          orgId
        );
      } catch (subError) {
        console.error('Subscription creation failed:', subError);
        throw subError;
      }
      const linkingCode = generateLinkingCode();
      await updateDocument(COLLECTIONS.organizations, orgId, { linking_code: linkingCode });
      Clipboard.setStringAsync(linkingCode).catch(() => {});
      Alert.alert(
        'Empresa creada',
        `Código de vinculación: ${linkingCode}\n\nComparte este código con los empleados para que se registren y se vinculen a la empresa. El código se ha copiado al portapapeles.`,
        [{ text: 'Entendido' }]
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('Error creating company/subscription:', e);
      Alert.alert('Error', errorMsg);
    }
    setCreating(false);
    setShowCreateForm(false);
    setNewName('');
    setNewSlug('');
    setNewStatus('trial');
    setNewSeatsTotal('10');
    setNewPeriodStart('');
    setNewPeriodEnd('');
    setNewMembershipCost('');
    setNewNotes('');
    await loadOrgs();
  }

  async function saveSubscription(orgId: string) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status,
      };
      if (seatsTotal !== '') payload.seats_total = parseInt(seatsTotal, 10);
      if (periodStart) payload.period_start = periodStart;
      if (periodEnd) payload.period_end = periodEnd;
      if (membershipCost) payload.membership_cost = parseFloat(membershipCost);
      if (notes) payload.notes = notes;

      try {
        await updateDocument(COLLECTIONS.org_subscriptions, orgId, payload);
      } catch {
        const createPayload: Record<string, unknown> = {
          status,
          seats_total: seatsTotal ? parseInt(seatsTotal, 10) : 10,
          seats_used: 0,
        };
        if (periodStart) createPayload.period_start = periodStart;
        if (periodEnd) createPayload.period_end = periodEnd;
        if (membershipCost) createPayload.membership_cost = parseFloat(membershipCost);
        if (notes) createPayload.notes = notes;

        await createDocument(
          COLLECTIONS.org_subscriptions,
          createPayload,
          orgId
        );
      }
      const sub = await getDocument<AppwriteDocument>(COLLECTIONS.org_subscriptions, orgId);
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === orgId
            ? {
                ...o,
                subscription: {
                  status: (sub.status as string) ?? 'trial',
                  seats_total: (sub.seats_total as number) ?? 10,
                  seats_used: (sub.seats_used as number) ?? 0,
                  period_start: (sub.period_start as string | null) ?? null,
                  period_end: (sub.period_end as string | null) ?? null,
                  membership_cost: (sub.membership_cost as number | null) ?? null,
                  notes: (sub.notes as string | null) ?? null,
                },
              }
            : o
        )
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar');
    }
    setSaving(false);
    setEditing(null);
  }

  function startEdit(org: Org) {
    setEditing(org.id);
    setStatus(org.subscription?.status ?? 'trial');
    setSeatsTotal(String(org.subscription?.seats_total ?? 10));
    setPeriodStart(org.subscription?.period_start ?? '');
    setPeriodEnd(org.subscription?.period_end ?? '');
    setMembershipCost(org.subscription?.membership_cost != null ? String(org.subscription.membership_cost) : '');
    setNotes(org.subscription?.notes ?? '');
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
          <Text style={styles.label}>Estado</Text>
          {isWeb ? (
            <View style={styles.selectWrapper}>
              {React.createElement('select', {
                value: newStatus,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setNewStatus(e.target.value),
                disabled: creating,
                style: {
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#e5e5e5',
                  borderRadius: 8,
                  backgroundColor: creating ? '#f5f5f5' : '#fff',
                  outlineStyle: 'none',
                },
              }, SUBSCRIPTION_STATUSES.map((s) =>
                React.createElement('option', { key: s, value: s }, STATUS_LABELS[s])
              ))}
            </View>
          ) : (
            <>
              <Pressable
                style={[styles.pickerTrigger, creating && styles.pickerTriggerDisabled]}
                onPress={() => !creating && setShowNewStatusPicker(true)}
                disabled={creating}
              >
                <Text style={styles.pickerTriggerText}>{STATUS_LABELS[newStatus] || newStatus}</Text>
              </Pressable>
              <Modal visible={showNewStatusPicker} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowNewStatusPicker(false)}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Seleccionar estado</Text>
                    {SUBSCRIPTION_STATUSES.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.modalOption, newStatus === s && styles.modalOptionSelected]}
                        onPress={() => {
                          setNewStatus(s);
                          setShowNewStatusPicker(false);
                        }}
                      >
                        <Text style={[styles.modalOptionText, newStatus === s && styles.modalOptionTextSelected]}>
                          {STATUS_LABELS[s]}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable style={styles.modalCancel} onPress={() => setShowNewStatusPicker(false)}>
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Modal>
            </>
          )}
          <TextInput
            style={styles.input}
            placeholder="Plazas totales"
            value={newSeatsTotal}
            onChangeText={setNewSeatsTotal}
            keyboardType="number-pad"
            editable={!creating}
          />
          <TextInput
            style={styles.input}
            placeholder="Costo de membresía (ej: 499.00)"
            value={newMembershipCost}
            onChangeText={setNewMembershipCost}
            keyboardType="decimal-pad"
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
          <Text style={styles.label}>Notas</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Notas adicionales"
            value={newNotes}
            onChangeText={setNewNotes}
            multiline
            numberOfLines={3}
            editable={!creating}
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
                <Text style={styles.label}>Estado</Text>
                {isWeb ? (
                  <View style={styles.selectWrapper}>
                    {React.createElement('select', {
                      value: status,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value),
                      disabled: saving,
                      style: {
                        width: '100%',
                        padding: 12,
                        fontSize: 16,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: '#e5e5e5',
                        borderRadius: 8,
                        backgroundColor: saving ? '#f5f5f5' : '#fff',
                        outlineStyle: 'none',
                      },
                    }, SUBSCRIPTION_STATUSES.map((s) =>
                      React.createElement('option', { key: s, value: s }, STATUS_LABELS[s])
                    ))}
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={[styles.pickerTrigger, saving && styles.pickerTriggerDisabled]}
                      onPress={() => !saving && setShowEditStatusPicker(true)}
                      disabled={saving}
                    >
                      <Text style={styles.pickerTriggerText}>{STATUS_LABELS[status] || status}</Text>
                    </Pressable>
                    <Modal visible={showEditStatusPicker} transparent animationType="slide">
                      <Pressable style={styles.modalOverlay} onPress={() => setShowEditStatusPicker(false)}>
                        <View style={styles.modalContent}>
                          <Text style={styles.modalTitle}>Seleccionar estado</Text>
                          {SUBSCRIPTION_STATUSES.map((s) => (
                            <Pressable
                              key={s}
                              style={[styles.modalOption, status === s && styles.modalOptionSelected]}
                              onPress={() => {
                                setStatus(s);
                                setShowEditStatusPicker(false);
                              }}
                            >
                              <Text style={[styles.modalOptionText, status === s && styles.modalOptionTextSelected]}>
                                {STATUS_LABELS[s]}
                              </Text>
                            </Pressable>
                          ))}
                          <Pressable style={styles.modalCancel} onPress={() => setShowEditStatusPicker(false)}>
                            <Text style={styles.modalCancelText}>Cancelar</Text>
                          </Pressable>
                        </View>
                      </Pressable>
                    </Modal>
                  </>
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Plazas totales"
                  value={seatsTotal}
                  onChangeText={setSeatsTotal}
                  keyboardType="number-pad"
                  editable={!saving}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Costo de membresía (ej: 499.00)"
                  value={membershipCost}
                  onChangeText={setMembershipCost}
                  keyboardType="decimal-pad"
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
                <Text style={styles.label}>Notas</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Notas adicionales"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  editable={!saving}
                />
                <View style={styles.cardActions}>
                  <Button theme="blue" onPress={() => saveSubscription(item.id)} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button theme="gray" onPress={() => setEditing(null)} disabled={saving}>
                    Cancelar
                  </Button>
                </View>
              </View>
            ) : (
              <View style={styles.cardActions}>
                <Button theme="blue" size="$3" onPress={() => router.push(`/superadmin/org/${item.id}`)}>
                  Ver detalles
                </Button>
                <Button theme="blue" size="$3" onPress={() => startEdit(item)}>
                  Editar suscripción
                </Button>
              </View>
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectWrapper: { marginBottom: 12 },
  pickerTrigger: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerTriggerDisabled: { backgroundColor: '#f5f5f5' },
  pickerTriggerText: { fontSize: 16, color: '#000' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionSelected: {
    backgroundColor: '#e8f4fd',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  modalCancel: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
