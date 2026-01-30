import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, format, addMonths, subMonths, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { MotiView } from 'moti';
import { Button } from 'tamagui';
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CreditCard,
  List,
  Tag,
  PieChart,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from '@tamagui/lucide-icons';
import { IncomeExpenseChart } from '@/components/finance/IncomeExpenseChart';
import { ExpenseByCategoryChart, type CategoryExpense } from '@/components/finance/ExpenseByCategoryChart';
import { Last3MonthsChart, type MonthStats } from '@/components/finance/Last3MonthsChart';
import { SavingsGoalProgress } from '@/components/finance/SavingsGoalProgress';
import { PilotCard } from '@/components/pilot/PilotCard';
import { getOrCreateDailyRecommendation } from '@/lib/pilot';
import type { PilotRecommendation } from '@/types/pilot';
import type { SavingsGoalWithProgress } from '@/types/database';

type LatestTransaction = {
  id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  note: string | null;
  account_id: string;
  category_id?: string | null;
  is_recurring?: boolean;
  recurrence_day_of_month?: number | null;
  recurrence_interval_months?: number | null;
  recurrence_total_occurrences?: number | null;
  isRecurringInstance?: boolean;
};

type AccountRef = { id: string; name: string };
type CategoryRef = { id: string; name: string };

type BudgetCategoryRemaining = {
  categoryName: string;
  categoryId: string;
  limit: number;
  spent: number;
  remaining: number;
};

const LINK_ITEMS = [
  { label: 'Ver cuentas', href: '/(tabs)/finance/accounts', icon: CreditCard },
  { label: 'Ver transacciones', href: '/(tabs)/finance/transactions', icon: List },
  { label: 'Ver categorías', href: '/(tabs)/finance/categories', icon: Tag },
  { label: 'Ver presupuestos', href: '/(tabs)/finance/budgets', icon: PieChart },
  { label: 'Patrimonio Líquido', href: '/(tabs)/finance/net-worth', icon: LayoutGrid },
] as const;

export default function FinanceOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthIncome, setMonthIncome] = useState<number>(0);
  const [monthExpense, setMonthExpense] = useState<number>(0);
  const [latestTransactions, setLatestTransactions] = useState<LatestTransaction[]>([]);
  const [accountsRef, setAccountsRef] = useState<AccountRef[]>([]);
  const [categoriesRef, setCategoriesRef] = useState<CategoryRef[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<CategoryExpense[]>([]);
  const [budgetRemaining, setBudgetRemaining] = useState<BudgetCategoryRemaining[]>([]);
  const [last3MonthsStats, setLast3MonthsStats] = useState<MonthStats[]>([]);
  const [pilotRecommendation, setPilotRecommendation] = useState<PilotRecommendation | null>(null);
  const [savingsGoalsWithProgress, setSavingsGoalsWithProgress] = useState<SavingsGoalWithProgress[]>([]);

  const monthNet = monthIncome - monthExpense;

  function balanceForAccount(
    accountId: string,
    transactions: { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean }[],
    openingBalance: number
  ): number {
    const real = transactions.filter((t) => !t.is_recurring);
    let net = 0;
    for (const t of real) {
      const amt = Number(t.amount);
      if (t.account_id === accountId) {
        if (t.kind === 'INCOME') net += amt;
        else if (t.kind === 'EXPENSE') net -= amt;
        else if (t.kind === 'TRANSFER') net -= amt;
      } else if (t.transfer_account_id === accountId && t.kind === 'TRANSFER') {
        net += amt;
      }
    }
    return Number(openingBalance) + net;
  }

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    getOrCreateDailyRecommendation(profile.id, profile.org_id, new Date()).then(setPilotRecommendation);
  }, [profile?.id, profile?.org_id]);

  const goToNewTransaction = () => {
    router.push('/(tabs)/finance/transactions?new=1');
  };

  useEffect(() => {
    if (!profile?.id || !profile.org_id) return;
    supabase.rpc('seed_default_categories', {
      p_org_id: profile.org_id,
      p_user_id: profile.id,
    }).then(() => {});
    const monthStart = startOfMonth(selectedMonth).toISOString();
    const monthEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, opening_balance, type')
        .eq('user_id', profile.id);
      let balance = 0;
      (accounts ?? []).forEach((a: { id: string; opening_balance: number; type?: string }) => {
        const bal = Number(a.opening_balance);
        balance += (a.type === 'CREDIT' || a.type === 'CREDIT_CARD') ? -bal : bal;
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
        .select('kind, amount, is_recurring')
        .eq('user_id', profile.id)
        .gte('occurred_at', monthStart)
        .lte('occurred_at', monthEnd);
      const realTx = (tx ?? []).filter((t: { is_recurring?: boolean }) => !t.is_recurring);
      let income = 0;
      let expense = 0;
      realTx.forEach((t: { kind: string; amount: number }) => {
        const amt = Number(t.amount);
        if (t.kind === 'INCOME') income += amt;
        else if (t.kind === 'EXPENSE') expense += amt;
      });
      const { data: recurringTemplates } = await supabase
        .from('transactions')
        .select('kind, amount, recurrence_interval_months')
        .eq('user_id', profile.id)
        .eq('is_recurring', true);
      (recurringTemplates ?? []).forEach((t: { kind: string; amount: number; recurrence_interval_months?: number | null }) => {
        const interval = t.recurrence_interval_months ?? 1;
        const monthlyAmt = Math.round((Number(t.amount) / interval) * 100) / 100;
        if (t.kind === 'INCOME') income += monthlyAmt;
        else if (t.kind === 'EXPENSE') expense += monthlyAmt;
      });
      setMonthIncome(income);
      setMonthExpense(expense);
    })();
  }, [profile?.id, profile?.org_id, selectedMonth]);

  const monthStartIso = startOfMonth(selectedMonth).toISOString();
  const monthEndIso = endOfMonth(selectedMonth).toISOString();

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data: acc } = await supabase.from('accounts').select('id, name').eq('user_id', profile.id);
      setAccountsRef((acc ?? []) as AccountRef[]);
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', profile.id);
      setCategoriesRef((cat ?? []) as CategoryRef[]);
    })();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data: savingsAccounts } = await supabase
        .from('accounts')
        .select('id, name, opening_balance')
        .eq('user_id', profile.id)
        .eq('type', 'SAVINGS');
      if (!savingsAccounts?.length) {
        setSavingsGoalsWithProgress([]);
        return;
      }
      const accountIds = savingsAccounts.map((a: { id: string }) => a.id);
      const { data: goals } = await supabase
        .from('savings_goals')
        .select('id, account_id, target_amount, name')
        .in('account_id', accountIds);
      if (!goals?.length) {
        setSavingsGoalsWithProgress([]);
        return;
      }
      const { data: tx } = await supabase
        .from('transactions')
        .select('kind, amount, account_id, transfer_account_id, is_recurring')
        .eq('user_id', profile.id);
      const transactions = (tx ?? []) as { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean }[];
      const list: SavingsGoalWithProgress[] = goals.map((g: { id: string; account_id: string; target_amount: number; name: string | null }) => {
        const acc = savingsAccounts.find((a: { id: string }) => a.id === g.account_id);
        const openingBalance = acc ? Number(acc.opening_balance) : 0;
        const currentBalance = balanceForAccount(g.account_id, transactions, openingBalance);
        const targetAmount = Number(g.target_amount);
        const progressPct = targetAmount > 0 ? Math.min(100, (currentBalance / targetAmount) * 100) : 0;
        return {
          goalId: g.id,
          accountId: g.account_id,
          accountName: acc?.name ?? 'Ahorro',
          goalName: g.name,
          targetAmount,
          currentBalance,
          progressPct,
        };
      });
      setSavingsGoalsWithProgress(list);
    })();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const selectTx = 'id, kind, amount, occurred_at, note, account_id, category_id, is_recurring, recurrence_period, recurrence_day_of_month, recurrence_interval_months, recurrence_total_occurrences';
    (async () => {
      try {
        const { data: txRows, error: txErr } = await supabase
          .from('transactions')
          .select(selectTx)
          .eq('user_id', profile.id)
          .gte('occurred_at', monthStartIso)
          .lte('occurred_at', monthEndIso)
          .order('occurred_at', { ascending: false });
        if (txErr) {
          console.error('[finance index] transactions fetch error', txErr);
          setLatestTransactions([]);
          return;
        }
        const allInMonth = (txRows ?? []) as (LatestTransaction & { is_recurring?: boolean })[];
        const realRows = allInMonth.filter((r) => !r.is_recurring);
        const { data: recurringTemplates, error: recErr } = await supabase
          .from('transactions')
          .select(selectTx)
          .eq('user_id', profile.id)
          .eq('is_recurring', true);
        if (recErr) console.error('[finance index] recurring fetch error', recErr);
        const templates = (recurringTemplates ?? []) as (LatestTransaction & { recurrence_day_of_month?: number | null; recurrence_interval_months?: number | null; recurrence_total_occurrences?: number | null })[];
        const monthStartDate = startOfMonth(selectedMonth);
        const monthEndDate = endOfMonth(selectedMonth);
        const virtuals: LatestTransaction[] = [];
        for (const t of templates) {
          const day = t.recurrence_day_of_month ?? 1;
          const templateStart = new Date(t.occurred_at);
          const maxDay = monthEndDate.getDate();
          const safeDay = Math.min(day, maxDay);
          const d = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), safeDay);
          if (d < templateStart) continue;
          const start = startOfMonth(templateStart);
          const occurrenceIndex = differenceInMonths(monthStartDate, start) + 1;
          if (t.recurrence_total_occurrences != null && occurrenceIndex > t.recurrence_total_occurrences) continue;
          const interval = t.recurrence_interval_months ?? 1;
          const monthlyAmount = Math.round((Number(t.amount) / interval) * 100) / 100;
          virtuals.push({
            ...t,
            id: `recurring-${t.id}-${format(d, 'yyyy-MM-dd')}`,
            amount: monthlyAmount,
            occurred_at: d.toISOString(),
            isRecurringInstance: true,
          });
        }
        const combined = [...realRows, ...virtuals];
        combined.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
        setLatestTransactions(combined.slice(0, 7));
      } catch (e) {
        console.error('[finance index] transactions error', e);
        setLatestTransactions([]);
      }
    })();
  }, [profile?.id, monthStartIso, monthEndIso, selectedMonth]);

  useEffect(() => {
    if (!profile?.id) return;
    const monthStart = startOfMonth(selectedMonth).toISOString();
    const monthEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data } = await supabase
        .from('transactions')
        .select('amount, categories(name, color), is_recurring')
        .eq('user_id', profile.id)
        .eq('kind', 'EXPENSE')
        .gte('occurred_at', monthStart)
        .lte('occurred_at', monthEnd);
      const rows = (data ?? []) as { amount: number; categories: { name: string; color?: string | null } | null; is_recurring?: boolean }[];
      const realRows = rows.filter((r) => !r.is_recurring);
      const byCategory: Record<string, { amount: number; color?: string | null }> = {};
      let total = 0;
      realRows.forEach((row) => {
        const name = row.categories?.name ?? 'Sin categoría';
        const amt = Number(row.amount);
        const existing = byCategory[name];
        if (existing) {
          existing.amount += amt;
        } else {
          byCategory[name] = { amount: amt, color: row.categories?.color };
        }
        total += amt;
      });
      const { data: recurringExpenses } = await supabase
        .from('transactions')
        .select('amount, category_id, recurrence_interval_months, categories(name, color)')
        .eq('user_id', profile.id)
        .eq('kind', 'EXPENSE')
        .eq('is_recurring', true);
      (recurringExpenses ?? []).forEach((r: { amount: number; category_id: string | null; recurrence_interval_months?: number | null; categories: { name: string; color?: string | null } | null }) => {
        const interval = r.recurrence_interval_months ?? 1;
        const monthlyAmt = Math.round((Number(r.amount) / interval) * 100) / 100;
        const name = r.categories?.name ?? 'Sin categoría';
        const existing = byCategory[name];
        if (existing) {
          existing.amount += monthlyAmt;
        } else {
          byCategory[name] = { amount: monthlyAmt, color: r.categories?.color };
        }
        total += monthlyAmt;
      });
      const list: CategoryExpense[] = Object.entries(byCategory)
        .map(([categoryName, { amount, color: categoryColor }]) => ({
          categoryName,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          categoryColor,
        }))
        .sort((a, b) => b.amount - a.amount);
      setExpenseByCategory(list);
    })();
  }, [profile?.id, selectedMonth]);

  // Presupuestos se guardan con mes fijo '0000-01' y aplican al mes seleccionado
  const BUDGET_MONTH_KEY = '0000-01';

  useEffect(() => {
    if (!profile?.id) return;
    const monthStart = startOfMonth(selectedMonth).toISOString();
    const monthEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data: budgetData } = await supabase
        .from('budgets')
        .select(`
          id,
          budget_items (
            category_id,
            limit_amount,
            categories ( name )
          )
        `)
        .eq('user_id', profile.id)
        .eq('month', BUDGET_MONTH_KEY)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const rawItems = budgetData?.budget_items;
      const items = Array.isArray(rawItems) ? rawItems : [];
      if (items.length === 0) {
        setBudgetRemaining([]);
        return;
      }
      const { data: txData } = await supabase
        .from('transactions')
        .select('amount, category_id, is_recurring')
        .eq('user_id', profile.id)
        .eq('kind', 'EXPENSE')
        .gte('occurred_at', monthStart)
        .lte('occurred_at', monthEnd);
      const spentByCategory: Record<string, number> = {};
      (txData ?? []).forEach((row: { amount: number; category_id: string | null; is_recurring?: boolean }) => {
        if (row.is_recurring) return;
        const cid = row.category_id ?? '_sin_categoria';
        const amt = Number(row.amount);
        spentByCategory[cid] = (spentByCategory[cid] ?? 0) + amt;
      });
      const { data: recurringExpenses } = await supabase
        .from('transactions')
        .select('amount, category_id, recurrence_interval_months')
        .eq('user_id', profile.id)
        .eq('kind', 'EXPENSE')
        .eq('is_recurring', true);
      (recurringExpenses ?? []).forEach((r: { amount: number; category_id: string | null; recurrence_interval_months?: number | null }) => {
        const interval = r.recurrence_interval_months ?? 1;
        const monthlyAmt = Math.round((Number(r.amount) / interval) * 100) / 100;
        const cid = r.category_id ?? '_sin_categoria';
        spentByCategory[cid] = (spentByCategory[cid] ?? 0) + monthlyAmt;
      });
      const list: BudgetCategoryRemaining[] = items.map((item: { category_id: string; limit_amount: number; categories?: { name: string } | null }) => {
        const limit = Number(item.limit_amount);
        const spent = spentByCategory[item.category_id] ?? 0;
        const remaining = Math.max(0, limit - spent);
        const categoryName = item.categories?.name ?? 'Categoría';
        return {
          categoryName,
          categoryId: item.category_id,
          limit,
          spent,
          remaining,
        };
      });
      setBudgetRemaining(list);
    })();
  }, [profile?.id, selectedMonth]);

  // Estadísticas de ingresos y gastos de los últimos 3 meses (relativo al mes seleccionado)
  useEffect(() => {
    if (!profile?.id) return;
    const rangeStart = startOfMonth(subMonths(selectedMonth, 2)).toISOString();
    const rangeEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data: tx } = await supabase
        .from('transactions')
        .select('kind, amount, occurred_at, is_recurring')
        .eq('user_id', profile.id)
        .gte('occurred_at', rangeStart)
        .lte('occurred_at', rangeEnd);
      const rows = (tx ?? []) as { kind: string; amount: number; occurred_at: string; is_recurring?: boolean }[];
      const realRows = rows.filter((r) => !r.is_recurring);
      const byMonth: Record<string, { income: number; expense: number }> = {};
      for (let i = 0; i < 3; i++) {
        const m = subMonths(selectedMonth, 2 - i);
        const key = format(m, 'yyyy-MM');
        byMonth[key] = { income: 0, expense: 0 };
      }
      realRows.forEach((t) => {
        const key = format(new Date(t.occurred_at), 'yyyy-MM');
        if (!byMonth[key]) return;
        const amt = Number(t.amount);
        if (t.kind === 'INCOME') byMonth[key].income += amt;
        else if (t.kind === 'EXPENSE') byMonth[key].expense += amt;
      });
      const { data: recurringTemplates } = await supabase
        .from('transactions')
        .select('kind, amount, recurrence_interval_months')
        .eq('user_id', profile.id)
        .eq('is_recurring', true);
      (recurringTemplates ?? []).forEach((t: { kind: string; amount: number; recurrence_interval_months?: number | null }) => {
        const interval = t.recurrence_interval_months ?? 1;
        const monthlyAmt = Math.round((Number(t.amount) / interval) * 100) / 100;
        Object.keys(byMonth).forEach((key) => {
          if (t.kind === 'INCOME') byMonth[key].income += monthlyAmt;
          else if (t.kind === 'EXPENSE') byMonth[key].expense += monthlyAmt;
        });
      });
      const list: MonthStats[] = [];
      for (let i = 0; i < 3; i++) {
        const m = subMonths(selectedMonth, 2 - i);
        const key = format(m, 'yyyy-MM');
        const stats = byMonth[key] ?? { income: 0, expense: 0 };
        list.push({
          monthLabel: format(m, 'MMM yyyy', { locale: es }),
          income: stats.income,
          expense: stats.expense,
        });
      }
      setLast3MonthsStats(list);
    })();
  }, [profile?.id, selectedMonth]);

  const kindLabel = (kind: string) => {
    if (kind === 'INCOME') return 'Ingreso';
    if (kind === 'EXPENSE') return 'Gasto';
    return 'Transferencia';
  };

  const kindIcon = (kind: string) => {
    if (kind === 'INCOME') return TrendingUp;
    if (kind === 'EXPENSE') return TrendingDown;
    return ArrowRightLeft;
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {pilotRecommendation ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={styles.pilotCardWrap}
          >
            <PilotCard recommendation={pilotRecommendation} compact />
          </MotiView>
        ) : null}
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

        <Text style={styles.sectionTitle}>Resumen</Text>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 80 }}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Wallet size={22} color="#2563eb" />
            </View>
            <Text style={styles.label}>Balance total</Text>
          </View>
          <Text style={styles.balance}>{totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
        </MotiView>

        <View style={styles.row}>
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 120 }}
            style={[styles.card, styles.half]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, styles.iconCircleGreen]}>
                <TrendingUp size={18} color="#16a34a" />
              </View>
              <Text style={styles.label}>Ingresos</Text>
            </View>
            <Text style={styles.income}>{monthIncome.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
          </MotiView>
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 160 }}
            style={[styles.card, styles.half]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, styles.iconCircleRed]}>
                <TrendingDown size={18} color="#dc2626" />
              </View>
              <Text style={styles.label}>Gastos</Text>
            </View>
            <Text style={styles.expense}>{monthExpense.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
          </MotiView>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.cardSmall}
        >
          <Text style={styles.label}>Saldo del mes</Text>
          <Text style={[styles.netAmount, monthNet >= 0 ? styles.income : styles.expense]}>
            {monthNet >= 0 ? '' : '-'}{Math.abs(monthNet).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </Text>
        </MotiView>

        {savingsGoalsWithProgress.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Metas de ahorro</Text>
            <MotiView
              from={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 220 }}
              style={styles.savingsGoalsCard}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savingsGoalsScroll}
              >
                {savingsGoalsWithProgress.map((item, index) => (
                  <TouchableOpacity
                    key={item.goalId}
                    style={styles.savingsGoalItem}
                    onPress={() => router.push('/(tabs)/finance/accounts')}
                    activeOpacity={0.8}
                  >
                    <SavingsGoalProgress
                      progressPct={item.progressPct}
                      currentAmount={item.currentBalance}
                      targetAmount={item.targetAmount}
                      label={item.goalName ?? item.accountName}
                      size={100}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </MotiView>
          </>
        )}

        <Text style={styles.sectionTitle}>Ingresos vs Gastos</Text>
        <MotiView
          from={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 240 }}
          style={styles.chartCard}
        >
          <IncomeExpenseChart income={monthIncome} expense={monthExpense} height={100} />
        </MotiView>

        <Text style={styles.sectionTitle}>Estadísticas últimos 3 meses</Text>
        <MotiView
          from={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 260 }}
          style={styles.chartCard}
        >
          <Last3MonthsChart data={last3MonthsStats} />
        </MotiView>

        <Text style={styles.sectionTitle}>Gastos por categoría (este mes)</Text>
        <MotiView
          from={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 280 }}
          style={styles.chartCard}
        >
          <ExpenseByCategoryChart data={expenseByCategory} totalExpense={monthExpense} />
        </MotiView>

        <Text style={styles.sectionTitle}>Presupuesto del mes (por categoría)</Text>
        <MotiView
          from={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 300 }}
          style={styles.chartCard}
        >
          {budgetRemaining.length === 0 ? (
            <TouchableOpacity
              style={styles.budgetEmpty}
              onPress={() => router.push('/(tabs)/finance/budgets')}
              activeOpacity={0.7}
            >
              <PieChart size={32} color="#94a3b8" />
              <Text style={styles.budgetEmptyText}>No tienes límites de presupuesto este mes</Text>
              <Text style={styles.budgetEmptySub}>Toca para agregar por categoría</Text>
            </TouchableOpacity>
          ) : (
            <>
              {budgetRemaining.map((item, index) => {
                const isOver = item.remaining <= 0 && item.spent > 0;
                const pct = item.limit > 0 ? Math.min(100, (item.spent / item.limit) * 100) : 0;
                const pctLabel = item.limit > 0 ? Math.round((item.spent / item.limit) * 100) : 0;
                return (
                  <TouchableOpacity
                    key={`${item.categoryId}-${index}`}
                    style={styles.budgetRow}
                    onPress={() => router.push('/(tabs)/finance/budgets')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.budgetRowLeft}>
                      <View style={styles.budgetRowCategoryLine}>
                        <Text style={styles.budgetRowCategory}>{item.categoryName}</Text>
                        <Text style={[styles.budgetRowPct, isOver && styles.budgetRowPctOver]}>
                          {pctLabel}% gastado
                        </Text>
                      </View>
                      <View style={styles.budgetProgressWrap}>
                        <View style={[styles.budgetProgressBg, isOver && styles.budgetProgressBgOver]}>
                          <View
                            style={[
                              styles.budgetProgressFill,
                              isOver ? styles.budgetProgressFillOver : undefined,
                              { width: `${pct}%` },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.budgetRowDetail}>
                        {item.spent.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} /{' '}
                        {item.limit.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                      </Text>
                    </View>
                    <Text style={[styles.budgetRowRemaining, isOver && styles.budgetRowRemainingOver]}>
                      {isOver ? 'Excedido' : `Quedan ${item.remaining.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.budgetLink}
                onPress={() => router.push('/(tabs)/finance/budgets')}
                activeOpacity={0.7}
              >
                <PieChart size={18} color="#2563eb" />
                <Text style={styles.budgetLinkText}>Ver y editar presupuestos</Text>
              </TouchableOpacity>
            </>
          )}
        </MotiView>

        <Text style={styles.sectionTitle}>Transacciones del mes</Text>
        {latestTransactions.length === 0 ? (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 320 }}>
            <Text style={styles.emptyText}>No hay transacciones este mes</Text>
          </MotiView>
        ) : (
          <>
            {latestTransactions.map((item, index) => {
              const Icon = kindIcon(item.kind);
              const isVirtual = item.isRecurringInstance;
              const accountName = accountsRef.find((a) => a.id === item.account_id)?.name ?? 'Sin cuenta';
              const categoryName = item.category_id
                ? (categoriesRef.find((c) => c.id === item.category_id)?.name ?? 'Sin categoría')
                : 'Sin categoría';
              return (
                <MotiView
                  key={item.id}
                  from={{ opacity: 0, translateX: -12 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 350, delay: 320 + index * 50 }}
                >
                  <TouchableOpacity
                    style={styles.txRow}
                    onPress={() => router.push('/(tabs)/finance/transactions')}
                    activeOpacity={0.7}
                    accessibilityLabel={`${kindLabel(item.kind)} ${Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`}
                  >
                    <View style={[styles.txIconWrap, item.kind === 'EXPENSE' ? styles.txIconWrapRed : styles.txIconWrapGreen]}>
                      <Icon size={18} color={item.kind === 'EXPENSE' ? '#dc2626' : '#16a34a'} />
                    </View>
                    <View style={styles.txLeft}>
                      <View style={styles.txKindRow}>
                        <Text style={styles.txKind}>{kindLabel(item.kind)}</Text>
                        {isVirtual && (
                          <View style={styles.recurringBadge}>
                            <Text style={styles.recurringBadgeText}>Recurrente</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.txDate}>{format(new Date(item.occurred_at), 'dd/MM/yyyy')}</Text>
                      <Text numberOfLines={1} style={styles.txMeta}>
                        Categoría: {categoryName}
                      </Text>
                      <Text numberOfLines={1} style={styles.txMeta}>
                        Cuenta: {accountName}
                      </Text>
                      {item.note ? (
                        <Text numberOfLines={2} style={styles.txNote}>
                          Nota: {item.note}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={item.kind === 'EXPENSE' ? styles.txNeg : styles.txPos}>
                      {item.kind === 'EXPENSE' ? '-' : ''}{Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </Text>
                  </TouchableOpacity>
                </MotiView>
              );
            })}
            <TouchableOpacity
              style={styles.verMasLink}
              onPress={() => router.push('/(tabs)/finance/transactions')}
              activeOpacity={0.7}
              accessibilityLabel="Ver más transacciones"
            >
              <ChevronRight size={20} color="#2563eb" />
              <Text style={styles.verMasLinkText}>Ver más</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.links}>
          {LINK_ITEMS.map(({ label, href, icon: Icon }, i) => (
            <MotiView
              key={label}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 400 + i * 40 }}
            >
              <TouchableOpacity style={styles.link} onPress={() => router.push(href as any)} activeOpacity={0.7}>
                <Icon size={20} color="#2563eb" />
                <Text style={styles.linkText}>{label}</Text>
              </TouchableOpacity>
            </MotiView>
          ))}
        </View>
      </ScrollView>

      <MotiView
        from={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 14, delay: 300 }}
        style={styles.fabWrap}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={goToNewTransaction}
          activeOpacity={0.9}
          accessibilityLabel="Crear nueva transacción"
        >
          <Plus size={26} color="#fff" />
        </TouchableOpacity>
      </MotiView>
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
  pilotCardWrap: { marginBottom: 4 },
  monthNavWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  monthNavButton: { padding: 8 },
  monthNavLabel: { fontSize: 17, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSmall: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  savingsGoalsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  savingsGoalsScroll: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 16,
  },
  savingsGoalItem: {
    alignItems: 'center',
    minWidth: 120,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGreen: { backgroundColor: '#dcfce7' },
  iconCircleRed: { backgroundColor: '#fee2e2' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  half: { flex: 1 },
  label: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  balance: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  income: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  expense: { fontSize: 18, fontWeight: '700', color: '#dc2626' },
  netAmount: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txIconWrapGreen: { backgroundColor: '#dcfce7' },
  txIconWrapRed: { backgroundColor: '#fee2e2' },
  txLeft: { flex: 1 },
  txKindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  txKind: { fontSize: 15, fontWeight: '600', color: '#334155' },
  recurringBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  recurringBadgeText: { fontSize: 11, fontWeight: '600', color: '#4338ca' },
  txDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  txMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  txNote: { fontSize: 12, color: '#64748b', marginTop: 2, fontStyle: 'italic' },
  txNeg: { fontWeight: '700', color: '#dc2626', fontSize: 15 },
  txPos: { fontWeight: '700', color: '#16a34a', fontSize: 15 },
  budgetRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetRowLeft: { flex: 1, marginRight: 12 },
  budgetRowCategoryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetRowCategory: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  budgetRowPct: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  budgetRowPctOver: { color: '#dc2626' },
  budgetProgressWrap: { marginBottom: 4, width: '100%', alignSelf: 'stretch' },
  budgetProgressBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    width: '100%',
  },
  budgetProgressBgOver: { backgroundColor: '#fee2e2' },
  budgetProgressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  budgetProgressFillOver: { backgroundColor: '#dc2626' },
  budgetRowDetail: { fontSize: 12, color: '#64748b' },
  budgetRowRemaining: { fontSize: 14, fontWeight: '700', color: '#16a34a', minWidth: 100, textAlign: 'right' },
  budgetRowRemainingOver: { color: '#dc2626' },
  budgetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  budgetLinkText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  verMasLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  verMasLinkText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  budgetEmpty: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetEmptyText: { fontSize: 15, color: '#64748b', fontWeight: '500', marginTop: 8 },
  budgetEmptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  links: { marginTop: 16 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  linkText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
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
