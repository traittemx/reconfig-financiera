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
import { PieChart, Pencil, Trash2 } from '@tamagui/lucide-icons';
import { getCategoryIcon, getCategoryColor } from '@/lib/category-icons';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { supabase } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { PointsRewardModal } from '@/components/PointsRewardModal';

const FIXED_BUDGET_MONTH = '0000-01';

type Category = { id: string; name: string; kind: string; icon?: string | null; color?: string | null };

type BudgetItem = {
  id: string;
  category_id: string;
  limit_amount: number;
  categories: { name: string } | null;
};

type BudgetWithItems = {
  id: string;
  month: string;
  name: string;
  budget_items: BudgetItem[];
};

export default function BudgetsScreen() {
  const { profile } = useAuth();
  const pointsContext = usePoints();
  const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);
  const [budgets, setBudgets] = useState<BudgetWithItems[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [limitAmount, setLimitAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<{ budgetId: string; item: BudgetItem } | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const expenseCategories = categories.filter((c) => c.kind === 'EXPENSE');

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    (async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, kind, icon, color')
        .eq('user_id', profile.id)
        .in('kind', ['INCOME', 'EXPENSE'])
        .order('name');
      setCategories((data ?? []) as Category[]);
    })();
  }, [profile?.id, profile?.org_id]);

  useEffect(() => {
    if (!profile?.id) return;
    loadBudgets();
  }, [profile?.id]);

  async function loadBudgets() {
    const { data } = await supabase
      .from('budgets')
      .select(`
        id,
        month,
        name,
        budget_items (
          id,
          category_id,
          limit_amount,
          categories ( name )
        )
      `)
      .eq('user_id', profile!.id)
      .eq('month', FIXED_BUDGET_MONTH)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as BudgetWithItems[];
    setBudgets(list);
  }

  async function addOrUpdateBudgetItem() {
    if (!limitAmount.trim() || !profile?.id || !profile.org_id) return;
    const amount = parseFloat(limitAmount.replace(/,/g, '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'El límite debe ser un número mayor a 0');
      return;
    }
    if (!categoryId) {
      Alert.alert('Error', 'Elige una categoría');
      return;
    }
    setLoading(true);
    let budgetId: string | null = null;
    const existing = budgets.find((b) => b.month === FIXED_BUDGET_MONTH);
    if (existing) {
      budgetId = existing.id;
    } else {
      const { data: newBudget, error: errBudget } = await supabase
        .from('budgets')
        .insert({
          org_id: profile.org_id,
          user_id: profile.id,
          month: FIXED_BUDGET_MONTH,
          name: 'Presupuesto',
        })
        .select('id')
        .single();
      if (errBudget) {
        setLoading(false);
        Alert.alert('Error', errBudget.message);
        return;
      }
      budgetId = newBudget?.id ?? null;
    }
    if (!budgetId) {
      setLoading(false);
      return;
    }
    const existingItem = existing?.budget_items?.find((i) => i.category_id === categoryId);
    if (existingItem) {
      const { error } = await supabase
        .from('budget_items')
        .update({ limit_amount: amount })
        .eq('id', existingItem.id);
      setLoading(false);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('budget_items').insert({
        budget_id: budgetId,
        category_id: categoryId,
        limit_amount: amount,
      });
      setLoading(false);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      const pointsAwarded = await awardPoints(profile.org_id, profile.id, 'CREATE_BUDGET', 'budgets', budgetId);
      if (pointsAwarded > 0) {
        setRewardToShow({ points: pointsAwarded, message: '¡Presupuesto definido!' });
      }
    }
    setLimitAmount('');
    setCategoryId('');
    setShowForm(false);
    loadBudgets();
  }

  async function saveEdit() {
    if (!editingItem || !editAmount.trim()) return;
    const amount = parseFloat(editAmount.replace(/,/g, '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'El límite debe ser un número mayor a 0');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('budget_items')
      .update({ limit_amount: amount })
      .eq('id', editingItem.item.id);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setEditingItem(null);
    setEditAmount('');
    loadBudgets();
  }

  function confirmDelete(budget: BudgetWithItems, item: BudgetItem) {
    Alert.alert(
      'Eliminar límite',
      `¿Eliminar el límite de ${item.categories?.name ?? 'categoría'} (${Number(item.limit_amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteBudgetItem(budget, item),
        },
      ]
    );
  }

  async function deleteBudgetItem(budget: BudgetWithItems, item: BudgetItem) {
    const { error } = await supabase.from('budget_items').delete().eq('id', item.id);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    const remaining = (budget.budget_items ?? []).filter((i) => i.id !== item.id);
    if (remaining.length === 0) {
      await supabase.from('budgets').delete().eq('id', budget.id);
    }
    loadBudgets();
  }

  function openEdit(item: BudgetItem, budget: BudgetWithItems) {
    setEditingItem({ budgetId: budget.id, item });
    setEditAmount(String(item.limit_amount));
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Button
            onPress={() => setShowForm(!showForm)}
            theme="blue"
            size="$3"
            width="100%"
            marginBottom={20}
          >
            {showForm ? 'Cancelar' : 'Agregar límite por categoría'}
          </Button>
        </MotiView>

        {showForm && (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
            style={styles.formCard}
          >
            <Text style={styles.fieldLabel}>Categoría (gastos)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryChips}>
              {expenseCategories.map((c, idx) => {
                const CatIcon = getCategoryIcon(c.icon, 'EXPENSE');
                const catColor = getCategoryColor(c.color, idx);
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    style={[styles.chip, categoryId === c.id && styles.chipSelected]}
                  >
                    <View style={[styles.chipIconWrap, { backgroundColor: (categoryId === c.id ? '#fff' : catColor) + '33' }]}>
                      <CatIcon size={18} color={categoryId === c.id ? '#2563eb' : catColor} />
                    </View>
                    <Text style={[styles.chipText, categoryId === c.id && styles.chipTextSelected]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {expenseCategories.length === 0 && (
                <Text style={styles.hint}>Crea categorías de gasto en Categorías</Text>
              )}
            </ScrollView>
            <Text style={styles.fieldLabel}>Límite mensual ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="4000"
              value={limitAmount}
              onChangeText={setLimitAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
            <Button onPress={addOrUpdateBudgetItem} disabled={loading || expenseCategories.length === 0} theme="green" size="$4">
              {loading ? 'Guardando...' : 'Guardar límite'}
            </Button>
          </MotiView>
        )}

        <Text style={styles.sectionTitle}>Presupuesto</Text>
        {budgets.length === 0 ? (
          <Text style={styles.emptyText}>No hay presupuesto. Agrega un límite por categoría arriba.</Text>
        ) : (
          budgets.map((budget, index) => (
            <MotiView
              key={budget.id}
              from={{ opacity: 0, translateX: -12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 320, delay: 100 + index * 40 }}
              style={styles.monthCard}
            >
              <View style={styles.monthHeader}>
                <PieChart size={20} color="#2563eb" />
                <Text style={styles.monthTitle}>{budget.name}</Text>
              </View>
              {(budget.budget_items ?? []).length === 0 ? (
                <Text style={styles.noItems}>Sin límites por categoría</Text>
              ) : (
                (budget.budget_items ?? []).map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemCategory}>{item.categories?.name ?? 'Categoría'}</Text>
                      <Text style={styles.itemLimit}>
                        Límite: {Number(item.limit_amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => openEdit(item, budget)} style={styles.actionBtn} accessibilityLabel="Editar">
                        <Pencil size={18} color="#2563eb" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(budget, item)} style={styles.actionBtn} accessibilityLabel="Eliminar">
                        <Trash2 size={18} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </MotiView>
          ))
        )}
      </ScrollView>

      <Modal visible={editingItem !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditingItem(null)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Editar límite</Text>
            {editingItem && (
              <Text style={styles.modalCategory}>{editingItem.item.categories?.name ?? 'Categoría'}</Text>
            )}
            <Text style={styles.fieldLabel}>Nuevo límite ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="4000"
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
            <View style={styles.modalActions}>
              <Button onPress={() => { setEditingItem(null); setEditAmount(''); }} theme="gray" size="$3" flex={1}>
                Cancelar
              </Button>
              <Button onPress={saveEdit} disabled={loading} theme="green" size="$3" flex={1}>
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <PointsRewardModal
        visible={rewardToShow !== null}
        points={rewardToShow?.points ?? 0}
        message={rewardToShow?.message ?? ''}
        onDismiss={() => {
          setRewardToShow(null);
          pointsContext?.refresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
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
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 10 },
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
  categoryChips: { marginBottom: 16, maxHeight: 44 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
  },
  chipSelected: { backgroundColor: '#2563eb' },
  chipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  hint: { fontSize: 13, color: '#94a3b8' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  emptyText: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  monthCard: {
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
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  noItems: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemInfo: { flex: 1 },
  itemCategory: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemLimit: { fontSize: 13, color: '#64748b', marginTop: 2 },
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
    maxWidth: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  modalCategory: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
