import { PointsRewardModal } from '@/components/PointsRewardModal';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { COLLECTIONS, createDocument, listDocuments, Query, updateDocument, type AppwriteDocument } from '@/lib/appwrite';
import { awardPoints } from '@/lib/points';
import { useFocusEffect } from '@react-navigation/native';
import { CreditCard, Pencil } from '@tamagui/lucide-icons';
import { getDate, isBefore, setDate, startOfDay, subMonths } from 'date-fns';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from 'tamagui';

type Account = {
    id: string;
    name: string;
    type: string;
    currency: string;
    opening_balance: number;
    cut_off_day?: number | null;
    payment_day?: number | null;
    credit_limit?: number | null;
    interest_rate?: number | null;
    annual_fee?: number | null;
};

type TxForBalance = { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean };

function showError(title: string, message: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
}

function balanceForAccount(
    accountId: string,
    transactions: TxForBalance[],
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

export default function CreditCardsScreen() {
    const router = useRouter();
    const { profile, session } = useAuth();
    const pointsContext = usePoints();
    const userId = session?.user?.id ?? profile?.id;

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [txForBalance, setTxForBalance] = useState<TxForBalance[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCard, setEditingCard] = useState<Account | null>(null);
    const [loading, setLoading] = useState(false);
    const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [creditLimit, setCreditLimit] = useState('');
    const [cutOffDay, setCutOffDay] = useState('');
    const [paymentDay, setPaymentDay] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [annualFee, setAnnualFee] = useState('');

    const fetchCards = useCallback(async () => {
        if (!userId) {
            setLoadingList(false);
            return;
        }
        setLoadingList(true);
        try {
            const res = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
                Query.equal('user_id', [userId]),
                Query.equal('type', ['CREDIT_CARD']),
                Query.orderDesc('$createdAt'),
            ]);
            setAccounts(res.data.map((a) => ({
                id: (a as { $id?: string }).$id ?? (a as { id?: string }).id ?? '',
                name: (a.name as string) ?? '',
                type: (a.type as string) ?? '',
                currency: (a.currency as string) ?? 'MXN',
                opening_balance: Number(a.opening_balance ?? 0),
                cut_off_day: a.cut_off_day != null ? Number(a.cut_off_day) : null,
                payment_day: a.payment_day != null ? Number(a.payment_day) : null,
                credit_limit: a.credit_limit != null ? Number(a.credit_limit) : null,
                interest_rate: a.interest_rate != null ? Number(a.interest_rate) : null,
                annual_fee: a.annual_fee != null ? Number(a.annual_fee) : null,
            })) as Account[]);

            const { data: tx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
                Query.equal('user_id', [userId]),
                Query.limit(5000),
            ]);
            setTxForBalance(tx as TxForBalance[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingList(false);
        }
    }, [userId]);

    useFocusEffect(
        useCallback(() => {
            fetchCards();
        }, [fetchCards])
    );

    async function handleSave() {
        if (!name.trim() || !creditLimit.trim()) {
            showError('Error', 'Nombre y límite son obligatorios');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                name: name.trim(),
                type: 'CREDIT_CARD',
                currency: 'MXN',
                credit_limit: parseFloat(creditLimit),
                cut_off_day: cutOffDay ? parseInt(cutOffDay) : null,
                payment_day: paymentDay ? parseInt(paymentDay) : null,
                interest_rate: interestRate ? parseFloat(interestRate) : null,
                annual_fee: annualFee ? parseFloat(annualFee) : null,
                user_id: userId,
                org_id: profile?.org_id ?? '',
            };

            if (editingCard) {
                await updateDocument(COLLECTIONS.accounts, editingCard.id, payload);
            } else {
                const result = await createDocument(COLLECTIONS.accounts, payload);
                const cardId = (result as { $id?: string }).$id ?? (result as { id?: string }).id;
                if (profile?.org_id && cardId) {
                    const pts = await awardPoints(profile.org_id, userId!, 'CREATE_ACCOUNT', 'accounts', cardId);
                    if (pts > 0) setRewardToShow({ points: pts, message: '¡Tarjeta registrada!' });
                }
            }
            setShowForm(false);
            setEditingCard(null);
            fetchCards();
        } catch (err) {
            showError('Error', 'No se pudo guardar la tarjeta');
        } finally {
            setLoading(false);
        }
    }

    function openEdit(card: Account) {
        setEditingCard(card);
        setName(card.name);
        setCreditLimit(String(card.credit_limit || ''));
        setCutOffDay(String(card.cut_off_day || ''));
        setPaymentDay(String(card.payment_day || ''));
        setInterestRate(String(card.interest_rate || ''));
        setAnnualFee(String(card.annual_fee || ''));
        setShowForm(true);
    }

    const getStatus = (percent: number) => {
        if (percent <= 30) return { label: 'Bueno', color: '#22c55e' };
        if (percent <= 60) return { label: 'Razonable', color: '#f59e0b' };
        return { label: 'Muy alto', color: '#ef4444' };
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.header}>
                    <Text style={styles.title}>Mis Tarjetas</Text>
                    <TouchableOpacity style={styles.addButton} onPress={() => { setEditingCard(null); setShowForm(true); }}>
                        <Text style={styles.addButtonText}>+ Agregar</Text>
                    </TouchableOpacity>
                </View>

                {loadingList ? (
                    <Text style={styles.loading}>Cargando...</Text>
                ) : accounts.length === 0 ? (
                    <View style={styles.empty}>
                        <CreditCard size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No tienes tarjetas registradas</Text>
                    </View>
                ) : (
                    accounts.map((card) => {
                        const balance = balanceForAccount(card.id, txForBalance, card.opening_balance, true);
                        const used = Math.abs(balance);
                        const limit = card.credit_limit || 1;
                        const percent = (used / limit) * 100;
                        const status = getStatus(percent);

                        // Calculate Period Data
                        const cardTx = txForBalance.filter(t => t.account_id === card.id || (t.transfer_account_id === card.id && t.kind === 'TRANSFER'));

                        // New logic: Split by cut-off date
                        let statementBalance = 0; // Balance at last cut-off
                        let recentSpending = 0;  // Spending since last cut-off

                        const cutOffDayNum = card.cut_off_day || 1;
                        const today = new Date();
                        let lastCutOff = setDate(today, cutOffDayNum);
                        if (getDate(today) < cutOffDayNum) {
                            lastCutOff = subMonths(lastCutOff, 1);
                        }
                        lastCutOff = startOfDay(lastCutOff);

                        cardTx.forEach(t => {
                            // Extract date from transaction (assuming occurred_at exists or can be inferred)
                            // Note: txForBalance in this file doesn't have occurred_at in the type definition, 
                            // but the real data from listDocuments does. I should update the type.
                            const txDate = new Date((t as any).occurred_at || (t as any).$createdAt);
                            const amt = Number(t.amount);

                            let net = 0;
                            if (t.account_id === card.id) {
                                if (t.kind === 'INCOME') net = -amt;
                                else net = amt; // EXPENSE or TRANSFER out
                            } else if (t.transfer_account_id === card.id && t.kind === 'TRANSFER') {
                                net = -amt;
                            }

                            if (isBefore(txDate, lastCutOff)) {
                                statementBalance += net;
                            } else {
                                recentSpending += net;
                            }
                        });

                        // Add opening balance to statement balance (historically before everything)
                        statementBalance += Number(card.opening_balance || 0);

                        return (
                            <MotiView
                                key={card.id}
                                from={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={styles.card}
                            >
                                <View style={styles.cardRow}>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardName}>{card.name}</Text>
                                        <Text style={styles.cardMeta}>Límite: {limit.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <TouchableOpacity onPress={() => openEdit(card)} style={styles.actionBtn}>
                                            <Pencil size={18} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.periodGrids}>
                                    <View style={styles.periodItem}>
                                        <Text style={styles.periodLabel}>Saldo al corte</Text>
                                        <Text style={styles.periodValue}>
                                            {statementBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </Text>
                                    </View>
                                    <View style={styles.periodItem}>
                                        <Text style={styles.periodLabel}>Compras recientes</Text>
                                        <Text style={[styles.periodValue, { color: '#64748b' }]}>
                                            {recentSpending.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.utilization}>
                                    <View style={styles.utilHeader}>
                                        <Text style={styles.utilLabel}>Uso total: {percent.toFixed(1)}%</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                                            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.barBg}>
                                        <View style={[styles.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: status.color }]} />
                                    </View>
                                    <View style={styles.cardFooter}>
                                        {card.payment_day && (
                                            <Text style={styles.paymentDayInfo}>Pagar el día {card.payment_day}</Text>
                                        )}
                                        <Text style={styles.usedText}>
                                            Deuda: {used.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </Text>
                                    </View>
                                </View>
                            </MotiView>
                        );
                    })
                )}
            </ScrollView>

            <Modal visible={showForm} animationType="slide">
                <ScrollView contentContainerStyle={styles.formContainer}>
                    <Text style={styles.formTitle}>{editingCard ? 'Editar Tarjeta' : 'Nueva Tarjeta'}</Text>

                    <Text style={styles.label}>Nombre de la tarjeta</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej. Visa Oro" />

                    <View style={styles.row}>
                        <View style={styles.half}>
                            <Text style={styles.label}>Límite de crédito</Text>
                            <TextInput style={styles.input} value={creditLimit} onChangeText={setCreditLimit} keyboardType="numeric" placeholder="0.00" />
                        </View>
                        <View style={styles.half}>
                            <Text style={styles.label}>Interés anual (%)</Text>
                            <TextInput style={styles.input} value={interestRate} onChangeText={setInterestRate} keyboardType="numeric" placeholder="0.00" />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.half}>
                            <Text style={styles.label}>Día de corte</Text>
                            <TextInput style={styles.input} value={cutOffDay} onChangeText={setCutOffDay} keyboardType="numeric" placeholder="1-31" />
                        </View>
                        <View style={styles.half}>
                            <Text style={styles.label}>Día de pago</Text>
                            <TextInput style={styles.input} value={paymentDay} onChangeText={setPaymentDay} keyboardType="numeric" placeholder="1-31" />
                        </View>
                    </View>

                    <Text style={styles.label}>Anualidad</Text>
                    <TextInput style={styles.input} value={annualFee} onChangeText={setAnnualFee} keyboardType="numeric" placeholder="0.00" />

                    <View style={styles.formActions}>
                        <Button flex={1} theme="gray" marginRight={8} onPress={() => setShowForm(false)}>Cancelar</Button>
                        <Button flex={1} theme="green" disabled={loading} onPress={handleSave}>{loading ? 'Guardando...' : 'Guardar'}</Button>
                    </View>
                </ScrollView>
            </Modal>

            <PointsRewardModal
                visible={rewardToShow !== null}
                points={rewardToShow?.points ?? 0}
                message={rewardToShow?.message ?? ''}
                onDismiss={() => { setRewardToShow(null); pointsContext?.refresh(); }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scroll: { padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    addButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    addButtonText: { color: '#fff', fontWeight: '700' },
    loading: { textAlign: 'center', marginTop: 40, color: '#64748b' },
    empty: { alignItems: 'center', marginTop: 80 },
    emptyText: { marginTop: 16, color: '#94a3b8', fontSize: 16 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    cardMeta: { fontSize: 14, color: '#64748b', marginTop: 4 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { padding: 8 },
    utilization: { marginTop: 8 },
    utilHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    utilLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '700' },
    barBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    usedText: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 8, textAlign: 'right' },
    periodGrids: { flexDirection: 'row', gap: 12, marginBottom: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 16 },
    periodItem: { flex: 1 },
    periodLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 2 },
    periodValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentDayInfo: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 8 },
    formContainer: { padding: 24 },
    formTitle: { fontSize: 20, fontWeight: '800', marginBottom: 24, color: '#1e293b' },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
    input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12, marginBottom: 20, fontSize: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    half: { width: '48%' },
    formActions: { flexDirection: 'row', marginTop: 20 },
});
