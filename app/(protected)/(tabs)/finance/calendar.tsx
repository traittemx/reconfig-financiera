import { useAuth } from '@/contexts/auth-context';
import { COLLECTIONS, listDocuments, Query, type AppwriteDocument } from '@/lib/appwrite';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Clock, Plus, Repeat } from '@tamagui/lucide-icons';
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, setDate, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Transaction = {
    id: string;
    kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    amount: number;
    occurred_at: string;
    is_scheduled?: boolean;
    is_recurring?: boolean;
    account_id: string;
    transfer_account_id?: string;
    category_id?: string;
    note?: string;
};

type Category = {
    id: string;
    name: string;
    icon?: string;
    color?: string;
};

type Account = {
    id: string;
    name: string;
    type: string;
    opening_balance: number;
    cut_off_day?: number;
    payment_day?: number;
};

export default function CalendarScreen() {
    const router = useRouter();
    const { profile } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [mode, setMode] = useState<'BALANCE' | 'CASH_FLOW'>('BALANCE'); // Default to BALANCE as requested
    const [loading, setLoading] = useState(true);

    const fetchMonthData = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            const ms = startOfMonth(currentDate).toISOString();
            const me = endOfMonth(currentDate).toISOString();

            // Fetch all transactions for balance calculation (limit is a bit high but needed for accurate projection)
            const { data: txData } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
                Query.equal('user_id', [profile.id]),
                Query.limit(5000),
            ]);

            const { data: recurringData } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
                Query.equal('user_id', [profile.id]),
                Query.equal('is_recurring', [true]),
            ]);

            const { data: accData } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
                Query.equal('user_id', [profile.id]),
            ]);

            const { data: catData } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
                Query.equal('user_id', [profile.id]),
            ]);

            setTransactions(txData.map(d => ({
                id: (d as any).$id || d.id,
                kind: d.kind as Transaction['kind'],
                amount: Number(d.amount),
                occurred_at: d.occurred_at as string,
                is_scheduled: d.is_scheduled as boolean,
                account_id: d.account_id as string,
                transfer_account_id: d.transfer_account_id as string | undefined,
                category_id: d.category_id as string | undefined,
                note: d.note as string | undefined,
            })));

            setRecurringTemplates(recurringData);

            setAccounts(accData.map(d => ({
                id: (d as any).$id || d.id,
                name: d.name as string,
                type: d.type as string,
                opening_balance: Number(d.opening_balance),
                cut_off_day: d.cut_off_day as number | undefined,
                payment_day: d.payment_day as number | undefined,
            })));

            setCategories(catData.map(d => ({
                id: (d as any).$id || d.id,
                name: d.name as string,
                icon: d.icon as string | undefined,
                color: d.color as string | undefined,
            })));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [profile?.id, currentDate]);

    useFocusEffect(
        useCallback(() => {
            fetchMonthData();
        }, [fetchMonthData])
    );

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
    });

    const getDayTotal = (day: Date, kind: 'INCOME' | 'EXPENSE') => {
        // Include real and virtual transactions for that specific day
        const realRows = transactions.filter(t => isSameDay(new Date(t.occurred_at), day) && t.kind === kind && !t.is_recurring);
        const realTotal = realRows.reduce((sum, t) => sum + t.amount, 0);

        let virtualTotal = 0;
        recurringTemplates.forEach(t => {
            if (t.kind !== kind) return;
            const period = t.recurrence_period ?? 'MONTHLY';
            const interval = t.recurrence_interval_months ?? 1;
            const templateStart = new Date(t.occurred_at);

            const isDuplicate = (date: Date) => realRows.some(r =>
                r.kind === t.kind &&
                r.account_id === t.account_id &&
                Math.abs(r.amount - Number(t.amount)) < 0.01
            );

            if (period === 'WEEKLY') {
                const dow = t.recurrence_day_of_month ?? 1;
                if (day.getDay() === dow && day >= templateStart && !isDuplicate(day)) {
                    virtualTotal += Number(t.amount);
                }
            } else if (period === 'BIWEEKLY') {
                const mEnd = endOfMonth(day);
                const isBiweeklyDay = day.getDate() === 15 || day.getDate() === mEnd.getDate();
                if (isBiweeklyDay && day >= templateStart && !isDuplicate(day)) {
                    virtualTotal += Number(t.amount);
                }
            } else {
                // MONTHLY
                const rDay = t.recurrence_day_of_month ?? 1;
                const mEnd = endOfMonth(day);
                const safeDay = Math.min(rDay, mEnd.getDate());
                if (day.getDate() === safeDay && day >= templateStart) {
                    const diffMonths = (day.getFullYear() - templateStart.getFullYear()) * 12 + (day.getMonth() - templateStart.getMonth());
                    if (diffMonths >= 0 && diffMonths % interval === 0) {
                        const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
                        if ((t.recurrence_total_occurrences == null || occurrenceIndex <= t.recurrence_total_occurrences) && !isDuplicate(day)) {
                            virtualTotal += Number(t.amount) / interval;
                        }
                    }
                }
            }
        });

        return realTotal + virtualTotal;
    };

    const calculateBalanceAt = (targetDate: Date) => {
        let balance = accounts.reduce((sum, acc) => {
            const isDebt = acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD';
            return sum + (isDebt ? -acc.opening_balance : acc.opening_balance);
        }, 0);

        // Sum real transactions up to targetDate
        const realUpToDate = transactions.filter(t => !t.is_recurring && new Date(t.occurred_at) <= targetDate);
        realUpToDate.forEach(t => {
            const acc = accounts.find(a => a.id === t.account_id);
            const isDebt = acc?.type === 'CREDIT' || acc?.type === 'CREDIT_CARD';
            const amt = t.amount;
            if (t.kind === 'INCOME') {
                if (!isDebt) balance += amt;
                // Income to debt account (payment) reduces debt, but this logic is for LIQUID balance.
                // A payment out of liquid to debt is already handled by the transfer out from liquid.
            } else if (t.kind === 'EXPENSE' || t.kind === 'TRANSFER') {
                if (!isDebt) balance -= amt;
            }

            if (t.kind === 'TRANSFER' && t.transfer_account_id) {
                const destAcc = accounts.find(a => a.id === t.transfer_account_id);
                const destDebt = destAcc?.type === 'CREDIT' || destAcc?.type === 'CREDIT_CARD';
                if (!destDebt) balance += amt;
            }
        });

        // Add virtual recurring instances up to targetDate
        recurringTemplates.forEach(t => {
            const period = t.recurrence_period ?? 'MONTHLY';
            const interval = t.recurrence_interval_months ?? 1;
            const templateStart = new Date(t.occurred_at);

            let d = new Date(templateStart);
            if (period === 'WEEKLY') {
                const dow = t.recurrence_day_of_month ?? 1;
                while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
                while (d <= targetDate) {
                    const isDuplicate = transactions.some(r => !r.is_recurring && isSameDay(new Date(r.occurred_at), d) && r.kind === t.kind && r.account_id === t.account_id && Math.abs(r.amount - Number(t.amount)) < 0.01);
                    if (!isDuplicate) {
                        if (t.kind === 'INCOME') balance += Number(t.amount);
                        else if (t.kind === 'EXPENSE') balance -= Number(t.amount);
                    }
                    d.setDate(d.getDate() + 7);
                }
            } else if (period === 'BIWEEKLY') {
                while (d <= targetDate) {
                    const mEnd = endOfMonth(d);
                    [15, mEnd.getDate()].forEach(mDay => {
                        const curD = new Date(d.getFullYear(), d.getMonth(), mDay);
                        if (curD >= templateStart && curD <= targetDate) {
                            const isDuplicate = transactions.some(r => !r.is_recurring && isSameDay(new Date(r.occurred_at), curD) && r.kind === t.kind && r.account_id === t.account_id && Math.abs(r.amount - Number(t.amount)) < 0.01);
                            if (!isDuplicate) {
                                if (t.kind === 'INCOME') balance += Number(t.amount);
                                else if (t.kind === 'EXPENSE') balance -= Number(t.amount);
                            }
                        }
                    });
                    d = addMonths(startOfMonth(d), 1);
                }
            } else {
                // MONTHLY
                const rDay = t.recurrence_day_of_month ?? 1;
                let monthsOffset = 0;
                let curD = new Date(templateStart.getFullYear(), templateStart.getMonth(), Math.min(rDay, endOfMonth(templateStart).getDate()));
                if (curD < templateStart) {
                    monthsOffset = 1;
                    curD = addMonths(startOfMonth(templateStart), 1);
                    curD.setDate(Math.min(rDay, endOfMonth(curD).getDate()));
                }
                while (curD <= targetDate) {
                    if (monthsOffset % interval === 0) {
                        const occurrenceIndex = Math.floor(monthsOffset / interval) + 1;
                        if (t.recurrence_total_occurrences == null || occurrenceIndex <= t.recurrence_total_occurrences) {
                            const isDuplicate = transactions.some(r => !r.is_recurring && isSameDay(new Date(r.occurred_at), curD) && r.kind === t.kind && r.account_id === t.account_id && Math.abs(r.amount - Number(t.amount)) < 0.01);
                            if (!isDuplicate) {
                                const amt = Number(t.amount) / interval;
                                if (t.kind === 'INCOME') balance += amt;
                                else if (t.kind === 'EXPENSE') balance -= amt;
                            }
                        }
                    }
                    monthsOffset++;
                    curD = addMonths(startOfMonth(templateStart), monthsOffset);
                    curD.setDate(Math.min(rDay, endOfMonth(curD).getDate()));
                }
            }
        });

        // Simulating Credit Card Payments on Payment Days
        accounts.filter(a => a.type === 'CREDIT_CARD' && a.payment_day).forEach(card => {
            const payDay = card.payment_day!;
            const cutOffDayNum = card.cut_off_day || 1;

            // Loop through months in the visible range (and some before) to find payment days
            // For simplicity, we'll check from 3 months before current month until targetDate
            let startD = subMonths(startOfMonth(currentDate), 3);
            while (startD <= targetDate) {
                const mEnd = endOfMonth(startD);
                const actualPayDay = Math.min(payDay, mEnd.getDate());
                const currentPayDate = new Date(startD.getFullYear(), startD.getMonth(), actualPayDay);

                if (currentPayDate <= targetDate) {
                    // Payment amount = debt at previous cut-off
                    let lastCutOff = setDate(currentPayDate, cutOffDayNum);
                    if (payDay < cutOffDayNum) {
                        // If payment is after cut-off in the same month, cut-off was earlier this month
                        lastCutOff = setDate(currentPayDate, cutOffDayNum);
                    } else {
                        // If payment day is before cut-off (rare) or they are far apart
                        // Usually payment is ~20 days after cut-off.
                        // If payDay is 21 and cut-off is 1, cut-off was on day 1 of THIS month.
                        // If payDay is 5 and cut-off is 15, cut-off was on day 15 of PREVIOUS month.
                        if (payDay < cutOffDayNum) {
                            lastCutOff = subMonths(setDate(currentPayDate, cutOffDayNum), 1);
                        } else {
                            lastCutOff = setDate(currentPayDate, cutOffDayNum);
                        }
                    }

                    // Improved logic for CC Statement Balance:
                    // We need the balance exactly at the cut-off date of the PREVIOUS period.
                    // For a payment on Mar 21, the cut-off was likely Mar 1 or Feb 1.
                    // If payDay > cutOffDay, cut-off was same month.
                    // If payDay < cutOffDay, cut-off was prev month.
                    let statementCutOff = setDate(currentPayDate, cutOffDayNum);
                    if (payDay < cutOffDayNum) {
                        statementCutOff = subMonths(statementCutOff, 1);
                    }
                    statementCutOff = startOfDay(statementCutOff);

                    // Calculate debt at that cut-off
                    let billAmount = card.opening_balance;
                    transactions.forEach(t => {
                        if (new Date(t.occurred_at) < statementCutOff) {
                            if (t.account_id === card.id) {
                                if (t.kind === 'INCOME') billAmount -= t.amount;
                                else billAmount += t.amount;
                            } else if (t.transfer_account_id === card.id && t.kind === 'TRANSFER') {
                                billAmount -= t.amount;
                            }
                        }
                    });

                    if (billAmount > 0) {
                        balance -= billAmount; // Cash reduction
                    }
                }
                startD = addMonths(startD, 1);
            }
        });

        return balance;
    };


    const getPaymentItems = (day: Date) => {
        const items: any[] = [];
        accounts.filter(a => a.type === 'CREDIT_CARD' && a.payment_day).forEach(card => {
            const mEnd = endOfMonth(day);
            const actualPayDay = Math.min(card.payment_day!, mEnd.getDate());
            if (day.getDate() === actualPayDay) {
                // Calculate statement balance
                const cutOffDayNum = card.cut_off_day || 1;
                let statementCutOff = setDate(day, cutOffDayNum);
                if (card.payment_day! < cutOffDayNum) {
                    statementCutOff = subMonths(statementCutOff, 1);
                }
                statementCutOff = startOfDay(statementCutOff);

                let billAmount = card.opening_balance;
                transactions.forEach(t => {
                    if (new Date(t.occurred_at) < statementCutOff) {
                        if (t.account_id === card.id) {
                            if (t.kind === 'INCOME') billAmount -= t.amount;
                            else billAmount += t.amount;
                        } else if (t.transfer_account_id === card.id && t.kind === 'TRANSFER') {
                            billAmount -= t.amount;
                        }
                    }
                });

                if (billAmount > 0) {
                    items.push({
                        id: `pay-${card.id}-${day.getTime()}`,
                        kind: 'TRANSFER',
                        amount: billAmount,
                        note: `Pago de tarjeta: ${card.name}`,
                        isVirtual: true,
                        isPayment: true
                    });
                }
            }
        });
        return items;
    };

    const getSelectedDayItems = (day: Date) => {
        const real = transactions.filter(t => isSameDay(new Date(t.occurred_at), day) && !t.is_recurring);
        const virtual: any[] = [];
        recurringTemplates.forEach(t => {
            const rDay = t.recurrence_day_of_month ?? 1;
            const templateStart = new Date(t.occurred_at);
            const mEndDate = endOfMonth(day);
            const maxDay = mEndDate.getDate();
            const safeDay = Math.min(rDay, maxDay);
            const d = new Date(day.getFullYear(), day.getMonth(), safeDay);

            if (isSameDay(d, day) && d >= startOfMonth(templateStart)) {
                const interval = t.recurrence_interval_months ?? 1;
                const diffMonths = (day.getFullYear() - templateStart.getFullYear()) * 12 + (day.getMonth() - templateStart.getMonth());
                if (diffMonths % interval === 0) {
                    const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
                    if (t.recurrence_total_occurrences == null || occurrenceIndex <= t.recurrence_total_occurrences) {
                        virtual.push({
                            ...t,
                            isVirtual: true,
                            amount: Number(t.amount) / interval
                        });
                    }
                }
            }
        });

        // Add credit card payments
        const payments = getPaymentItems(day);

        return [...real, ...virtual, ...payments].sort((a, b) => a.kind.localeCompare(b.kind));
    };

    const calculateCreditDebtAt = (targetDate: Date) => {
        let debt = 0;
        accounts.forEach(acc => {
            if (acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD') {
                let accBal = acc.opening_balance;
                const realUpToDate = transactions.filter(t => !t.is_recurring && new Date(t.occurred_at) <= targetDate);
                realUpToDate.forEach(t => {
                    const amt = t.amount;
                    if (t.account_id === acc.id) {
                        if (t.kind === 'INCOME') accBal -= amt;
                        else accBal += amt;
                    } else if (t.transfer_account_id === acc.id && t.kind === 'TRANSFER') {
                        accBal -= amt;
                    }
                });
                debt += Math.abs(accBal);
            }
        });
        return debt;
    };

    const selectedDayItems = selectedDay ? getSelectedDayItems(selectedDay) : [];
    const balanceAtSelected = selectedDay ? calculateBalanceAt(selectedDay) : calculateBalanceAt(new Date());
    const debtAtSelected = selectedDay ? calculateCreditDebtAt(selectedDay) : calculateCreditDebtAt(new Date());

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.nav}>
                    <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
                        <ChevronLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.monthName}>{format(currentDate, 'MMMM yyyy', { locale: es })}</Text>
                    <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))}>
                        <ChevronRight size={24} color="#1e293b" />
                    </TouchableOpacity>
                </View>

                <View style={styles.modeToggle}>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'CASH_FLOW' && styles.modeBtnActive]}
                        onPress={() => setMode('CASH_FLOW')}
                    >
                        <Text style={[styles.modeText, mode === 'CASH_FLOW' && styles.modeTextActive]}>Flujo de efectivo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'BALANCE' && styles.modeBtnActive]}
                        onPress={() => setMode('BALANCE')}
                    >
                        <Text style={[styles.modeText, mode === 'BALANCE' && styles.modeTextActive]}>Balance</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.calendarScroll} contentContainerStyle={styles.calendarScrollContent}>
                <View style={styles.calendarGrid}>
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                        <Text key={`${d}-${i}`} style={styles.dayOfWeek}>{d}</Text>
                    ))}
                    {Array(startOfMonth(currentDate).getDay()).fill(null).map((_, i) => (
                        <View key={`empty-${i}`} style={styles.dayCell} />
                    ))}
                    {days.map(day => {
                        const income = getDayTotal(day, 'INCOME');
                        const expense = getDayTotal(day, 'EXPENSE');
                        const balance = calculateBalanceAt(day);
                        const isToday = isSameDay(day, new Date());
                        const isSelected = selectedDay && isSameDay(day, selectedDay);

                        // Check if it's a payment day for any card
                        const isPaymentDay = accounts.some(a => a.type === 'CREDIT_CARD' && a.payment_day === day.getDate());

                        return (
                            <TouchableOpacity
                                key={day.toISOString()}
                                style={[
                                    styles.dayCell,
                                    isSelected && styles.selectedCell,
                                    isPaymentDay && !isSelected && styles.paymentDayCell
                                ]}
                                onPress={() => setSelectedDay(day)}
                            >
                                <View style={[styles.dayInner, isToday && styles.todayInner]}>
                                    <Text style={[
                                        styles.dayNumber,
                                        isToday && styles.todayNumber,
                                        isSelected && styles.selectedNumber,
                                        isPaymentDay && styles.paymentDayNumber
                                    ]}>
                                        {format(day, 'd')}
                                    </Text>
                                    {mode === 'BALANCE' ? (
                                        <Text style={[styles.dayBalance, isSelected && styles.selectedBalance]} numberOfLines={1}>
                                            {Math.round(balance).toLocaleString('es-MX')}
                                        </Text>
                                    ) : (
                                        <View style={styles.dotsRow}>
                                            {income > 0 && <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />}
                                            {expense > 0 && <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />}
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.footerSummary}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Balance al</Text>
                        <Text style={styles.summaryValue}>{selectedDay ? format(selectedDay, 'd MMM', { locale: es }) : ''}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Cuentas</Text>
                        <Text style={styles.summaryValue}>{balanceAtSelected.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Tarjetas</Text>
                        <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{debtAtSelected.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
                    </View>
                </View>

                {selectedDayItems.length > 0 && (
                    <View style={styles.itemsList}>
                        <Text style={styles.itemsTitle}>Movimientos del día</Text>
                        {selectedDayItems.map((item, idx) => {
                            const account = accounts.find(a => a.id === item.account_id);
                            const category = categories.find(c => c.id === item.category_id);
                            const transferDest = item.transfer_account_id ? accounts.find(a => a.id === item.transfer_account_id) : null;

                            return (
                                <View key={item.id + idx} style={styles.itemRow}>
                                    <View style={styles.itemInfo}>
                                        <View style={[styles.itemIconWrap, { backgroundColor: item.kind === 'INCOME' ? '#f0fdf4' : item.kind === 'TRANSFER' ? '#eff6ff' : '#fff1f2' }]}>
                                            {item.isVirtual ? (
                                                <Clock size={16} color={item.kind === 'INCOME' ? '#16a34a' : item.kind === 'TRANSFER' ? '#2563eb' : '#e11d48'} />
                                            ) : (
                                                <Repeat size={16} color={item.kind === 'INCOME' ? '#16a34a' : item.kind === 'TRANSFER' ? '#2563eb' : '#e11d48'} />
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.itemHeaderRow}>
                                                <Text style={styles.itemKind}>
                                                    {item.kind === 'INCOME' ? 'Ingreso' : item.kind === 'EXPENSE' ? 'Gasto' : 'Transferencia'}
                                                    {item.isVirtual && <Text style={styles.programmedLabel}> • Programado</Text>}
                                                </Text>
                                                <Text style={[
                                                    styles.itemAmount,
                                                    { color: item.kind === 'INCOME' ? '#16a34a' : item.kind === 'TRANSFER' ? '#2563eb' : '#e11d48' }
                                                ]}>
                                                    {item.kind === 'EXPENSE' ? '–' : ''}
                                                    {item.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                                </Text>
                                            </View>
                                            <View style={styles.itemDetailsRow}>
                                                <Text style={styles.itemAccount} numberOfLines={1}>
                                                    {account?.name || 'Cuenta desconocida'}
                                                    {transferDest ? ` → ${transferDest.name}` : ''}
                                                </Text>
                                                {category && (
                                                    <View style={styles.categoryBadge}>
                                                        <Text style={styles.categoryText}>{category.name}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.itemNote} numberOfLines={2}>
                                                {item.note || (item.kind === 'TRANSFER' ? 'Transferencia entre cuentas' : 'Sin nota')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push({
                    pathname: '/(protected)/(tabs)/finance/transactions',
                    params: { new: '1', date: selectedDay?.toISOString() }
                })}
            >
                <Plus size={32} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    monthName: { fontSize: 18, fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' },
    modeToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
    modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    modeBtnActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    modeText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    modeTextActive: { color: '#1e293b' },
    calendarScroll: { padding: 10 },
    calendarScrollContent: { paddingBottom: 100 },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayOfWeek: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 10 },
    dayCell: { width: '14.28%', height: 75, padding: 2 },
    selectedCell: {
        backgroundColor: '#f0f9ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#0ea5e9'
    },
    dayInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
    todayInner: {
        borderWidth: 1,
        borderColor: '#2563eb',
        borderRadius: 12,
        backgroundColor: '#eff6ff'
    },
    dayNumber: { fontSize: 15, color: '#475569', fontWeight: '500' },
    paymentDayNumber: { color: '#dc2626' },
    paymentDayCell: { borderBottomWidth: 3, borderBottomColor: '#fee2e2' },
    todayNumber: { fontWeight: '800', color: '#2563eb' },
    selectedNumber: { color: '#0369a1', fontWeight: '700' },
    dayBalance: { fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
    selectedBalance: { color: '#0ea5e9' },
    dotsRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    footerSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#f8fafc',
        marginTop: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    summaryItem: { alignItems: 'center', flex: 1 },
    summaryLabel: { fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    fab: {
        position: 'absolute',
        bottom: 30, right: 20,
        backgroundColor: '#0ea5e9',
        width: 60, height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    itemsList: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    itemsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    itemIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    itemHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 8,
    },
    itemAccount: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
        flexShrink: 1,
    },
    categoryBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    categoryText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    itemKind: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    itemNote: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
        fontStyle: 'italic',
    },
    itemAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    programmedLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '400',
    },
});
