import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Platform, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { Button } from 'tamagui';
import { TrendingDown, TrendingUp, Pencil, Trash2 } from '@tamagui/lucide-icons';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { listDocuments, createDocument, updateDocument, deleteDocument, execFunction, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { seedDefaultsLocally, markProfileDefaultsSeeded } from '@/lib/seed-defaults';
import { awardPoints } from '@/lib/points';
import { PointsRewardModal } from '@/components/PointsRewardModal';
import {
  getCategoryIcon,
  getCategoryColor,
  CATEGORY_ICON_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
} from '@/lib/category-icons';

type Category = { id: string; name: string; kind: string; icon?: string | null; color?: string | null };

const KIND_OPTIONS = [
  { value: 'EXPENSE' as const, label: 'Categoría de gasto', icon: TrendingDown },
  { value: 'INCOME' as const, label: 'Categoría de ingreso', icon: TrendingUp },
];

export default function CategoriesScreen() {
  const { profile, refresh } = useAuth();
  const pointsContext = usePoints();
  const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [selectedIcon, setSelectedIcon] = useState('Receipt');
  const [selectedColor, setSelectedColor] = useState('#2563eb');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    (async () => {
      // Seed default categories/accounts only the first time (per profile.defaults_seeded_at).
      if (!profile.defaults_seeded_at) {
        let ok = false;
        try {
          await Promise.all([
            execFunction('seed_default_categories', { p_org_id: profile.org_id, p_user_id: profile.id }, false),
            execFunction('seed_default_accounts', { p_org_id: profile.org_id, p_user_id: profile.id }, false),
          ]);
          ok = true;
        } catch {
          try {
            await seedDefaultsLocally(profile.org_id!, profile.id);
            ok = true;
          } catch (_) {}
        }
        if (ok) {
          try {
            await markProfileDefaultsSeeded(profile.id);
            await refresh();
          } catch (_) {}
        }
      }
      const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
        Query.equal('user_id', [profile.id]),
        Query.equal('kind', ['INCOME', 'EXPENSE']),
        Query.orderAsc('name'),
        Query.limit(500),
      ]);
      setCategories(data.map((d) => ({
        id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '',
        name: (d.name as string) ?? '',
        kind: (d.kind as string) ?? '',
        icon: (d.icon as string) ?? null,
        color: (d.color as string) ?? null,
      })) as Category[]);
    })();
  }, [profile?.id, profile?.org_id, profile?.defaults_seeded_at, refresh]);

  function openEditForm(cat: Category) {
    setEditingCategory(cat);
    setName(cat.name);
    setKind(cat.kind as 'INCOME' | 'EXPENSE');
    setSelectedIcon(cat.icon ?? 'Receipt');
    setSelectedColor(cat.color ?? '#2563eb');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingCategory(null);
    setName('');
    setKind('EXPENSE');
    setSelectedIcon('Receipt');
    setSelectedColor('#2563eb');
  }

  async function createCategory() {
    if (!name.trim() || !profile?.id || !profile.org_id) return;
    setLoading(true);
    const result = await createDocument(COLLECTIONS.categories, {
      org_id: profile.org_id,
      user_id: profile.id,
      kind,
      name: name.trim(),
      is_default: false,
      icon: selectedIcon,
      color: selectedColor,
      created_at: new Date().toISOString(),
    } as Record<string, unknown>);
    setLoading(false);
    const newId = (result as { $id?: string }).$id ?? (result as { id?: string }).id ?? '';
    if (!newId) {
      Alert.alert('Error', 'No se pudo crear la categoría.');
      return;
    }
    const pointsAwarded = await awardPoints(profile.org_id, profile.id, 'CREATE_CATEGORY', 'categories', newId);
    if (pointsAwarded > 0) {
      setRewardToShow({ points: pointsAwarded, message: '¡Categoría creada!' });
    }
    cancelForm();
    await refreshCategories();
  }

  async function updateCategory() {
    if (!editingCategory || !name.trim() || !profile?.id) return;
    setLoading(true);
    try {
      await updateDocument(COLLECTIONS.categories, editingCategory.id, {
        name: name.trim(),
        kind,
        icon: selectedIcon,
        color: selectedColor,
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
      return;
    }
    setLoading(false);
    cancelForm();
    await refreshCategories();
  }

  async function refreshCategories() {
    if (!profile?.id) return;
    const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
      Query.equal('user_id', [profile.id]),
      Query.equal('kind', ['INCOME', 'EXPENSE']),
      Query.orderAsc('name'),
      Query.limit(500),
    ]);
    setCategories(data.map((d) => ({
      id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '',
      name: (d.name as string) ?? '',
      kind: (d.kind as string) ?? '',
      icon: (d.icon as string) ?? null,
      color: (d.color as string) ?? null,
    })) as Category[]);
  }

  function confirmDelete(cat: Category) {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${cat.name}"? Las transacciones quedarán sin categoría y los límites de presupuesto asociados se eliminarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteCategory(cat) },
      ]
    );
  }

  async function deleteCategory(cat: Category) {
    if (!profile?.id) return;
    const previous = categories;
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    setLoading(true);
    if (editingCategory?.id === cat.id) cancelForm();

    const showError = (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : err && typeof err === 'object' && 'code' in err
            ? `[${(err as { code?: number }).code}] ${(err as { message?: string }).message ?? ''}`
            : String(err);
      if (__DEV__) console.error('[categories] delete error:', err);
      setCategories(previous);
      setLoading(false);
      Alert.alert('Error al eliminar', msg || 'No se pudo eliminar la categoría. Revisa permisos en Appwrite (colección categories: Delete para Users).');
    };

    try {
      await deleteDocument(COLLECTIONS.categories, cat.id);
      setLoading(false);
      await refreshCategories();
      return;
    } catch (err) {
      try {
        const exec = await execFunction(
          'delete_category',
          { category_id: cat.id, user_id: profile.id },
          false
        );
        const body = (exec as { responseBody?: string })?.responseBody;
        if (body && (body.includes('"ok":true') || body.includes('"ok": true'))) {
          setLoading(false);
          await refreshCategories();
          return;
        }
      } catch (_) {
        // delete_category no desplegada o falló
      }
      showError(err);
    }
  }

  const expenseCategories = categories.filter((c) => c.kind === 'EXPENSE');
  const incomeCategories = categories.filter((c) => c.kind === 'INCOME');

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Button
            onPress={() => (showForm ? cancelForm() : setShowForm(true))}
            theme="blue"
            size="$3"
            width="100%"
            marginBottom={20}
          >
            {showForm ? 'Cancelar' : 'Nueva categoría'}
          </Button>
        </MotiView>

        {showForm && (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
            style={styles.formCard}
          >
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.kindRow}>
              {KIND_OPTIONS.map(({ value, label, icon: Icon }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setKind(value)}
                  style={[styles.kindChip, kind === value && styles.kindChipActive]}
                >
                  <Icon size={20} color={kind === value ? '#fff' : '#64748b'} />
                  <Text style={[styles.kindChipText, kind === value && styles.kindChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Comida, Transporte, Nómina"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
            <Text style={styles.fieldLabel}>Icono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
              {CATEGORY_ICON_OPTIONS.map(({ value }) => {
                const IconComponent = getCategoryIcon(value, kind);
                const isSelected = selectedIcon === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setSelectedIcon(value)}
                    style={[
                      styles.iconOption,
                      { backgroundColor: isSelected ? selectedColor + '33' : '#f1f5f9' },
                      isSelected && { borderColor: selectedColor, borderWidth: 2 },
                    ]}
                  >
                    <IconComponent size={24} color={isSelected ? selectedColor : '#64748b'} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {CATEGORY_COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                />
              ))}
            </View>
            <Button
              onPress={editingCategory ? updateCategory : createCategory}
              disabled={loading}
              theme="green"
              size="$4"
            >
              {loading ? 'Guardando...' : editingCategory ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </MotiView>
        )}

        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 150 }}>
          <Text style={styles.helper}>
            Estas categorías se usan al registrar gastos e ingresos en Transacciones.
          </Text>
        </MotiView>

        <Text style={styles.sectionTitle}>Categorías de gastos</Text>
        {expenseCategories.length === 0 ? (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Text style={styles.emptyText}>No hay categorías de gasto. Crea una arriba.</Text>
          </MotiView>
        ) : (
          expenseCategories.map((item, index) => {
            const IconComp = getCategoryIcon(item.icon, 'EXPENSE');
            const color = getCategoryColor(item.color, index);
            return (
              <MotiView
                key={item.id}
                from={{ opacity: 0, translateX: -12 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 320, delay: 180 + index * 50 }}
              style={styles.catCard}
            >
                <View style={[styles.catIconWrap, { backgroundColor: color + '22' }]}>
                  <IconComp size={22} color={color} />
                </View>
                <Text style={styles.catName}>{item.name}</Text>
                <View style={styles.catActions}>
                  <TouchableOpacity onPress={() => openEditForm(item)} style={styles.catActionBtn} accessibilityLabel="Editar">
                    <Pencil size={18} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.catActionBtn} accessibilityLabel="Eliminar">
                    <Trash2 size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </MotiView>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Categorías de ingresos</Text>
        {incomeCategories.length === 0 ? (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Text style={styles.emptyText}>No hay categorías de ingreso. Crea una arriba.</Text>
          </MotiView>
        ) : (
          incomeCategories.map((item, index) => {
            const IconComp = getCategoryIcon(item.icon, 'INCOME');
            const color = getCategoryColor(item.color, index);
            return (
              <MotiView
                key={item.id}
                from={{ opacity: 0, translateX: -12 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 320, delay: 200 + index * 50 }}
              style={styles.catCard}
            >
                <View style={[styles.catIconWrap, { backgroundColor: color + '22' }]}>
                  <IconComp size={22} color={color} />
                </View>
                <Text style={styles.catName}>{item.name}</Text>
                <View style={styles.catActions}>
                  <TouchableOpacity onPress={() => openEditForm(item)} style={styles.catActionBtn} accessibilityLabel="Editar">
                    <Pencil size={18} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.catActionBtn} accessibilityLabel="Eliminar">
                    <Trash2 size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </MotiView>
            );
          })
        )}
      </ScrollView>

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
  kindRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  kindChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  kindChipActive: { backgroundColor: '#2563eb' },
  kindChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  kindChipTextActive: { color: '#fff' },
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
  iconPicker: { flexDirection: 'row', marginBottom: 18, gap: 8 },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  helper: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 12, marginTop: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  catName: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  catActions: { flexDirection: 'row', gap: 8 },
  catActionBtn: { padding: 8 },
});
