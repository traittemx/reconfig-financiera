import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { format } from 'date-fns';

type Budget = { id: string; month: string; name: string };
type BudgetItem = { id: string; budget_id: string; category_id: string; limit_amount: number };
type Category = { id: string; name: string };

export default function BudgetsScreen() {
  const { profile } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from('budgets')
        .select('id, month, name')
        .eq('user_id', profile.id)
        .order('month', { ascending: false });
      setBudgets((data ?? []) as Budget[]);
    })();
  }, [profile?.id]);

  async function createBudget() {
    if (!name.trim() || !month || !profile?.id || !profile.org_id) return;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      Alert.alert('Mes debe ser YYYY-MM');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        org_id: profile.org_id,
        user_id: profile.id,
        month,
        name: name.trim(),
      })
      .select('id')
      .single();
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await awardPoints(profile.org_id, profile.id, 'CREATE_BUDGET', 'budgets', data?.id);
    setName('');
    setShowForm(false);
    const { data: list } = await supabase
      .from('budgets')
      .select('id, month, name')
      .eq('user_id', profile.id)
      .order('month', { ascending: false });
    setBudgets((list ?? []) as Budget[]);
  }

  return (
    <View style={styles.container}>
      <Button onPress={() => setShowForm(!showForm)} theme="blue" size="$3">
        {showForm ? 'Cancelar' : 'Nuevo presupuesto'}
      </Button>
      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Mes (YYYY-MM)"
            value={month}
            onChangeText={setMonth}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Nombre del presupuesto"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
          <Button onPress={createBudget} disabled={loading} theme="green">
            {loading ? 'Guardando...' : 'Crear'}
          </Button>
        </View>
      )}
      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.month}>{item.month}</Text>
            <Text style={styles.name}>{item.name}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  form: { marginTop: 16, marginBottom: 24 },
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
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', gap: 12 },
  month: { fontWeight: '600', width: 80 },
  name: { flex: 1 },
});
