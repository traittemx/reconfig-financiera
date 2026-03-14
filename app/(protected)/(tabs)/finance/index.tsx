import { BudgetProgressBar } from '@/components/finance/BudgetProgressBar';
import { CategoryBreakdownChart } from '@/components/finance/CategoryBreakdownChart';

import { HeroCard } from '@/components/finance/HeroCard';
import { useAuth } from '@/contexts/auth-context';
import { useFinanceData } from '@/hooks/useFinanceData';
import { TYPE_CONFIG } from '@/lib/account-types';
import { COLLECTIONS, listDocuments, Query, type AppwriteDocument } from '@/lib/appwrite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  LayoutGrid,
  List,
  PieChart,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TrendingUp
} from '@tamagui/lucide-icons';
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type LatestTransaction = {
  id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  note: string | null;
  account_id: string;
  category_id?: string | null;
  is_recurring?: boolean;
  isRecurringInstance?: boolean;
  is_scheduled?: boolean;
};



const LINK_ITEMS = [
  { label: 'Ver cuentas', href: '/(tabs)/finance/accounts', icon: CreditCard },
  { label: 'Ver transacciones', href: '/(tabs)/finance/transactions', icon: List },
  { label: 'Calendario Financiero', href: '/(tabs)/finance/calendar', icon: Calendar },
  { label: 'Ver categorías', href: '/(tabs)/finance/categories', icon: Tag },
  { label: 'Ver presupuestos', href: '/(tabs)/finance/budgets', icon: PieChart },
  { label: 'Patrimonio Líquido', href: '/(tabs)/finance/net-worth', icon: LayoutGrid },
  { label: 'Inventario', href: '/(tabs)/finance/inventory', icon: ShoppingBag },
  { label: 'Presupuesto Seguro y Estilo', href: '/(tabs)/finance/presupuesto-seguro-estilo', icon: ShieldCheck },
  { label: 'Control de Análisis', href: '/(protected)/(tabs)/finance/analysis', icon: TrendingUp },
] as const;

export default function FinanceOverviewScreen() {
  const router = useRouter();
  const { profile, session, refresh: refreshAuth } = useAuth();
  const userId = session?.user?.id ?? profile?.id;
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));

  const {
    totalBalance,
    monthIncome,
    monthExpense,
    expenseByCategory,
    totalCreditDebt,
    accounts,
    budgets,
    refresh: refreshFinance
  } = useFinanceData(userId, profile?.org_id, selectedMonth);

  const [latestTransactions, setLatestTransactions] = useState<LatestTransaction[]>([]);
  const [scheduledTransactions, setScheduledTransactions] = useState<any[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const STORAGE_KEY = '@finance_show_balance';

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val !== null) setShowBalance(val === 'true');
    });
  }, []);

  const toggleShowBalance = async () => {
    const newVal = !showBalance;
    setShowBalance(newVal);
    await AsyncStorage.setItem(STORAGE_KEY, String(newVal));
  };



  // Fetch latest and scheduled transactions
  useEffect(() => {
    if (!userId) return;
    const loadTransactions = async () => {
      const now = new Date();
      const mStart = startOfMonth(selectedMonth).toISOString();
      const mEnd = endOfMonth(selectedMonth).toISOString();
      const mStartDate = startOfMonth(selectedMonth);
      const mEndDate = endOfMonth(selectedMonth);

      const [{ data: latest }, { data: scheduled }, { data: recurring }] = await Promise.all([
        listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.greaterThanEqual('occurred_at', mStart),
          Query.lessThanEqual('occurred_at', mEnd),
          Query.orderDesc('occurred_at'),
          Query.limit(7)
        ]),
        listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.equal('is_scheduled', [true]),
          Query.greaterThanEqual('occurred_at', mStart),
          Query.lessThanEqual('occurred_at', mEnd),
          Query.orderAsc('occurred_at'),
          Query.limit(10)
        ]),
        listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.equal('is_recurring', [true]),
          Query.limit(100)
        ])
      ]);

      // Generate virtual instances for recurring
      const virtuals: any[] = [];
      for (const t of recurring) {
        const day = t.recurrence_day_of_month ?? 1;
        const templateStart = new Date(t.occurred_at);
        const maxDay = mEndDate.getDate();
        const safeDay = Math.min(day, maxDay);
        const d = new Date(mStartDate.getFullYear(), mStartDate.getMonth(), safeDay);

        if (d < startOfMonth(templateStart)) continue;

        const interval = t.recurrence_interval_months ?? 1;
        const start = startOfMonth(templateStart);
        const diffMonths = (mStartDate.getFullYear() - start.getFullYear()) * 12 + (mStartDate.getMonth() - start.getMonth());

        if (diffMonths % interval !== 0) return;

        const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
        if (t.recurrence_total_occurrences != null && occurrenceIndex > t.recurrence_total_occurrences) continue;

        // Add if not already represented by a real transaction in the list
        // (Actually, scheduled list only contains is_scheduled=true which are single future ones, 
        // recurring ones are virtual until they happen or are converted)
        virtuals.push({
          ...t,
          $id: `virtual-${t.$id}-${d.getTime()}`,
          occurred_at: d.toISOString(),
          amount: Number(t.amount) / interval
        });
      }

      const combinedScheduled = [...scheduled, ...virtuals].sort((a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      ).slice(0, 5);

      setLatestTransactions(latest as any);
      setScheduledTransactions(combinedScheduled);
    };
    loadTransactions();
  }, [userId, selectedMonth]);

  const goToNewTransaction = () => {
    router.push('/(tabs)/finance/transactions?new=1' as any);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.monthNavWrap}>
          <TouchableOpacity onPress={() => setSelectedMonth(m => subMonths(m, 1))}>
            <ChevronLeft size={24} color="#475569" />
          </TouchableOpacity>
          <Text style={styles.monthNavLabel}>{format(selectedMonth, 'MMMM yyyy', { locale: es })}</Text>
          <TouchableOpacity onPress={() => setSelectedMonth(m => addMonths(m, 1))}>
            <ChevronRight size={24} color="#475569" />
          </TouchableOpacity>
        </View>

        <HeroCard
          balance={totalBalance}
          income={monthIncome}
          expense={monthExpense}
          debt={totalCreditDebt}
          showBalance={showBalance}
          onToggleShowBalance={toggleShowBalance}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountsScroll}
          style={styles.accountsWrapper}
        >
          {accounts.map((acc) => {
            const cfg = TYPE_CONFIG[acc.type] ?? TYPE_CONFIG.BANK;
            const Icon = cfg.icon;
            return (
              <TouchableOpacity
                key={acc.$id}
                style={styles.accountCard}
                onPress={() => router.push({ pathname: '/(protected)/(tabs)/finance/transactions', params: { accountId: acc.$id } } as any)}
              >
                <View style={styles.accountCardHeader}>
                  <View style={[styles.accountIcon, { backgroundColor: cfg.bg || '#eef2ff' }]}>
                    <Icon size={16} color={cfg.color || '#6366f1'} />
                  </View>
                  <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
                </View>
                <Text style={styles.accountBalance}>
                  {showBalance
                    ? acc.balance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
                    : '••••••'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>



        {scheduledTransactions.length > 0 && (
          <MotiView style={styles.scheduledSection}>
            <View style={styles.scheduledHeader}>
              <Clock size={18} color="#7c3aed" />
              <Text style={styles.scheduledTitle}>Programados</Text>
            </View>
            {scheduledTransactions.map((tx) => (
              <View key={tx.$id} style={styles.scheduledCard}>
                <View style={styles.scheduledInfo}>
                  <Text style={styles.txKind}>{tx.kind === 'EXPENSE' ? 'Gasto' : 'Ingreso'}</Text>
                  <Text style={styles.txDate}>{format(new Date(tx.occurred_at), 'dd MMM')}</Text>
                </View>
                <Text style={tx.kind === 'EXPENSE' ? styles.txNeg : styles.txPos}>
                  {tx.kind === 'EXPENSE' ? '-' : ''}{Number(tx.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
              </View>
            ))}
          </MotiView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Distribución de Gastos</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/finance/categories' as any)}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <MotiView style={styles.chartCard}>
          <CategoryBreakdownChart data={expenseByCategory} total={monthExpense} type="EXPENSE" />
        </MotiView>

        {expenseByCategory.some(cat => budgets[cat.category_id || '']) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Progreso de Presupuestos</Text>
            </View>
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 300 }}
              style={styles.budgetsSection}
            >
              {expenseByCategory
                .filter(cat => budgets[cat.category_id || ''])
                .map(cat => (
                  <BudgetProgressBar
                    key={cat.category_id}
                    categoryName={cat.categoryName}
                    spent={cat.amount}
                    limit={budgets[cat.category_id!]}
                    color={cat.categoryColor}
                  />
                ))
              }
            </MotiView>
          </>
        )}

        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.links}>
          {LINK_ITEMS.map(({ label, href, icon: Icon }) => (
            <TouchableOpacity key={label} style={styles.link} onPress={() => router.push(href as any)}>
              <View style={styles.linkIcon}>
                <Icon size={20} color="#6366f1" />
              </View>
              <Text style={styles.linkText}>{label}</Text>
              <ChevronRight size={18} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={goToNewTransaction}>
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#ffffff' }, // Neko uses cleaner white background
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  accountsWrapper: { marginHorizontal: -20, marginBottom: 24 },
  accountsScroll: { paddingHorizontal: 20, gap: 12 },
  accountCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24, // Slightly more rounded
    width: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9', // Light border as seen in some cards
  },
  accountCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  accountIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: 13, fontWeight: '600', color: '#64748b', flex: 1 },
  accountBalance: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  monthNavWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthNavLabel: { fontSize: 24, fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' }, // Larger title like "Inicio" or "Feb 2026"
  pilotCardWrap: { marginBottom: 20 },
  scheduledSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  scheduledHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scheduledTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  scheduledCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  scheduledInfo: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  seeAll: { fontSize: 14, color: '#0ea5e9', fontWeight: '600' },
  chartCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  budgetsSection: { marginBottom: 24 },
  txKind: { fontSize: 14, fontWeight: '600', color: '#334155' },
  txDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  txNeg: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  txPos: { fontSize: 14, fontWeight: '700', color: '#22c55e' },
  links: { gap: 12, marginBottom: 20 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 20, // Squared rounded like Neko
    backgroundColor: '#0ea5e9', // Neko's light blue
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
