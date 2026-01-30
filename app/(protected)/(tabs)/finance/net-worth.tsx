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
import { LayoutGrid, Pencil, Plus, Trash2 } from '@tamagui/lucide-icons';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

type PhysicalAsset = {
  id: string;
  name: string;
  amount: number;
  created_at: string;
};

export default function NetWorthScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<PhysicalAsset[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PhysicalAsset | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    loadAssets();
  }, [profile?.id, profile?.org_id]);

  async function loadAssets() {
    if (!profile?.id || !profile.org_id) return;
    const { data } = await supabase
      .from('physical_assets')
      .select('id, name, amount, created_at')
      .eq('user_id', profile.id)
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: true });
    setItems((data ?? []) as PhysicalAsset[]);
  }

  async function addItem() {
    if (!name.trim() || !profile?.id || !profile.org_id) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (Number.isNaN(num) || num <= 0) {
      Alert.alert('Error', 'El monto debe ser un número mayor a 0');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('physical_assets').insert({
      user_id: profile.id,
      org_id: profile.org_id,
      name: name.trim(),
      amount: num,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setName('');
    setAmount('');
    setShowForm(false);
    loadAssets();
  }

  async function saveEdit() {
    if (!editingItem) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    const num = parseFloat(editAmount.replace(/,/g, '.'));
    if (Number.isNaN(num) || num <= 0) {
      Alert.alert('Error', 'El monto debe ser un número mayor a 0');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('physical_assets')
      .update({ name: editName.trim(), amount: num })
      .eq('id', editingItem.id);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setEditingItem(null);
    setEditName('');
    setEditAmount('');
    loadAssets();
  }

  function confirmDelete(item: PhysicalAsset) {
    Alert.alert(
      'Eliminar bien',
      `¿Eliminar "${item.name}" (${Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteItem(item) },
      ]
    );
  }

  async function deleteItem(item: PhysicalAsset) {
    const { error } = await supabase.from('physical_assets').delete().eq('id', item.id);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    loadAssets();
  }

  function openEdit(item: PhysicalAsset) {
    setEditingItem(item);
    setEditName(item.name);
    setEditAmount(String(item.amount));
  }

  const total = items.reduce((sum, a) => sum + Number(a.amount), 0);

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
            {showForm ? 'Cancelar' : 'Agregar bien'}
          </Button>
        </MotiView>

        {showForm && (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
            style={styles.formCard}
          >
            <Text style={styles.fieldLabel}>Nombre del bien</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Auto, Casa, Electrodoméstico"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
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
            <Button onPress={addItem} disabled={loading} theme="green" size="$4">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </MotiView>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>
            {total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Inventario</Text>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>No hay bienes. Agrega uno con "Agregar bien".</Text>
        ) : (
          <MotiView
            from={{ opacity: 0, translateX: -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 320 }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <LayoutGrid size={20} color="#2563eb" />
              <Text style={styles.cardTitle}>Bienes físicos</Text>
            </View>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
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
            ))}
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
          onPress={() => setShowForm(true)}
          activeOpacity={0.9}
          accessibilityLabel="Agregar bien"
        >
          <Plus size={26} color="#fff" />
        </TouchableOpacity>
      </MotiView>

      <Modal visible={editingItem !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => { setEditingItem(null); setEditName(''); setEditAmount(''); }}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Editar bien</Text>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Auto, Casa"
              placeholderTextColor="#94a3b8"
              value={editName}
              onChangeText={setEditName}
              editable={!loading}
            />
            <Text style={styles.fieldLabel}>Monto (MXN)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
            <View style={styles.modalActions}>
              <Button
                onPress={() => { setEditingItem(null); setEditName(''); setEditAmount(''); }}
                theme="gray"
                size="$3"
                flex={1}
              >
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemAmount: { fontSize: 13, color: '#64748b', marginTop: 2 },
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
