import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth } from 'date-fns';

export default function FinanceOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthIncome, setMonthIncome] = useState<number>(0);
  const [monthExpense, setMonthExpense] = useState<number>(0);

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    supabase.rpc('seed_default_categories', {
      p_org_id: profile.org_id,
      p_user_id: profile.id,
    }).then(() => {});
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();
    (async () => {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, opening_balance')
        .eq('user_id', profile.id);
      let balance = 0;
      (accounts ?? []).forEach((a: { id: string; opening_balance: number }) => {
        balance += Number(a.opening_balance);
      });
      const { data: allTx } = await supabase
        .from('transactions')
        .select('kind, amount')
        .eq('user_id', profile.id);
      (allTx ?? []).forEach((t: { kind: string; amount: number }) => {
        const amt = Number(t.amount);
        if (t.kind === 'INCOME') balance += amt;
        else if (t.kind === 'EXPENSE') balance -= amt;
      });
      setTotalBalance(balance);
      const { data: tx } = await supabase
        .from('transactions')
        .select('kind, amount')
        .eq('user_id', profile.id)
        .gte('occurred_at', monthStart)
        .lte('occurred_at', monthEnd);
      let income = 0;
      let expense = 0;
      (tx ?? []).forEach((t: { kind: string; amount: number }) => {
        const amt = Number(t.amount);
        if (t.kind === 'INCOME') income += amt;
        else if (t.kind === 'EXPENSE') expense += amt;
      });
      setMonthIncome(income);
      setMonthExpense(expense);
    })();
  }, [profile?.id, profile?.org_id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Balance total</Text>
        <Text style={styles.balance}>{totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.card, styles.half]}>
          <Text style={styles.label}>Ingresos del mes</Text>
          <Text style={styles.income}>{monthIncome.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
        </View>
        <View style={[styles.card, styles.half]}>
          <Text style={styles.label}>Gastos del mes</Text>
          <Text style={styles.expense}>{monthExpense.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.link} onPress={() => router.push('/(tabs)/finance/accounts')}>
        <Text style={styles.linkText}>Ver cuentas</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => router.push('/(tabs)/finance/transactions')}>
        <Text style={styles.linkText}>Ver transacciones</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => router.push('/(tabs)/finance/budgets')}>
        <Text style={styles.linkText}>Ver presupuestos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  card: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  half: { flex: 1 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  balance: { fontSize: 28, fontWeight: 'bold' },
  income: { fontSize: 20, fontWeight: '600', color: '#16a34a' },
  expense: { fontSize: 20, fontWeight: '600', color: '#dc2626' },
  link: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  linkText: { fontSize: 16, color: '#2563eb' },
});
