import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { MotiView } from 'moti';
import { Button } from 'tamagui';
import {
  TrendingUp,
  TrendingDown,
  Pencil,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Briefcase,
  PieChart,
  Building2,
  MoreHorizontal,
} from '@tamagui/lucide-icons';
import { useAuth } from '@/contexts/auth-context';
import { Permission, Role } from 'react-native-appwrite';
import {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  COLLECTIONS,
  Query,
  type AppwriteDocument,
} from '@/lib/appwrite';
import { startOfMonth, format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const INCOME_SOURCES = [
  { value: 'SALARIO' as const, label: 'Salario', icon: DollarSign },
  { value: 'TRABAJO_INDEPENDIENTE' as const, label: 'Trabajo independiente', icon: Briefcase },
  { value: 'DIVIDENDOS' as const, label: 'Dividendos', icon: PieChart },
  { value: 'UTILIDADES_NEGOCIOS' as const, label: 'Utilidades de negocios', icon: Building2 },
  { value: 'OTROS_INGRESOS' as const, label: 'Otros ingresos', icon: MoreHorizontal },
];

type IncomeEntry = {
  id: string;
  source_type: 'SALARIO' | 'TRABAJO_INDEPENDIENTE' | 'DIVIDENDOS' | 'UTILIDADES_NEGOCIOS' | 'OTROS_INGRESOS';
  amount: number;
  note: string | null;
  created_at: string;
};

export default function FlujoEfectivoScreen() {
  const { profile } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [sourceType, setSourceType] = useState<'SALARIO' | 'TRABAJO_INDEPENDIENTE' | 'DIVIDENDOS' | 'UTILIDADES_NEGOCIOS' | 'OTROS_INGRESOS'>('SALARIO');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<IncomeEntry | null>(null);

  const monthKey = format(selectedMonth, 'yyyy-MM');

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    loadData();
  }, [profile?.id, profile?.org_id, selectedMonth]);

  async function loadData() {
    if (!profile?.id || !profile.org_id) return;
    await Promise.all([loadExpenses(), loadIncome()]);
  }

  async function loadExpenses() {
    if (!profile?.id || !profile.org_id) return;
    try {
      const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.budget_safe_style_expenses, [
        Query.equal('user_id', [profile.id]),
        Query.equal('org_id', [profile.org_id]),
        Query.equal('month', [monthKey]),
        Query.limit(500),
      ]);
      const total = data.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
      setTotalExpenses(total);
    } catch (err) {
      console.error('[flujo-efectivo] loadExpenses error:', err);
      setTotalExpenses(0);
    }
  }

  async function loadIncome() {
    if (!profile?.id || !profile.org_id) return;
    try {
      const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.cash_flow_income, [
        Query.equal('user_id', [profile.id]),
        Query.equal('org_id', [profile.org_id]),
        Query.equal('month', [monthKey]),
        Query.orderAsc('$createdAt'),
        Query.limit(500),
      ]);
      setIncomeEntries(
        data.map((d) => ({
          id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '',
          source_type: (d.source_type as IncomeEntry['source_type']) ?? 'SALARIO',
          amount: Number(d.amount ?? 0),
          note: (d.note as string | null) ?? null,
          created_at: (d as { $createdAt?: string }).$createdAt ?? '',
        })) as IncomeEntry[]
      );
    } catch (err) {
      console.error('[flujo-efectivo] loadIncome error:', err);
      setIncomeEntries([]);
    }
  }

  function resetForm() {
    setSourceType('SALARIO');
    setAmount('');
    setNote('');
    setEditingItem(null);
  }

  async function addIncome() {
    if (!profile?.id || !profile.org_id) {
      Alert.alert('Error', 'Debes estar autenticado');
      return;
    }
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (Number.isNaN(num) || num <= 0) {
      Alert.alert('Error', 'El monto debe ser un número mayor a 0');
      return;
    }
    setLoading(true);
    try {
      const permissions = [
        Permission.read(Role.user(profile.id)),
        Permission.update(Role.user(profile.id)),
        Permission.delete(Role.user(profile.id)),
      ];
      await createDocument(
        COLLECTIONS.cash_flow_income,
        {
          user_id: profile.id,
          org_id: profile.org_id,
          month: monthKey,
          source_type: sourceType,
          amount: num,
          note: note.trim() || null,
          created_at: new Date().toISOString(),
        } as Record<string, unknown>,
        undefined,
        permissions
      );
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      if (__DEV__) console.error('[flujo-efectivo] create error:', err);
      Alert.alert('Error', msg);
      return;
    }
    setLoading(false);
    resetForm();
    setShowForm(false);
    loadIncome();
  }

  async function saveEdit() {
    if (!editingItem) return;
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (Number.isNaN(num) || num <= 0) {
      Alert.alert('Error', 'El monto debe ser un número mayor a 0');
      return;
    }
    setLoading(true);
    try {
      await updateDocument(COLLECTIONS.cash_flow_income, editingItem.id, {
        source_type: sourceType,
        amount: num,
        note: note.trim() || null,
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
      return;
    }
    setLoading(false);
    resetForm();
    loadIncome();
  }

  function confirmDelete(item: IncomeEntry) {
    const sourceLabel = INCOME_SOURCES.find((s) => s.value === item.source_type)?.label ?? item.source_type;
    Alert.alert(
      'Eliminar ingreso',
      `¿Eliminar "${sourceLabel}" (${Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteIncome(item) },
      ]
    );
  }

  async function deleteIncome(item: IncomeEntry) {
    try {
      await deleteDocument(COLLECTIONS.cash_flow_income, item.id);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al eliminar');
      return;
    }
    loadIncome();
  }

  function openEdit(item: IncomeEntry) {
    setEditingItem(item);
    setSourceType(item.source_type);
    setAmount(String(item.amount));
    setNote(item.note || '');
  }

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const cashFlow = totalIncome - totalExpenses;

  function getCashFlowExplanation() {
    if (cashFlow > 0) {
      return {
        text: 'Gastas menos de lo que ganas, lo que es un gran paso en tener finanzas saludables.',
        color: '#16a34a',
        bgColor: '#dcfce7',
        icon: TrendingUp,
      };
    } else if (cashFlow === 0) {
      return {
        text: 'Gastas lo mismo que ganas, hay un área de oportunidad por trabajar para reducir gastos y aumentar ingresos.',
        color: '#eab308',
        bgColor: '#fef9c3',
        icon: TrendingDown,
      };
    } else {
      return {
        text: 'Estás en un área peligrosa, significa que estás gastando más de lo que ganas y no te estás dando cuenta, debes trabajar de inmediato para reducir gastos y aumentar ingresos.',
        color: '#dc2626',
        bgColor: '#fee2e2',
        icon: TrendingDown,
      };
    }
  }

  const explanation = getCashFlowExplanation();
  const ExplanationIcon = explanation.icon;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Selector de mes */}
        <View style={styles.monthNavWrap}>
          <TouchableOpacity
            onPress={() => setSelectedMonth((m) => subMonths(m, 1))}
            style={styles.monthNavButton}
            accessibilityLabel="Mes anterior"
          >
            <ChevronLeft size={24} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.monthNavLabel}>{format(selectedMonth, 'MMMM yyyy', { locale: es })}</Text>
          <TouchableOpacity
            onPress={() => setSelectedMonth((m) => addMonths(m, 1))}
            style={styles.monthNavButton}
            accessibilityLabel="Mes siguiente"
          >
            <ChevronRight size={24} color="#334155" />
          </TouchableOpacity>
        </View>

        {/* Resumen de gastos e ingresos */}
        <View style={styles.summaryRow}>
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[styles.summaryCard, styles.summaryCardExpenses]}
          >
            <View style={styles.summaryCardHeader}>
              <TrendingDown size={20} color="#dc2626" />
              <Text style={styles.summaryCardLabel}>Gastos totales</Text>
            </View>
            <Text style={styles.summaryCardAmount}>
              {totalExpenses.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </Text>
          </MotiView>
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 80 }}
            style={[styles.summaryCard, styles.summaryCardIncome]}
          >
            <View style={styles.summaryCardHeader}>
              <TrendingUp size={20} color="#16a34a" />
              <Text style={styles.summaryCardLabel}>Ingresos totales</Text>
            </View>
            <Text style={styles.summaryCardAmount}>
              {totalIncome.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </Text>
          </MotiView>
        </View>

        {/* Flujo de efectivo */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 120 }}
          style={[styles.cashFlowCard, { backgroundColor: explanation.bgColor }]}
        >
          <View style={styles.cashFlowHeader}>
            <ExplanationIcon size={24} color={explanation.color} />
            <Text style={styles.cashFlowLabel}>Flujo de efectivo</Text>
          </View>
          <Text style={[styles.cashFlowAmount, { color: explanation.color }]}>
            {cashFlow >= 0 ? '+' : ''}
            {cashFlow.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </Text>
          <Text style={styles.cashFlowExplanation}>{explanation.text}</Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 160 }}
        >
          <Button
            onPress={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            theme="blue"
            size="$3"
            width="100%"
            marginBottom={20}
          >
            {showForm ? 'Cancelar' : 'Agregar ingreso'}
          </Button>
        </MotiView>

        {showForm && (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
            style={styles.formCard}
          >
            <Text style={styles.fieldLabel}>Fuente de ingreso</Text>
            <View style={styles.sourcePicker}>
              {INCOME_SOURCES.map((source) => {
                const Icon = source.icon;
                const isSelected = sourceType === source.value;
                return (
                  <TouchableOpacity
                    key={source.value}
                    onPress={() => setSourceType(source.value)}
                    style={[styles.sourceChip, isSelected && styles.sourceChipSelected]}
                  >
                    <Icon size={18} color={isSelected ? '#fff' : '#64748b'} />
                    <Text style={[styles.sourceChipText, isSelected && styles.sourceChipTextSelected]}>
                      {source.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Monto (MXN)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />

            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Agregar nota..."
              placeholderTextColor="#94a3b8"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              editable={!loading}
            />

            <Button onPress={addIncome} disabled={loading} theme="green" size="$4">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </MotiView>
        )}

        <Text style={styles.sectionTitle}>Ingresos registrados</Text>
        {incomeEntries.length === 0 ? (
          <Text style={styles.emptyText}>No hay ingresos registrados este mes. Agrega uno con "Agregar ingreso".</Text>
        ) : (
          <MotiView
            from={{ opacity: 0, translateX: -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 320 }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <TrendingUp size={20} color="#16a34a" />
              <Text style={styles.cardTitle}>Ingresos del mes</Text>
            </View>
            {incomeEntries.map((item) => {
              const sourceInfo = INCOME_SOURCES.find((s) => s.value === item.source_type);
              const SourceIcon = sourceInfo?.icon || DollarSign;
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeader}>
                      <SourceIcon size={16} color="#16a34a" />
                      <Text style={styles.itemSource}>{sourceInfo?.label ?? item.source_type}</Text>
                    </View>
                    {item.note && <Text style={styles.itemNote}>{item.note}</Text>}
                    <Text style={styles.itemAmount}>
                      {Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </Text>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn} accessibilityLabel="Editar">
                      <Pencil size={18} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(item)}
                      style={styles.actionBtn}
                      accessibilityLabel="Eliminar"
                    >
                      <Trash2 size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </MotiView>
        )}
      </ScrollView>

      <MotiView
        from={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 14, delay: 300 }}
        style={styles.fabWrap}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          activeOpacity={0.9}
          accessibilityLabel="Agregar ingreso"
        >
          <Plus size={26} color="#fff" />
        </TouchableOpacity>
      </MotiView>

      <Modal visible={editingItem !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => resetForm()}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Editar ingreso</Text>

            <Text style={styles.fieldLabel}>Fuente de ingreso</Text>
            <View style={styles.sourcePicker}>
              {INCOME_SOURCES.map((source) => {
                const Icon = source.icon;
                const isSelected = sourceType === source.value;
                return (
                  <TouchableOpacity
                    key={source.value}
                    onPress={() => setSourceType(source.value)}
                    style={[styles.sourceChip, isSelected && styles.sourceChipSelected]}
                  >
                    <Icon size={18} color={isSelected ? '#fff' : '#64748b'} />
                    <Text style={[styles.sourceChipText, isSelected && styles.sourceChipTextSelected]}>
                      {source.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Monto (MXN)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />

            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Agregar nota..."
              placeholderTextColor="#94a3b8"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              editable={!loading}
            />

            <View style={styles.modalActions}>
              <Button onPress={() => resetForm()} theme="gray" size="$3" flex={1}>
                Cancelar
              </Button>
              <Button onPress={saveEdit} disabled={loading} theme="green" size="$3" flex={1}>
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    position: 'relative',
    ...(Platform.OS === 'web' && { minHeight: '100%' }),
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  monthNavWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  monthNavButton: { padding: 8 },
  monthNavLabel: { fontSize: 17, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryCardExpenses: {
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  summaryCardIncome: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryCardLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  summaryCardAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  cashFlowCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cashFlowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cashFlowLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cashFlowAmount: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  cashFlowExplanation: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 10, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sourcePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sourceChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  sourceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  sourceChipTextSelected: {
    color: '#fff',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  emptyText: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemInfo: { flex: 1 },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemSource: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemNote: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 },
  itemAmount: { fontSize: 15, fontWeight: '700', color: '#16a34a', marginTop: 4 },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 28,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
