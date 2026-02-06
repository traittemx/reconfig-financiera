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
import { PieChart, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, Shield, Sparkles } from '@tamagui/lucide-icons';
import { useAuth } from '@/contexts/auth-context';
import { Permission, Role } from 'react-native-appwrite';
import { listDocuments, createDocument, updateDocument, deleteDocument, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { startOfMonth, format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

// Constantes de categorías y subcategorías
const CATEGORIES: Record<string, string[]> = {
  'Suscripciones': ['Deportes', 'Office Microsoft', 'Streaming películas/series', 'Streaming música', 'Revistas', 'Compras online', 'Otro'],
  'Donaciones': ['Diezmo', 'Regalos', 'Otros'],
  'Personal': ['Accesorios', 'Zapatos', 'Libros', 'Peluquería/belleza', 'Maquillaje', 'Servicio celular', 'Ropa', 'Lujos (joyas, relojes, etc.)'],
  'Obligaciones Financieras': ['Abono a tarjeta de crédito', 'Crédito personal', 'Ahorro para el retiro', 'Seguro de vida'],
  'Dinero de Bolsillo': ['Propinas restaurantes', 'Propinas supermercado', 'Ayuda a indigentes', 'Compras en semáforos'],
  'Otros': ['Imprevistos', 'Otros'],
  'Vivienda': ['Administración vivienda', 'Hipoteca/renta', 'Impuesto predial', 'Seguro hogar', 'Jardinería', 'Reparaciones/mejoras', 'Telefonía', 'Internet', 'TV por cable'],
  'Supermercado': ['Alimentos', 'Artículos de limpieza', 'Artículos de uso personal', 'Otros'],
  'Otros Servicios': ['Lavandería', 'Asistente doméstico', 'Otros'],
  'Dependientes': ['Niñera', 'Escuela hijos', 'Juguetes', 'Mesada', 'Vestuario hijos', 'Apoyo padres', 'Otros'],
  'Mascota': ['Alimento', 'Guardería', 'Paseador', 'Veterinario', 'Otros'],
  'Transporte': ['Cuota del carro', 'Gasolina', 'Impuestos', 'Limpieza del carro', 'Mantenimiento/servicios', 'Estacionamientos', 'Seguro del carro', 'Autobús', 'Metro', 'Taxi/Uber'],
  'Entretenimiento': ['Conciertos', 'Eventos deportivos', 'Fiestas/bares', 'Salidas a comer/cenar', 'Cine', 'Salidas de fin de semana'],
  'Salud': ['Aparatos médicos', 'Gimnasio', 'Medicinas', 'Servicios médicos', 'Otros'],
  'Educación': ['Cursos/diplomados', 'Materiales/libros', 'Universidad', 'Seminarios/congresos'],
};

const BUDGET_TYPES = [
  { value: 'SEGURO' as const, label: 'Presupuesto Seguro', icon: Shield },
  { value: 'ESTILO' as const, label: 'Presupuesto Estilo', icon: Sparkles },
];

type BudgetExpense = {
  id: string;
  category: string;
  subcategory: string;
  amount: number;
  budget_type: 'SEGURO' | 'ESTILO';
  note: string | null;
  created_at: string;
};

export default function PresupuestoSeguroEstiloScreen() {
  const { profile } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [expenses, setExpenses] = useState<BudgetExpense[]>([]);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [amount, setAmount] = useState('');
  const [budgetType, setBudgetType] = useState<'SEGURO' | 'ESTILO'>('SEGURO');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetExpense | null>(null);

  const monthKey = format(selectedMonth, 'yyyy-MM');

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    loadExpenses();
  }, [profile?.id, profile?.org_id, selectedMonth]);

  async function loadExpenses() {
    if (!profile?.id || !profile.org_id) return;
    try {
      const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.budget_safe_style_expenses, [
        Query.equal('user_id', [profile.id]),
        Query.equal('org_id', [profile.org_id]),
        Query.equal('month', [monthKey]),
        Query.orderAsc('$createdAt'),
        Query.limit(500),
      ]);
      setExpenses(data.map((d) => ({
        id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '',
        category: (d.category as string) ?? '',
        subcategory: (d.subcategory as string) ?? '',
        amount: Number(d.amount ?? 0),
        budget_type: (d.budget_type as 'SEGURO' | 'ESTILO') ?? 'SEGURO',
        note: (d.note as string | null) ?? null,
        created_at: (d as { $createdAt?: string }).$createdAt ?? '',
      })) as BudgetExpense[]);
    } catch (err) {
      console.error('[presupuesto-seguro-estilo] loadExpenses error:', err);
      setExpenses([]);
    }
  }

  function resetForm() {
    setCategory('');
    setSubcategory('');
    setAmount('');
    setBudgetType('SEGURO');
    setNote('');
    setEditingItem(null);
  }

  async function addExpense() {
    if (!category || !subcategory || !profile?.id || !profile.org_id) {
      Alert.alert('Error', 'Debes seleccionar categoría y subcategoría');
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
        COLLECTIONS.budget_safe_style_expenses,
        {
          user_id: profile.id,
          org_id: profile.org_id,
          month: monthKey,
          category: category.trim(),
          subcategory: subcategory.trim(),
          amount: num,
          budget_type: budgetType,
          note: note.trim() || null,
          created_at: new Date().toISOString(),
        } as Record<string, unknown>,
        undefined,
        permissions
      );
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      if (__DEV__) console.error('[presupuesto-seguro-estilo] create error:', err);
      Alert.alert('Error', msg);
      return;
    }
    setLoading(false);
    resetForm();
    setShowForm(false);
    loadExpenses();
  }

  async function saveEdit() {
    if (!editingItem) return;
    if (!category || !subcategory) {
      Alert.alert('Error', 'Debes seleccionar categoría y subcategoría');
      return;
    }
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (Number.isNaN(num) || num <= 0) {
      Alert.alert('Error', 'El monto debe ser un número mayor a 0');
      return;
    }
    setLoading(true);
    try {
      await updateDocument(COLLECTIONS.budget_safe_style_expenses, editingItem.id, {
        category: category.trim(),
        subcategory: subcategory.trim(),
        amount: num,
        budget_type: budgetType,
        note: note.trim() || null,
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
      return;
    }
    setLoading(false);
    resetForm();
    loadExpenses();
  }

  function confirmDelete(item: BudgetExpense) {
    Alert.alert(
      'Eliminar gasto',
      `¿Eliminar "${item.category} - ${item.subcategory}" (${Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteExpense(item) },
      ]
    );
  }

  async function deleteExpense(item: BudgetExpense) {
    try {
      await deleteDocument(COLLECTIONS.budget_safe_style_expenses, item.id);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al eliminar');
      return;
    }
    loadExpenses();
  }

  function openEdit(item: BudgetExpense) {
    setEditingItem(item);
    setCategory(item.category);
    setSubcategory(item.subcategory);
    setAmount(String(item.amount));
    setBudgetType(item.budget_type);
    setNote(item.note || '');
  }

  const totalSeguro = expenses.filter((e) => e.budget_type === 'SEGURO').reduce((sum, e) => sum + e.amount, 0);
  const totalEstilo = expenses.filter((e) => e.budget_type === 'ESTILO').reduce((sum, e) => sum + e.amount, 0);
  const totalGeneral = totalSeguro + totalEstilo;

  const availableSubcategories = category ? (CATEGORIES[category] || []) : [];

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

        {/* Resumen de totales */}
        <View style={styles.summaryRow}>
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[styles.summaryCard, styles.summaryCardSeguro]}
          >
            <View style={styles.summaryCardHeader}>
              <Shield size={20} color="#16a34a" />
              <Text style={styles.summaryCardLabel}>Presupuesto Seguro</Text>
            </View>
            <Text style={styles.summaryCardAmount}>
              {totalSeguro.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </Text>
          </MotiView>
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 80 }}
            style={[styles.summaryCard, styles.summaryCardEstilo]}
          >
            <View style={styles.summaryCardHeader}>
              <Sparkles size={20} color="#a855f7" />
              <Text style={styles.summaryCardLabel}>Presupuesto Estilo</Text>
            </View>
            <Text style={styles.summaryCardAmount}>
              {totalEstilo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </Text>
          </MotiView>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 120 }}
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
            {showForm ? 'Cancelar' : 'Agregar gasto'}
          </Button>
        </MotiView>

        {showForm && (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
            style={styles.formCard}
          >
            <Text style={styles.fieldLabel}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
              {Object.keys(CATEGORIES).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setCategory(cat);
                    setSubcategory(''); // Reset subcategory when category changes
                  }}
                  style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                >
                  <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {category && (
              <>
                <Text style={styles.fieldLabel}>Subcategoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                  {availableSubcategories.map((subcat) => (
                    <TouchableOpacity
                      key={subcat}
                      onPress={() => setSubcategory(subcat)}
                      style={[styles.categoryChip, subcategory === subcat && styles.categoryChipSelected]}
                    >
                      <Text style={[styles.categoryChipText, subcategory === subcat && styles.categoryChipTextSelected]}>
                        {subcat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.fieldLabel}>Tipo de presupuesto</Text>
            <View style={styles.budgetTypePicker}>
              {BUDGET_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = budgetType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => setBudgetType(type.value)}
                    style={[styles.budgetTypeChip, isSelected && styles.budgetTypeChipSelected]}
                  >
                    <Icon size={18} color={isSelected ? '#fff' : '#64748b'} />
                    <Text style={[styles.budgetTypeChipText, isSelected && styles.budgetTypeChipTextSelected]}>
                      {type.label}
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

            <Button onPress={addExpense} disabled={loading} theme="green" size="$4">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </MotiView>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total del mes</Text>
          <Text style={styles.totalAmount}>
            {totalGeneral.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Gastos registrados</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>No hay gastos registrados este mes. Agrega uno con "Agregar gasto".</Text>
        ) : (
          <MotiView
            from={{ opacity: 0, translateX: -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 320 }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <PieChart size={20} color="#2563eb" />
              <Text style={styles.cardTitle}>Gastos informativos</Text>
            </View>
            {expenses.map((item) => {
              const budgetTypeInfo = BUDGET_TYPES.find((t) => t.value === item.budget_type);
              const TypeIcon = budgetTypeInfo?.icon || Shield;
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeader}>
                      <TypeIcon size={16} color={item.budget_type === 'SEGURO' ? '#16a34a' : '#a855f7'} />
                      <Text style={styles.itemCategory}>{item.category}</Text>
                    </View>
                    <Text style={styles.itemSubcategory}>{item.subcategory}</Text>
                    {item.note && <Text style={styles.itemNote}>{item.note}</Text>}
                    <Text style={styles.itemAmount}>
                      {Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </Text>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn} accessibilityLabel="Editar">
                      <Pencil size={18} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.actionBtn} accessibilityLabel="Eliminar">
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
          accessibilityLabel="Agregar gasto"
        >
          <Plus size={26} color="#fff" />
        </TouchableOpacity>
      </MotiView>

      <Modal visible={editingItem !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => resetForm()}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Editar gasto</Text>

            <Text style={styles.fieldLabel}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
              {Object.keys(CATEGORIES).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setCategory(cat);
                    if (!CATEGORIES[cat].includes(subcategory)) {
                      setSubcategory('');
                    }
                  }}
                  style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                >
                  <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {category && (
              <>
                <Text style={styles.fieldLabel}>Subcategoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                  {availableSubcategories.map((subcat) => (
                    <TouchableOpacity
                      key={subcat}
                      onPress={() => setSubcategory(subcat)}
                      style={[styles.categoryChip, subcategory === subcat && styles.categoryChipSelected]}
                    >
                      <Text style={[styles.categoryChipText, subcategory === subcat && styles.categoryChipTextSelected]}>
                        {subcat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.fieldLabel}>Tipo de presupuesto</Text>
            <View style={styles.budgetTypePicker}>
              {BUDGET_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = budgetType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => setBudgetType(type.value)}
                    style={[styles.budgetTypeChip, isSelected && styles.budgetTypeChipSelected]}
                  >
                    <Icon size={18} color={isSelected ? '#fff' : '#64748b'} />
                    <Text style={[styles.budgetTypeChipText, isSelected && styles.budgetTypeChipTextSelected]}>
                      {type.label}
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
  summaryCardSeguro: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  summaryCardEstilo: {
    borderLeftWidth: 4,
    borderLeftColor: '#a855f7',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryCardLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  summaryCardAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
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
  categoryPicker: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  budgetTypePicker: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  budgetTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  budgetTypeChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  budgetTypeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  budgetTypeChipTextSelected: {
    color: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
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
  itemCategory: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemSubcategory: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  itemNote: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 },
  itemAmount: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 4 },
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
