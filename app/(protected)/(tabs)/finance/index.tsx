import { ExpenseDonutChart } from '@/components/finance/ExpenseDonutChart';
import { BudgetProgressBar } from '@/components/finance/BudgetProgressBar';
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
  TrendingUp,
} from '@tamagui/lucide-icons';
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TEAL = '#0d9488';

const QUICK_ACTIONS = [
  { label: 'Cuentas', href: '/(tabs)/finance/accounts', icon: CreditCard },
  { label: 'Movimientos', href: '/(tabs)/finance/transactions', icon: List },
  { label: 'Calendario', href: '/(tabs)/finance/calendar', icon: Calendar },
  { label: 'Categorías', href: '/(tabs)/finance/categories', icon: Tag },
  { label: 'Presupuestos', href: '/(tabs)/finance/budgets', icon: PieChart },
  { label: 'Patrimonio', href: '/(tabs)/finance/net-worth', icon: LayoutGrid },
] as const;

const MORE_OPTIONS = [
  { label: 'Inventario', href: '/(tabs)/finance/inventory', icon: ShoppingBag },
  { label: 'Presupuesto Seguro y Estilo', href: '/(tabs)/finance/presupuesto-seguro-estilo', icon: ShieldCheck },
  { label: 'Control de Análisis', href: '/(protected)/(tabs)/finance/analysis', icon: TrendingUp },
] as const;

export default function FinanceOverviewScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
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
  } = useFinanceData(userId, profile?.org_id, selectedMonth);

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

  useEffect(() => {
    if (!userId) return;
    const loadTransactions = async () => {
      const mStart = startOfMonth(selectedMonth).toISOString();
      const mEnd = endOfMonth(selectedMonth).toISOString();
      const mStartDate = startOfMonth(selectedMonth);
      const mEndDate = endOfMonth(selectedMonth);

      const [{ data: scheduled }, { data: recurring }] = await Promise.all([
        listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.equal('is_scheduled', [true]),
          Query.greaterThanEqual('occurred_at', mStart),
          Query.lessThanEqual('occurred_at', mEnd),
          Query.orderAsc('occurred_at'),
          Query.limit(10),
        ]),
        listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
          Query.equal('user_id', [userId]),
          Query.equal('is_recurring', [true]),
          Query.limit(100),
        ]),
      ]);

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
        const diffMonths =
          (mStartDate.getFullYear() - start.getFullYear()) * 12 + (mStartDate.getMonth() - start.getMonth());

        if (diffMonths % interval !== 0) continue;

        const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
        if (t.recurrence_total_occurrences != null && occurrenceIndex > t.recurrence_total_occurrences) continue;

        virtuals.push({
          ...t,
          $id: `virtual-${t.$id}-${d.getTime()}`,
          occurred_at: d.toISOString(),
          amount: Number(t.amount) / interval,
        });
      }

      const combinedScheduled = [...scheduled, ...virtuals]
        .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
        .slice(0, 5);

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
          <TouchableOpacity
            style={styles.monthChevron}
            onPress={() => setSelectedMonth(m => subMonths(m, 1))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={26} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.monthNavLabel}>{format(selectedMonth, 'MMMM yyyy', { locale: es })}</Text>
          <TouchableOpacity
            style={styles.monthChevron}
            onPress={() => setSelectedMonth(m => addMonths(m, 1))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronRight size={26} color="#64748b" />
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

        <Text style={styles.sectionHeading}>Cuentas</Text>
        <View style={styles.accountsColumn}>
          {accounts.length === 0 && (
            <View style={styles.emptyAccounts}>
              <Text style={styles.emptyAccountsText}>No hay cuentas todavía. Crea una desde Cuentas.</Text>
            </View>
          )}
          {accounts.map(acc => {
            const cfg = TYPE_CONFIG[acc.type] ?? TYPE_CONFIG.BANK;
            const Icon = cfg.icon;
            return (
              <TouchableOpacity
                key={acc.$id}
                style={styles.accountCardFull}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/(protected)/(tabs)/finance/transactions',
                    params: { accountId: acc.$id },
                  } as any)
                }
              >
                <View style={[styles.accountIconBox, { backgroundColor: 'rgba(13, 148, 136, 0.12)' }]}>
                  <Icon size={22} color={TEAL} />
                </View>
                <View style={styles.accountTextCol}>
                  <Text style={styles.accountNameFull} numberOfLines={1}>
                    {acc.name}
                  </Text>
                  <Text style={styles.accountBalanceFull}>
                    {showBalance
                      ? Number(acc.balance ?? 0).toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN',
                        })
                      : '••••••'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionHeading}>Acciones Rápidas</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <TouchableOpacity
              key={label}
              style={styles.quickCell}
              activeOpacity={0.88}
              onPress={() => router.push(href as any)}
            >
              <View style={styles.quickIconRing}>
                <Icon size={22} color={TEAL} strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeadingInline}>Distribución de Gastos</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/finance/categories' as any)}>
            <Text style={styles.seeAll}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        <MotiView style={styles.chartCard}>
          <ExpenseDonutChart data={expenseByCategory} total={monthExpense} />
        </MotiView>

        {expenseByCategory.some(cat => budgets[cat.category_id || '']) && (
          <>
            <Text style={styles.sectionHeading}>Progreso de Presupuestos</Text>
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 200 }}
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
                    color={cat.categoryColor ?? '#0d9488'}
                  />
                ))}
            </MotiView>
          </>
        )}

        {scheduledTransactions.length > 0 && (
          <MotiView style={styles.scheduledSection}>
            <View style={styles.scheduledHeader}>
              <Clock size={18} color={TEAL} />
              <Text style={styles.scheduledTitle}>Programados</Text>
            </View>
            {scheduledTransactions.map(tx => (
              <View key={tx.$id} style={styles.scheduledCard}>
                <View style={styles.scheduledInfo}>
                  <Text style={styles.txKind}>{tx.kind === 'EXPENSE' ? 'Gasto' : 'Ingreso'}</Text>
                  <Text style={styles.txDate}>{format(new Date(tx.occurred_at), 'dd MMM')}</Text>
                </View>
                <Text style={tx.kind === 'EXPENSE' ? styles.txNeg : styles.txPos}>
                  {tx.kind === 'EXPENSE' ? '-' : ''}
                  {Number(tx.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
              </View>
            ))}
          </MotiView>
        )}

        <Text style={styles.sectionHeading}>Más opciones</Text>
        <View style={styles.moreList}>
          {MORE_OPTIONS.map(({ label, href, icon: Icon }) => (
            <TouchableOpacity
              key={label}
              style={styles.moreRow}
              activeOpacity={0.88}
              onPress={() => router.push(href as any)}
            >
              <View style={styles.moreIconWrap}>
                <Icon size={22} color={TEAL} />
              </View>
              <Text style={styles.moreLabel}>{label}</Text>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={goToNewTransaction} activeOpacity={0.92}>
        <Plus size={30} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 112 },
  monthNavWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  monthChevron: { padding: 4 },
  monthNavLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'capitalize',
    minWidth: 200,
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeadingInline: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  seeAll: { fontSize: 14, color: TEAL, fontWeight: '700' },
  accountsColumn: { gap: 12, marginBottom: 22 },
  accountCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  accountIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextCol: { flex: 1 },
  accountNameFull: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: 4 },
  accountBalanceFull: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
    rowGap: 12,
  },
  quickCell: {
    width: '31%',
    minWidth: '30%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIconRing: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  budgetsSection: { marginBottom: 20 },
  scheduledSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scheduledHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scheduledTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  scheduledCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  scheduledInfo: { flex: 1 },
  txKind: { fontSize: 14, fontWeight: '600', color: '#334155' },
  txDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  txNeg: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  txPos: { fontSize: 14, fontWeight: '700', color: '#22c55e' },
  moreList: { gap: 10, marginBottom: 8 },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  moreIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' },
  emptyAccounts: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyAccountsText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
});
