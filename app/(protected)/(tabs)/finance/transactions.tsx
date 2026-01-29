import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Button } from 'tamagui';
import { format } from 'date-fns';

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };
type Transaction = { id: string; kind: string; amount: number; occurred_at: string; note: string | null; account_id: string };

export default function TransactionsScreen() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferAccountId, setTransferAccountId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, kind, amount, occurred_at, note, account_id')
        .eq('user_id', profile.id)
        .order('occurred_at', { ascending: false })
        .limit(100);
      setTransactions((tx ?? []) as Transaction[]);
      const { data: acc } = await supabase.from('accounts').select('id, name').eq('user_id', profile.id);
      setAccounts((acc ?? []) as Account[]);
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, kind')
        .eq('user_id', profile.id)
        .in('kind', ['INCOME', 'EXPENSE']);
      setCategories((cat ?? []) as Category[]);
    })();
  }, [profile?.id]);

  async function createTransaction() {
    if (!amount || !accountId || !profile?.id || !profile.org_id) return;
    if (kind !== 'TRANSFER' && !categoryId && kind !== 'INCOME') {
      const expCats = categories.filter((c) => c.kind === 'EXPENSE');
      if (kind === 'EXPENSE' && expCats.length) {
        Alert.alert('Elige una categoría para el gasto');
        return;
      }
    }
    if (kind === 'TRANSFER' && !transferAccountId) {
      Alert.alert('Elige la cuenta destino');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        org_id: profile.org_id,
        user_id: profile.id,
        account_id: accountId,
        kind,
        amount: Math.abs(parseFloat(amount)),
        occurred_at: new Date().toISOString(),
        category_id: kind === 'TRANSFER' ? null : categoryId || null,
        note: note.trim() || null,
        transfer_account_id: kind === 'TRANSFER' ? transferAccountId : null,
      })
      .select('id')
      .single();
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (kind === 'EXPENSE') await awardPoints(profile.org_id, profile.id, 'CREATE_EXPENSE', 'transactions', data?.id);
    if (kind === 'INCOME') await awardPoints(profile.org_id, profile.id, 'CREATE_INCOME', 'transactions', data?.id);
    setAmount('');
    setCategoryId('');
    setNote('');
    setShowForm(false);
    const { data: list } = await supabase
      .from('transactions')
      .select('id, kind, amount, occurred_at, note, account_id')
      .eq('user_id', profile.id)
      .order('occurred_at', { ascending: false })
      .limit(100);
    setTransactions((list ?? []) as Transaction[]);
  }

  return (
    <View style={styles.container}>
      <Button onPress={() => setShowForm(!showForm)} theme="blue" size="$3">
        {showForm ? 'Cancelar' : 'Nueva transacción'}
      </Button>
      {showForm && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Tipo: INCOME, EXPENSE, TRANSFER" value={kind} onChangeText={(t) => setKind(t as 'INCOME' | 'EXPENSE' | 'TRANSFER')} editable={!loading} />
          <TextInput style={styles.input} placeholder="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!loading} />
          <TextInput style={styles.input} placeholder="ID cuenta" value={accountId} onChangeText={setAccountId} editable={!loading} />
          {accounts.length > 0 && (
            <View style={styles.picker}>
              <Text>Cuenta:</Text>
              {accounts.map((a) => (
                <Button key={a.id} size="$2" onPress={() => setAccountId(a.id)} theme={accountId === a.id ? 'blue' : 'gray'}>
                  {a.name}
                </Button>
              ))}
            </View>
          )}
          {kind === 'TRANSFER' && (
            <View style={styles.picker}>
              <Text>Cuenta destino:</Text>
              {accounts.filter((a) => a.id !== accountId).map((a) => (
                <Button key={a.id} size="$2" onPress={() => setTransferAccountId(a.id)} theme={transferAccountId === a.id ? 'blue' : 'gray'}>
                  {a.name}
                </Button>
              ))}
            </View>
          )}
          {kind !== 'TRANSFER' && categories.filter((c) => c.kind === kind).length > 0 && (
            <View style={styles.picker}>
              <Text>Categoría:</Text>
              {categories.filter((c) => c.kind === kind).map((c) => (
                <Button key={c.id} size="$2" onPress={() => setCategoryId(c.id)} theme={categoryId === c.id ? 'blue' : 'gray'}>
                  {c.name}
                </Button>
              ))}
            </View>
          )}
          <TextInput style={styles.input} placeholder="Nota" value={note} onChangeText={setNote} editable={!loading} />
          <Button onPress={createTransaction} disabled={loading} theme="green">
            {loading ? 'Guardando...' : 'Crear'}
          </Button>
        </View>
      )}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.kind}>{item.kind}</Text>
            <Text style={item.kind === 'EXPENSE' ? styles.neg : styles.pos}>
              {item.kind === 'EXPENSE' ? '-' : ''}{Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </Text>
            <Text style={styles.date}>{format(new Date(item.occurred_at), 'dd/MM/yyyy')}</Text>
            {item.note ? <Text numberOfLines={1} style={styles.note}>{item.note}</Text> : null}
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
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  list: { flex: 1 },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  kind: { fontSize: 12, color: '#666' },
  neg: { fontWeight: '600', color: '#dc2626' },
  pos: { fontWeight: '600', color: '#16a34a' },
  date: { fontSize: 12, color: '#888' },
  note: { fontSize: 12, color: '#666', marginTop: 4 },
});
