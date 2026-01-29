import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';

const ACCOUNT_TYPES = ['CASH', 'BANK', 'CARD', 'SAVINGS', 'INVESTMENT'] as const;

type Account = { id: string; name: string; type: string; currency: string; opening_balance: number };

export default function AccountsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>('BANK');
  const [openingBalance, setOpeningBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, name, type, currency, opening_balance')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setAccounts((data ?? []) as Account[]);
    })();
  }, [profile?.id, profile?.org_id]);

  async function createAccount() {
    if (!name.trim() || !profile?.id || !profile.org_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: profile.id,
        org_id: profile.org_id,
        name: name.trim(),
        type,
        currency: 'MXN',
        opening_balance: parseFloat(openingBalance || '0') || 0,
      })
      .select('id')
      .single();
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await awardPoints(profile.org_id, profile.id, 'CREATE_ACCOUNT', 'accounts', data?.id);
    setName('');
    setOpeningBalance('');
    setShowForm(false);
    const { data: list } = await supabase
      .from('accounts')
      .select('id, name, type, currency, opening_balance')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setAccounts((list ?? []) as Account[]);
  }

  return (
    <View style={styles.container}>
      <Button onPress={() => setShowForm(!showForm)} theme="blue" size="$3">
        {showForm ? 'Cancelar' : 'Nueva cuenta'}
      </Button>
      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Tipo: CASH, BANK, CARD, SAVINGS, INVESTMENT"
            value={type}
            onChangeText={(t) => setType(t as (typeof ACCOUNT_TYPES)[number])}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Saldo inicial (0)"
            value={openingBalance}
            onChangeText={setOpeningBalance}
            keyboardType="decimal-pad"
            editable={!loading}
          />
          <Button onPress={createAccount} disabled={loading} theme="green">
            {loading ? 'Guardando...' : 'Crear'}
          </Button>
        </View>
      )}
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.balance}>
              {Number(item.opening_balance).toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' })}
            </Text>
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
  name: { flex: 1, fontWeight: '600' },
  type: { fontSize: 12, color: '#666' },
  balance: { fontWeight: '600' },
});
