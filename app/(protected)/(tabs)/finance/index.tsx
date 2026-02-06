import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { execFunction, listDocuments, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { seedDefaultsLocally, hasDefaultsSeededForUser, setDefaultsSeededForUser } from '@/lib/seed-defaults';
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
  ShieldCheck,
  Clock,
  Calendar,
} from '@tamagui/lucide-icons';
import { differenceInDays, isToday, isTomorrow } from 'date-fns';
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
  is_scheduled?: boolean;
};

type ScheduledTransaction = {
  id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  note: string | null;
  account_id: string;
  category_id?: string | null;
  is_scheduled: boolean;
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

const PILOT_CARD_DISMISSED_KEY = 'pilot_card_dismissed';

const LINK_ITEMS = [
  { label: 'Ver cuentas', href: '/(tabs)/finance/accounts', icon: CreditCard },
  { label: 'Ver transacciones', href: '/(tabs)/finance/transactions', icon: List },
  { label: 'Ver categorías', href: '/(tabs)/finance/categories', icon: Tag },
  { label: 'Ver presupuestos', href: '/(tabs)/finance/budgets', icon: PieChart },
  { label: 'Patrimonio Líquido', href: '/(tabs)/finance/net-worth', icon: LayoutGrid },
  { label: 'Presupuesto Seguro y Estilo', href: '/(tabs)/finance/presupuesto-seguro-estilo', icon: ShieldCheck },
  { label: 'Flujo de efectivo', href: '/(tabs)/finance/flujo-efectivo', icon: TrendingUp },
] as const;

export default function FinanceOverviewScreen() {
  const router = useRouter();
  const { profile, session, refresh } = useAuth();
  // Use same userId logic as accounts.tsx for consistency
  const userId = session?.user?.id ?? profile?.id;
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
  const [pilotCardDismissedDate, setPilotCardDismissedDate] = useState<string | null>(null);
  const [savingsGoalsWithProgress, setSavingsGoalsWithProgress] = useState<SavingsGoalWithProgress[]>([]);
  const [liquidAssetsTotal, setLiquidAssetsTotal] = useState<number>(0);
  const [safeBudgetTotal, setSafeBudgetTotal] = useState<number>(0);
  const [tranquilityIndex, setTranquilityIndex] = useState<number | null>(null);
  const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransaction[]>([]);

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
    if (!userId || !profile?.org_id) return;
    getOrCreateDailyRecommendation(userId, profile.org_id, new Date()).then(setPilotRecommendation);
  }, [userId, profile?.org_id]);

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(`${PILOT_CARD_DISMISSED_KEY}_${userId}`).then((stored) => {
      setPilotCardDismissedDate(stored ?? null);
    });
  }, [userId]);

  // Fetch scheduled transactions (future dated transactions)
  useEffect(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    (async () => {
      const { data: scheduled } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.equal('is_scheduled', [true]),
        Query.greaterThanEqual('occurred_at', now),
        Query.orderAsc('occurred_at'),
        Query.limit(5),
      ]);
      setScheduledTransactions(
        scheduled.map((t) => ({
          id: t.$id ?? t.id,
          kind: t.kind as string,
          amount: Number(t.amount),
          occurred_at: t.occurred_at as string,
          note: (t.note as string) ?? null,
          account_id: t.account_id as string,
          category_id: (t.category_id as string) ?? null,
          is_scheduled: true,
        }))
      );
    })();
  }, [userId, selectedMonth]);

  const goToNewTransaction = () => {
    router.push('/(tabs)/finance/transactions?new=1');
  };

  // Helper function to calculate balance for a single account (same as accounts.tsx)
  function calculateAccountBalance(
    accountId: string,
    transactions: { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean }[],
    openingBalance: number,
    isCredit: boolean
  ): number {
    const real = transactions.filter((t) => !t.is_recurring);
    let net = 0;
    for (const t of real) {
      const amt = Number(t.amount);
      if (t.account_id === accountId) {
        if (t.kind === 'INCOME') net += isCredit ? -amt : amt;
        else if (t.kind === 'EXPENSE') net += isCredit ? amt : -amt;
        else if (t.kind === 'TRANSFER') net += isCredit ? amt : -amt;
      } else if (t.transfer_account_id === accountId && t.kind === 'TRANSFER') {
        net += isCredit ? -amt : amt;
      }
    }
    return Number(openingBalance) + net;
  }

  function isDebtAccount(type: string): boolean {
    return type === 'CREDIT' || type === 'CREDIT_CARD';
  }

  useEffect(() => {
    console.log('[finance index] useEffect triggered - userId:', userId, 'profile?.org_id:', profile?.org_id, 'session:', session?.user?.id, 'profile?.id:', profile?.id);
    
    if (!userId) {
      console.log('[finance index] Skipping - no userId');
      return;
    }
    
    // Load data even without org_id (org_id only needed for seed functions)
    const loadData = async () => {
      try {
        console.log('[finance index] Loading accounts for userId:', userId);
        
        const { data: accounts } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
          Query.equal('user_id', [userId]),
          Query.limit(500),
        ]);
        
        console.log('[finance index] Loaded accounts:', accounts.length, accounts.map(a => ({ 
          id: (a as { $id?: string }).$id, 
          name: a.name, 
          type: a.type, 
          opening_balance: a.opening_balance 
        })));
        
        // Get all transactions for balance calculation
        const { data: allTx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.limit(5000),
        ]);
        
        console.log('[finance index] Loaded transactions:', allTx.length);
        
        const txForBalance = allTx as { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean }[];
        
        // Calculate total balance using the same logic as accounts.tsx
        let balance = 0;
        accounts.forEach((a) => {
          const accountId = (a as { $id?: string }).$id ?? (a as { id?: string }).id ?? '';
          const openingBalance = Number(a.opening_balance ?? 0);
          const accountType = a.type as string;
          const isDebt = isDebtAccount(accountType);
          const accountBalance = calculateAccountBalance(accountId, txForBalance, openingBalance, isDebt);
          console.log('[finance index] Account balance:', { accountId, name: a.name, openingBalance, accountType, isDebt, accountBalance });
          balance += isDebt ? -Math.abs(accountBalance) : accountBalance;
        });
        
        console.log('[finance index] totalBalance calculated:', balance, 'accounts count:', accounts.length);
        setTotalBalance(balance);
      
        // Calculate month start/end for income/expense
        const monthStart = startOfMonth(selectedMonth).toISOString();
        const monthEnd = endOfMonth(selectedMonth).toISOString();
        
        const { data: tx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.greaterThanEqual('occurred_at', monthStart),
          Query.lessThanEqual('occurred_at', monthEnd),
          Query.limit(1000),
        ]);
        const realTx = tx.filter((t) => !t.is_recurring);
        let income = 0;
        let expense = 0;
        realTx.forEach((t) => {
          const amt = Number(t.amount ?? 0);
          if (t.kind === 'INCOME') income += amt;
          else if (t.kind === 'EXPENSE') expense += amt;
        });
        const { data: recurringTemplates } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.equal('is_recurring', [true]),
          Query.limit(200),
        ]);
        recurringTemplates.forEach((t) => {
          const interval = (t.recurrence_interval_months as number) ?? 1;
          const monthlyAmt = Math.round((Number(t.amount) / interval) * 100) / 100;
          if (t.kind === 'INCOME') income += monthlyAmt;
          else if (t.kind === 'EXPENSE') expense += monthlyAmt;
        });
        setMonthIncome(income);
        setMonthExpense(expense);
      } catch (e) {
        console.error('[finance index] Error loading data:', e);
      }
    };
    
    loadData();
    
    // Seed default categories/accounts only the first time (profile.defaults_seeded_at or AsyncStorage).
    // If Cloud Functions are not deployed (404) or fail, fallback to client-side seed.
    // We use AsyncStorage to remember "already seeded" so we never PATCH profiles (avoids 400 when attribute doesn't exist).
    if (profile?.org_id) {
      (async () => {
        if (profile.defaults_seeded_at || (await hasDefaultsSeededForUser(userId))) return;
        let ok = false;
        try {
          await Promise.all([
            execFunction('seed_default_categories', { p_org_id: profile.org_id, p_user_id: userId }, false),
            execFunction('seed_default_accounts', { p_org_id: profile.org_id, p_user_id: userId }, false),
          ]);
          ok = true;
        } catch (e) {
          console.log('[finance index] seed functions error:', e);
          try {
            await seedDefaultsLocally(profile.org_id, userId);
            ok = true;
          } catch (localErr) {
            console.log('[finance index] seedDefaultsLocally error:', localErr);
          }
        }
        if (ok && userId) {
          await setDefaultsSeededForUser(userId);
          await refresh();
        }
      })();
    }
  }, [userId, profile?.org_id, profile?.defaults_seeded_at, profile?.id, refresh, selectedMonth]);

  const monthStartIso = startOfMonth(selectedMonth).toISOString();
  const monthEndIso = endOfMonth(selectedMonth).toISOString();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: acc } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
        Query.equal('user_id', [userId]),
        Query.limit(200),
      ]);
      setAccountsRef(acc.map((d) => ({ id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '', name: (d.name as string) ?? '' })));
      const { data: cat } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
        Query.equal('user_id', [userId]),
        Query.limit(500),
      ]);
      setCategoriesRef(cat.map((d) => ({ id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '', name: (d.name as string) ?? '' })));
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: savingsAccounts } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
        Query.equal('user_id', [userId]),
        Query.equal('type', ['SAVINGS']),
        Query.limit(100),
      ]);
      if (!savingsAccounts.length) {
        setSavingsGoalsWithProgress([]);
        return;
      }
      const accountIds = savingsAccounts.map((a) => (a as { $id?: string }).$id ?? (a as { id?: string }).id ?? '');
      const { data: goals } = await listDocuments<AppwriteDocument>(COLLECTIONS.savings_goals, [
        Query.equal('account_id', accountIds),
        Query.limit(100),
      ]);
      if (!goals.length) {
        setSavingsGoalsWithProgress([]);
        return;
      }
      const { data: tx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.limit(5000),
      ]);
      const transactions = tx as { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean }[];
      const list: SavingsGoalWithProgress[] = goals.map((g) => {
        const gId = (g as { $id?: string }).$id ?? (g as { id?: string }).id ?? '';
        const accountId = g.account_id as string;
        const acc = savingsAccounts.find((a) => ((a as { $id?: string }).$id ?? (a as { id?: string }).id) === accountId);
        const openingBalance = acc ? Number(acc.opening_balance ?? 0) : 0;
        const currentBalance = balanceForAccount(accountId, transactions, openingBalance);
        const targetAmount = Number(g.target_amount ?? 0);
        const progressPct = targetAmount > 0 ? Math.min(100, (currentBalance / targetAmount) * 100) : 0;
        return {
          goalId: gId,
          accountId,
          accountName: (acc?.name as string) ?? 'Ahorro',
          goalName: (g.name as string) ?? null,
          targetAmount,
          currentBalance,
          progressPct,
        };
      });
      setSavingsGoalsWithProgress(list);
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: txRows } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.greaterThanEqual('occurred_at', monthStartIso),
          Query.lessThanEqual('occurred_at', monthEndIso),
          Query.orderDesc('occurred_at'),
          Query.limit(200),
        ]);
        const allInMonth = txRows.map((r) => ({
          ...r,
          id: (r as { $id?: string }).$id ?? (r as { id?: string }).id ?? '',
          kind: r.kind as string,
          amount: Number(r.amount ?? 0),
          occurred_at: r.occurred_at as string,
          note: r.note as string | null,
          account_id: r.account_id as string,
          category_id: r.category_id as string | null,
          is_recurring: r.is_recurring as boolean | undefined,
          recurrence_period: r.recurrence_period as string | null,
          recurrence_day_of_month: r.recurrence_day_of_month as number | null,
          recurrence_interval_months: r.recurrence_interval_months as number | null,
          recurrence_total_occurrences: r.recurrence_total_occurrences as number | null,
        })) as (LatestTransaction & { is_recurring?: boolean })[];
        const realRows = allInMonth.filter((r) => !r.is_recurring);
        const { data: recurringTemplates } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.equal('is_recurring', [true]),
          Query.limit(100),
        ]);
        const templates = recurringTemplates.map((t) => ({
          ...t,
          id: (t as { $id?: string }).$id ?? (t as { id?: string }).id ?? '',
          kind: t.kind as string,
          amount: Number(t.amount ?? 0),
          occurred_at: t.occurred_at as string,
          note: t.note as string | null,
          account_id: t.account_id as string,
          category_id: t.category_id as string | null,
          is_recurring: true,
          recurrence_day_of_month: t.recurrence_day_of_month as number | null,
          recurrence_interval_months: t.recurrence_interval_months as number | null,
          recurrence_total_occurrences: t.recurrence_total_occurrences as number | null,
        })) as (LatestTransaction & { recurrence_day_of_month?: number | null; recurrence_interval_months?: number | null; recurrence_total_occurrences?: number | null })[];
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
  }, [userId, monthStartIso, monthEndIso, selectedMonth]);

  useEffect(() => {
    if (!userId) return;
    const monthStart = startOfMonth(selectedMonth).toISOString();
    const monthEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data: catList } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
        Query.equal('user_id', [userId]),
        Query.limit(500),
      ]);
      const categoryMap: Record<string, { name: string; color?: string | null }> = {};
      catList.forEach((c) => {
        const id = (c as { $id?: string }).$id ?? (c as { id?: string }).id ?? '';
        categoryMap[id] = { name: (c.name as string) ?? '', color: (c.color as string | null) ?? null };
      });
      const { data: txRows } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.equal('kind', ['EXPENSE']),
        Query.greaterThanEqual('occurred_at', monthStart),
        Query.lessThanEqual('occurred_at', monthEnd),
        Query.limit(1000),
      ]);
      const realRows = txRows.filter((r) => !r.is_recurring);
      const byCategory: Record<string, { amount: number; color?: string | null }> = {};
      let total = 0;
      realRows.forEach((row) => {
        const cid = (row.category_id as string) ?? '';
        const name = categoryMap[cid]?.name ?? 'Sin categoría';
        const amt = Number(row.amount ?? 0);
        const existing = byCategory[name];
        if (existing) {
          existing.amount += amt;
        } else {
          byCategory[name] = { amount: amt, color: categoryMap[cid]?.color };
        }
        total += amt;
      });
      const { data: recurringExpenses } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.equal('kind', ['EXPENSE']),
        Query.equal('is_recurring', [true]),
        Query.limit(200),
      ]);
      recurringExpenses.forEach((r) => {
        const interval = (r.recurrence_interval_months as number) ?? 1;
        const monthlyAmt = Math.round((Number(r.amount) / interval) * 100) / 100;
        const cid = (r.category_id as string) ?? '';
        const name = categoryMap[cid]?.name ?? 'Sin categoría';
        const existing = byCategory[name];
        if (existing) {
          existing.amount += monthlyAmt;
        } else {
          byCategory[name] = { amount: monthlyAmt, color: categoryMap[cid]?.color };
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
  }, [userId, selectedMonth]);

  // Presupuestos se guardan con mes fijo '0000-01' y aplican al mes seleccionado
  const BUDGET_MONTH_KEY = '0000-01';

  useEffect(() => {
    if (!userId) return;
    const monthStart = startOfMonth(selectedMonth).toISOString();
    const monthEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data: budgetList } = await listDocuments<AppwriteDocument>(COLLECTIONS.budgets, [
        Query.equal('user_id', [userId]),
        Query.equal('month', [BUDGET_MONTH_KEY]),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ]);
      const budget = budgetList[0];
      if (!budget) {
        setBudgetRemaining([]);
        return;
      }
      const budgetId = (budget as { $id?: string }).$id ?? (budget as { id?: string }).id ?? '';
      const { data: items } = await listDocuments<AppwriteDocument>(COLLECTIONS.budget_items, [
        Query.equal('budget_id', [budgetId]),
        Query.limit(100),
      ]);
      if (items.length === 0) {
        setBudgetRemaining([]);
        return;
      }
      const { data: catList } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
        Query.equal('user_id', [userId]),
        Query.limit(500),
      ]);
      const categoryNames: Record<string, string> = {};
      catList.forEach((c) => {
        const id = (c as { $id?: string }).$id ?? (c as { id?: string }).id ?? '';
        categoryNames[id] = (c.name as string) ?? 'Categoría';
      });
      const { data: txData } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.equal('kind', ['EXPENSE']),
        Query.greaterThanEqual('occurred_at', monthStart),
        Query.lessThanEqual('occurred_at', monthEnd),
        Query.limit(1000),
      ]);
      const spentByCategory: Record<string, number> = {};
      txData.forEach((row) => {
        if (row.is_recurring) return;
        const cid = (row.category_id as string) ?? '_sin_categoria';
        const amt = Number(row.amount ?? 0);
        spentByCategory[cid] = (spentByCategory[cid] ?? 0) + amt;
      });
      const { data: recurringExpenses } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.equal('kind', ['EXPENSE']),
        Query.equal('is_recurring', [true]),
        Query.limit(200),
      ]);
      recurringExpenses.forEach((r) => {
        const interval = (r.recurrence_interval_months as number) ?? 1;
        const monthlyAmt = Math.round((Number(r.amount) / interval) * 100) / 100;
        const cid = (r.category_id as string) ?? '_sin_categoria';
        spentByCategory[cid] = (spentByCategory[cid] ?? 0) + monthlyAmt;
      });
      const list: BudgetCategoryRemaining[] = items.map((item) => {
        const categoryId = item.category_id as string;
        const limit = Number(item.limit_amount ?? 0);
        const spent = spentByCategory[categoryId] ?? 0;
        const remaining = Math.max(0, limit - spent);
        const categoryName = categoryNames[categoryId] ?? 'Categoría';
        return {
          categoryName,
          categoryId,
          limit,
          spent,
          remaining,
        };
      });
      setBudgetRemaining(list);
    })();
  }, [userId, selectedMonth]);

  // Estadísticas de ingresos y gastos de los últimos 3 meses (relativo al mes seleccionado)
  useEffect(() => {
    if (!userId) return;
    const rangeStart = startOfMonth(subMonths(selectedMonth, 2)).toISOString();
    const rangeEnd = endOfMonth(selectedMonth).toISOString();
    (async () => {
      const { data: tx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.greaterThanEqual('occurred_at', rangeStart),
        Query.lessThanEqual('occurred_at', rangeEnd),
        Query.limit(2000),
      ]);
      const realRows = tx.filter((r) => !r.is_recurring);
      const byMonth: Record<string, { income: number; expense: number }> = {};
      for (let i = 0; i < 3; i++) {
        const m = subMonths(selectedMonth, 2 - i);
        const key = format(m, 'yyyy-MM');
        byMonth[key] = { income: 0, expense: 0 };
      }
      realRows.forEach((t) => {
        const key = format(new Date(t.occurred_at as string), 'yyyy-MM');
        if (!byMonth[key]) return;
        const amt = Number(t.amount ?? 0);
        if (t.kind === 'INCOME') byMonth[key].income += amt;
        else if (t.kind === 'EXPENSE') byMonth[key].expense += amt;
      });
      const { data: recurringTemplates } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.equal('is_recurring', [true]),
        Query.limit(200),
      ]);
      recurringTemplates.forEach((t) => {
        const interval = (t.recurrence_interval_months as number) ?? 1;
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
  }, [userId, selectedMonth]);

  // Cargar Patrimonio Líquido (total de physical_assets)
  useEffect(() => {
    if (!userId || !profile?.org_id) return;
    (async () => {
      try {
        const { data: assets } = await listDocuments<AppwriteDocument>(COLLECTIONS.physical_assets, [
          Query.equal('user_id', [userId]),
          Query.equal('org_id', [profile.org_id]),
          Query.limit(500),
        ]);
        const total = assets.reduce((sum, asset) => sum + Number(asset.amount ?? 0), 0);
        if (__DEV__) console.log('[finance index] liquidAssetsTotal:', total, 'assets count:', assets.length);
        setLiquidAssetsTotal(total);
      } catch (err) {
        console.error('[finance index] load liquid assets error:', err);
        setLiquidAssetsTotal(0);
      }
    })();
  }, [userId, profile?.org_id]);

  // Cargar Presupuesto Seguro del mes actual
  useEffect(() => {
    if (!userId || !profile?.org_id) return;
    const monthKey = format(selectedMonth, 'yyyy-MM');
    (async () => {
      try {
        const { data: expenses } = await listDocuments<AppwriteDocument>(COLLECTIONS.budget_safe_style_expenses, [
          Query.equal('user_id', [userId]),
          Query.equal('org_id', [profile.org_id]),
          Query.equal('month', [monthKey]),
          Query.equal('budget_type', ['SEGURO']),
          Query.limit(500),
        ]);
        const total = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
        if (__DEV__) console.log('[finance index] safeBudgetTotal:', total, 'month:', monthKey, 'expenses count:', expenses.length);
        setSafeBudgetTotal(total);
      } catch (err) {
        console.error('[finance index] load safe budget error:', err);
        setSafeBudgetTotal(0);
      }
    })();
  }, [userId, profile?.org_id, selectedMonth]);

  // Calcular Índice de Tranquilidad Financiera
  useEffect(() => {
    if (liquidAssetsTotal > 0 && safeBudgetTotal > 0) {
      const index = liquidAssetsTotal / safeBudgetTotal;
      const roundedIndex = Math.round(index * 10) / 10;
      if (__DEV__) console.log('[finance index] tranquilityIndex calculated:', roundedIndex, 'from', liquidAssetsTotal, '/', safeBudgetTotal);
      setTranquilityIndex(roundedIndex);
    } else {
      if (__DEV__) console.log('[finance index] tranquilityIndex null - liquidAssetsTotal:', liquidAssetsTotal, 'safeBudgetTotal:', safeBudgetTotal);
      setTranquilityIndex(null);
    }
  }, [liquidAssetsTotal, safeBudgetTotal]);

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
        {pilotRecommendation && pilotCardDismissedDate !== pilotRecommendation.recommendation_date ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={styles.pilotCardWrap}
          >
            <PilotCard
              recommendation={pilotRecommendation}
              compact
              onClose={() => {
                const date = pilotRecommendation.recommendation_date;
                setPilotCardDismissedDate(date);
                if (userId) {
                  AsyncStorage.setItem(`${PILOT_CARD_DISMISSED_KEY}_${userId}`, date);
                }
              }}
            />
          </MotiView>
        ) : null}

        {/* Scheduled Transactions Section */}
        {scheduledTransactions.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 50 }}
            style={styles.scheduledSection}
          >
            <View style={styles.scheduledHeader}>
              <Clock size={18} color="#7c3aed" />
              <Text style={styles.scheduledTitle}>Gastos Programados</Text>
            </View>
            {scheduledTransactions.map((tx, index) => {
              const txDate = new Date(tx.occurred_at);
              const daysUntil = differenceInDays(txDate, new Date());
              const dateLabel = isToday(txDate)
                ? 'Hoy'
                : isTomorrow(txDate)
                ? 'Mañana'
                : `En ${daysUntil} días`;
              const accountName = accountsRef.find((a) => a.id === tx.account_id)?.name ?? '';
              const categoryName = tx.category_id
                ? (categoriesRef.find((c) => c.id === tx.category_id)?.name ?? '')
                : '';
              const isExpense = tx.kind === 'EXPENSE';
              return (
                <MotiView
                  key={tx.id}
                  from={{ opacity: 0, translateX: -8 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 300, delay: 80 + index * 40 }}
                >
                  <TouchableOpacity
                    style={styles.scheduledCard}
                    onPress={() => router.push('/(tabs)/finance/transactions')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.scheduledIconWrap, isExpense ? styles.scheduledIconRed : styles.scheduledIconGreen]}>
                      {isExpense ? (
                        <TrendingDown size={16} color="#dc2626" />
                      ) : (
                        <TrendingUp size={16} color="#16a34a" />
                      )}
                    </View>
                    <View style={styles.scheduledInfo}>
                      <Text style={styles.scheduledKind}>
                        {tx.kind === 'EXPENSE' ? 'Gasto' : tx.kind === 'INCOME' ? 'Ingreso' : 'Transferencia'}
                      </Text>
                      {categoryName ? (
                        <Text style={styles.scheduledMeta} numberOfLines={1}>
                          {categoryName}
                        </Text>
                      ) : null}
                      {accountName ? (
                        <Text style={styles.scheduledMeta} numberOfLines={1}>
                          {accountName}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.scheduledRight}>
                      <Text style={isExpense ? styles.scheduledAmountRed : styles.scheduledAmountGreen}>
                        {isExpense ? '-' : ''}{Number(tx.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                      </Text>
                      <View style={styles.scheduledBadge}>
                        <Calendar size={12} color="#7c3aed" />
                        <Text style={styles.scheduledBadgeText}>{dateLabel}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              );
            })}
          </MotiView>
        )}

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

        <Text style={styles.sectionTitle}>Índice de Tranquilidad Financiera</Text>
        <MotiView
          from={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 310 }}
          style={styles.card}
        >
          {tranquilityIndex !== null && tranquilityIndex > 0 ? (
            <>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <ShieldCheck size={22} color="#2563eb" />
                </View>
                <Text style={styles.label}>Meses de tranquilidad</Text>
              </View>
              <Text style={styles.tranquilityIndexValue}>
                {tranquilityIndex.toFixed(1)} {tranquilityIndex === 1 ? 'mes' : 'meses'}
              </Text>
              <Text style={styles.tranquilityIndexDescription}>
                Puedes vivir {tranquilityIndex === 1 ? 'este mes' : `estos ${tranquilityIndex.toFixed(1)} meses`} si pierdes todas tus fuentes de ingreso y vendes tus bienes registrados en Patrimonio Líquido.
              </Text>
              <View style={styles.tranquilityIndexDetails}>
                <Text style={styles.tranquilityIndexDetailText}>
                  Patrimonio Líquido: {liquidAssetsTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
                <Text style={styles.tranquilityIndexDetailText}>
                  Presupuesto Seguro: {safeBudgetTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.tranquilityIndexEmpty}>
              <ShieldCheck size={32} color="#94a3b8" />
              <Text style={styles.tranquilityIndexEmptyText}>
                Para calcular tu Índice de Tranquilidad Financiera, primero debes llenar tu Patrimonio Líquido y tu Presupuesto Seguro y Estilo.
              </Text>
              {(liquidAssetsTotal > 0 || safeBudgetTotal > 0) && (
                <View style={styles.tranquilityIndexDebug}>
                  <Text style={styles.tranquilityIndexDebugText}>
                    {liquidAssetsTotal > 0 ? `✓ Patrimonio Líquido: ${liquidAssetsTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}` : '✗ Falta Patrimonio Líquido'}
                  </Text>
                  <Text style={styles.tranquilityIndexDebugText}>
                    {safeBudgetTotal > 0 ? `✓ Presupuesto Seguro: ${safeBudgetTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}` : `✗ Falta Presupuesto Seguro (mes: ${format(selectedMonth, 'yyyy-MM')})`}
                  </Text>
                </View>
              )}
              <View style={styles.tranquilityIndexEmptyActions}>
                <TouchableOpacity
                  style={styles.tranquilityIndexEmptyButton}
                  onPress={() => router.push('/(tabs)/finance/net-worth')}
                  activeOpacity={0.7}
                >
                  <LayoutGrid size={18} color="#2563eb" />
                  <Text style={styles.tranquilityIndexEmptyButtonText}>Patrimonio Líquido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tranquilityIndexEmptyButton}
                  onPress={() => router.push('/(tabs)/finance/presupuesto-seguro-estilo')}
                  activeOpacity={0.7}
                >
                  <ShieldCheck size={18} color="#2563eb" />
                  <Text style={styles.tranquilityIndexEmptyButtonText}>Presupuesto Seguro</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  tranquilityIndexValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 8,
    marginBottom: 12,
  },
  tranquilityIndexDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 16,
  },
  tranquilityIndexDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  tranquilityIndexDetailText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  tranquilityIndexEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  tranquilityIndexEmptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 20,
  },
  tranquilityIndexDebug: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  tranquilityIndexDebugText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tranquilityIndexEmptyActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  tranquilityIndexEmptyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  tranquilityIndexEmptyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  // Scheduled Transactions Styles
  scheduledSection: {
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  scheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scheduledTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7c3aed',
  },
  scheduledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  scheduledIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scheduledIconRed: { backgroundColor: '#fee2e2' },
  scheduledIconGreen: { backgroundColor: '#dcfce7' },
  scheduledInfo: { flex: 1 },
  scheduledKind: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  scheduledMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  scheduledRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scheduledAmountRed: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  scheduledAmountGreen: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scheduledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
  },
});
