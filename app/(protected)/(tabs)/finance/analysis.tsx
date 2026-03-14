import { CategoryBreakdownChart } from '@/components/finance/CategoryBreakdownChart';
import { HistoryChart, type HistoryDataPoint } from '@/components/finance/HistoryChart';
import { IncomeExpenseChart } from '@/components/finance/IncomeExpenseChart';
import { useAuth } from '@/contexts/auth-context';
import { COLLECTIONS, listDocuments, Query, type AppwriteDocument } from '@/lib/appwrite';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, CreditCard } from '@tamagui/lucide-icons';
import { eachDayOfInterval, endOfMonth, format, startOfMonth, startOfWeek, startOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Tab = 'FLOW' | 'EXPENSE_CAT' | 'EXPENSE_HIST' | 'INCOME_CAT' | 'INCOME_HIST' | 'CREDIT';

export default function AnalysisScreen() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('FLOW');
    const [range, setRange] = useState<'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            let start: Date;
            let end: Date;

            if (range === 'WEEK') {
                start = startOfWeek(currentDate);
                end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
            } else if (range === 'MONTH') {
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
            } else {
                start = startOfYear(currentDate);
                end = new Date(start.getFullYear(), 11, 31);
            }

            const [{ data: tx }, { data: cats }, { data: accs }] = await Promise.all([
                listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
                    Query.equal('user_id', [profile.id]),
                    Query.greaterThanEqual('occurred_at', start.toISOString()),
                    Query.lessThanEqual('occurred_at', end.toISOString()),
                    Query.limit(2000),
                ]),
                listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
                    Query.equal('user_id', [profile.id]),
                    Query.limit(500)
                ]),
                listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
                    Query.equal('user_id', [profile.id]),
                    Query.equal('type', ['CREDIT_CARD']),
                    Query.limit(100)
                ])
            ]);
            setData(tx || []);
            setCategories(cats || []);
            setAccounts(accs || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [profile?.id, range, currentDate]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const groupedHistory = useMemo(() => {
        let start: Date;
        let end: Date;

        if (range === 'WEEK') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        } else if (range === 'MONTH') {
            start = startOfMonth(currentDate);
            end = endOfMonth(currentDate);
        } else {
            start = startOfYear(currentDate);
            end = new Date(start.getFullYear(), 11, 31);
        }

        const stats: Record<string, { income: number; expense: number }> = {};

        if (range === 'YEAR') {
            for (let i = 0; i < 12; i++) {
                const label = format(new Date(currentDate.getFullYear(), i, 1), 'MMM', { locale: es });
                stats[label] = { income: 0, expense: 0 };
            }
            data.forEach(t => {
                const d = new Date(t.occurred_at || t.created_at);
                const label = format(d, 'MMM', { locale: es });
                if (stats[label]) {
                    if (t.kind === 'INCOME') stats[label].income += Number(t.amount);
                    else if (t.kind === 'EXPENSE') stats[label].expense += Number(t.amount);
                }
            });
        } else {
            const days = eachDayOfInterval({ start, end });
            days.forEach(day => {
                const label = range === 'WEEK' ? format(day, 'eee', { locale: es }) : format(day, 'd');
                stats[label] = { income: 0, expense: 0 };
            });

            data.forEach(t => {
                const d = new Date(t.occurred_at || t.created_at);
                const label = range === 'WEEK' ? format(d, 'eee', { locale: es }) : format(d, 'd');
                if (stats[label]) {
                    if (t.kind === 'INCOME') stats[label].income += Number(t.amount);
                    else if (t.kind === 'EXPENSE') stats[label].expense += Number(t.amount);
                }
            });
        }

        return Object.entries(stats).map(([label, val]) => ({
            label: label.replace('.', ''),
            income: val.income,
            expense: val.expense
        }));
    }, [data, range, currentDate]);

    const renderContent = () => {
        if (loading) return <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />;
        if (data.length === 0) return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No hay datos para este periodo</Text>
            </View>
        );

        switch (activeTab) {
            case 'FLOW': {
                const income = data.filter(t => t.kind === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
                const expense = data.filter(t => t.kind === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
                return <IncomeExpenseChart income={income} expense={expense} />;
            }
            case 'EXPENSE_CAT': {
                const expenses = data.filter(t => t.kind === 'EXPENSE');
                const total = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
                const catMap = new Map(categories.map(c => [c.$id, c]));

                const grouped: Record<string, { amount: number; name: string; color?: string; id: string }> = {};
                expenses.forEach(t => {
                    const cid = t.category_id || 'other';
                    const cat = catMap.get(cid);
                    const name = cat?.name || 'Otro';
                    if (!grouped[cid]) grouped[cid] = { amount: 0, name, color: cat?.color, id: cid };
                    grouped[cid].amount += Number(t.amount);
                });

                const formatted = Object.values(grouped).map(g => ({
                    categoryName: g.name,
                    categoryColor: g.color,
                    amount: g.amount,
                    percentage: total > 0 ? (g.amount / total) * 100 : 0,
                    category_id: g.id
                })).sort((a, b) => b.amount - a.amount);

                return <CategoryBreakdownChart data={formatted} total={total} type="EXPENSE" />;
            }
            case 'EXPENSE_HIST': {
                const histData: HistoryDataPoint[] = groupedHistory.map(g => ({
                    label: g.label,
                    amount: g.expense
                }));
                return <HistoryChart data={histData} color="#dc2626" kind="EXPENSE" />;
            }
            case 'INCOME_CAT': {
                const incomes = data.filter(t => t.kind === 'INCOME');
                const total = incomes.reduce((sum, t) => sum + Number(t.amount), 0);
                const catMap = new Map(categories.map(c => [c.$id, c]));

                const grouped: Record<string, { amount: number; name: string; color?: string; id: string }> = {};
                incomes.forEach(t => {
                    const cid = t.category_id || 'other';
                    const cat = catMap.get(cid);
                    const name = cat?.name || 'Otro';
                    if (!grouped[cid]) grouped[cid] = { amount: 0, name, color: cat?.color, id: cid };
                    grouped[cid].amount += Number(t.amount);
                });

                const formatted = Object.values(grouped).map(g => ({
                    categoryName: g.name,
                    categoryColor: g.color || '#16a34a',
                    amount: g.amount,
                    percentage: total > 0 ? (g.amount / total) * 100 : 0,
                    category_id: g.id
                })).sort((a, b) => b.amount - a.amount);

                return <CategoryBreakdownChart data={formatted} total={total} type="INCOME" />;
            }
            case 'INCOME_HIST': {
                const histData: HistoryDataPoint[] = groupedHistory.map(g => ({
                    label: g.label,
                    amount: g.income
                }));
                return <HistoryChart data={histData} color="#16a34a" kind="INCOME" />;
            }
            case 'CREDIT': {
                if (accounts.length === 0) return (
                    <View style={styles.empty}>
                        <CreditCard size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No hay tarjetas de crédito registradas</Text>
                    </View>
                );

                const totalLimit = accounts.reduce((sum, acc) => sum + Number(acc.credit_limit || 0), 0);
                let totalDebt = 0;
                accounts.forEach(acc => {
                    const accountId = acc.$id;
                    const accTx = data.filter(t => t.account_id === accountId || (t.transfer_account_id === accountId && t.kind === 'TRANSFER'));
                    let net = 0;
                    accTx.forEach(t => {
                        const amt = Number(t.amount);
                        if (t.account_id === accountId) {
                            if (t.kind === 'INCOME') net -= amt;
                            else net += amt;
                        } else if (t.transfer_account_id === accountId && t.kind === 'TRANSFER') {
                            net -= amt;
                        }
                    });
                    totalDebt += (Number(acc.opening_balance || 0) + net);
                });

                const usedPercent = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

                return (
                    <View style={styles.creditSummary}>
                        <View style={styles.creditHeader}>
                            <CreditCard size={32} color="#2563eb" />
                            <Text style={styles.creditTitle}>Resumen de Crédito</Text>
                        </View>
                        <View style={styles.creditGrid}>
                            <View style={styles.creditItem}>
                                <Text style={styles.creditLabel}>Límite Total</Text>
                                <Text style={styles.creditValue}>${totalLimit.toLocaleString('es-MX')}</Text>
                            </View>
                            <View style={styles.creditItem}>
                                <Text style={styles.creditLabel}>Deuda Total</Text>
                                <Text style={[styles.creditValue, { color: '#dc2626' }]}>${totalDebt.toLocaleString('es-MX')}</Text>
                            </View>
                        </View>
                        <View style={styles.utilization}>
                            <View style={styles.utilHeader}>
                                <Text style={styles.utilLabel}>Uso total: {usedPercent.toFixed(1)}%</Text>
                            </View>
                            <View style={styles.barBg}>
                                <View style={[styles.barFill, { width: `${Math.min(usedPercent, 100)}%`, backgroundColor: usedPercent > 60 ? '#dc2626' : '#2563eb' }]} />
                            </View>
                        </View>
                        <Text style={styles.creditNote}>Calculado con transacciones de este periodo y saldo inicial.</Text>
                    </View>
                );
            }
            default:
                return <Text style={styles.placeholder}>Sección en desarrollo: {activeTab}</Text>;
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
                {[
                    { id: 'FLOW', label: 'Flujo' },
                    { id: 'EXPENSE_CAT', label: 'Gasto/Cat' },
                    { id: 'EXPENSE_HIST', label: 'Hist. Gasto' },
                    { id: 'INCOME_CAT', label: 'Ingr/Cat' },
                    { id: 'INCOME_HIST', label: 'Hist. Ingr' },
                    { id: 'CREDIT', label: 'Tarjetas' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTab(tab.id as Tab)}
                        style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                    >
                        <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.controls}>
                <View style={styles.rangeSelector}>
                    {['WEEK', 'MONTH', 'YEAR'].map(r => (
                        <TouchableOpacity
                            key={r}
                            onPress={() => setRange(r as any)}
                            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
                        >
                            <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>
                                {r === 'WEEK' ? 'Sem' : r === 'MONTH' ? 'Mes' : 'Año'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.nav}>
                    <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
                        <ChevronLeft size={20} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={styles.dateLabel}>{format(currentDate, range === 'YEAR' ? 'yyyy' : 'MMMM yyyy', { locale: es })}</Text>
                    <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, -1))}>
                        <ChevronRight size={20} color="#64748b" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {renderContent()}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    tabsContainer: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', maxHeight: 60 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: '#f8fafc' },
    activeTab: { backgroundColor: '#2563eb' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    activeTabText: { color: '#fff' },
    controls: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rangeSelector: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2 },
    rangeBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    rangeBtnActive: { backgroundColor: '#fff', elevation: 1 },
    rangeText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    rangeTextActive: { color: '#1e293b' },
    nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' },
    content: { padding: 20 },
    empty: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#94a3b8', fontSize: 15 },
    placeholder: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontStyle: 'italic' },
    creditSummary: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 20 },
    creditHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    creditTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    creditGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    creditItem: { flex: 1 },
    creditLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 4 },
    creditValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    utilization: { marginBottom: 16 },
    utilHeader: { marginBottom: 8 },
    utilLabel: { fontSize: 14, fontWeight: '600', color: '#445569' },
    barBg: { height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5 },
    creditNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 },
});
