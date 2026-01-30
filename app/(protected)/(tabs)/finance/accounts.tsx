import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Platform, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import { Button } from 'tamagui';
import {
  Wallet,
  Landmark,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Plus,
  Receipt,
} from '@tamagui/lucide-icons';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { listDocuments, createDocument, updateDocument, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { awardPoints } from '@/lib/points';
import { PointsRewardModal } from '@/components/PointsRewardModal';
import type { SavingsGoal } from '@/types/database';

const ACCOUNT_TYPES = ['CASH', 'BANK', 'CARD', 'CREDIT_CARD', 'SAVINGS', 'INVESTMENT', 'CREDIT'] as const;

const TYPE_CONFIG: Record<string, { icon: typeof Wallet; label: string; color: string; bg: string }> = {
  CASH: { icon: Wallet, label: 'Efectivo', color: '#16a34a', bg: '#dcfce7' },
  BANK: { icon: Landmark, label: 'Banco', color: '#2563eb', bg: '#dbeafe' },
  CARD: { icon: CreditCard, label: 'Tarjeta de débito', color: '#7c3aed', bg: '#ede9fe' },
  CREDIT_CARD: { icon: CreditCard, label: 'Tarjeta de crédito', color: '#dc2626', bg: '#fee2e2' },
  SAVINGS: { icon: PiggyBank, label: 'Ahorros', color: '#0d9488', bg: '#ccfbf1' },
  INVESTMENT: { icon: TrendingUp, label: 'Inversión', color: '#ea580c', bg: '#ffedd5' },
  CREDIT: { icon: Receipt, label: 'Crédito', color: '#dc2626', bg: '#fee2e2' },
};

function isDebtAccount(type: string): boolean {
  return type === 'CREDIT' || type === 'CREDIT_CARD';
}

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  opening_balance: number;
  cut_off_day?: number | null;
  payment_day?: number | null;
  credit_limit?: number | null;
};
type TxForBalance = { kind: string; amount: number; account_id: string; transfer_account_id?: string | null; is_recurring?: boolean };

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

export default function AccountsScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const pointsContext = usePoints();
  const userId = session?.user?.id ?? profile?.id;
  const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txForBalance, setTxForBalance] = useState<TxForBalance[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>('BANK');
  const [openingBalance, setOpeningBalance] = useState('');
  const [cutOffDay, setCutOffDay] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [savingsGoals, setSavingsGoals] = useState<Record<string, SavingsGoal>>({});
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalModalAccountId, setGoalModalAccountId] = useState<string | null>(null);
  const [goalModalTarget, setGoalModalTarget] = useState('');
  const [goalModalName, setGoalModalName] = useState('');
  const [goalModalSaving, setGoalModalSaving] = useState(false);

  const fetchAccountsAndTx = useCallback(async () => {
    if (!userId) {
      setLoadingList(false);
      return;
    }
    setFetchError(null);
    setLoadingList(true);
    let accountsData: AppwriteDocument[] = [];
    try {
      const res = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
        Query.equal('user_id', [userId]),
        Query.orderDesc('$createdAt'),
        Query.limit(200),
      ]);
      accountsData = res.data;
      setAccounts(accountsData.map((a) => ({
        id: (a as { $id?: string }).$id ?? (a as { id?: string }).id ?? '',
        name: (a.name as string) ?? '',
        type: (a.type as string) ?? '',
        currency: (a.currency as string) ?? 'MXN',
        opening_balance: Number(a.opening_balance ?? 0),
      })) as Account[]);
    } catch (accountsError) {
      setLoadingList(false);
      const msg = accountsError instanceof Error ? accountsError.message : 'Error al cargar cuentas';
      setFetchError(msg);
      Alert.alert('Error al cargar cuentas', msg, [{ text: 'Entendido' }]);
      setAccounts([]);
      return;
    }
    try {
      const { data: tx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [userId]),
        Query.limit(5000),
      ]);
      setTxForBalance(tx as TxForBalance[]);
    } catch (txError) {
      setFetchError((e) => (e ? e + '; ' : '') + (txError instanceof Error ? txError.message : ''));
    }
    const savingsIds = accountsData.filter((a) => a.type === 'SAVINGS').map((a) => (a as { $id?: string }).$id ?? (a as { id?: string }).id ?? '');
    if (savingsIds.length > 0) {
      const { data: goals } = await listDocuments<AppwriteDocument>(COLLECTIONS.savings_goals, [
        Query.equal('account_id', savingsIds),
        Query.limit(100),
      ]);
      const byAccount: Record<string, SavingsGoal> = {};
      goals.forEach((g) => {
        const accountId = g.account_id as string;
        byAccount[accountId] = {
          id: (g as { $id?: string }).$id ?? (g as { id?: string }).id ?? '',
          account_id: accountId,
          target_amount: Number(g.target_amount ?? 0),
          name: (g.name as string) ?? null,
          target_date: (g as { target_date?: string }).target_date ?? null,
          created_at: (g as { $createdAt?: string }).$createdAt ?? '',
          updated_at: (g as { $updatedAt?: string }).$updatedAt ?? null,
        };
      });
      setSavingsGoals(byAccount);
    } else {
      setSavingsGoals({});
    }
    setLoadingList(false);
  }, [userId]);

  useEffect(() => {
    fetchAccountsAndTx();
  }, [fetchAccountsAndTx]);

  useFocusEffect(
    useCallback(() => {
      fetchAccountsAndTx();
    }, [fetchAccountsAndTx])
  );

  async function createAccount() {
    if (!name.trim() || !profile?.id || !profile.org_id) return;
    const cutOff = cutOffDay.trim() ? parseInt(cutOffDay, 10) : null;
    const payment = paymentDay.trim() ? parseInt(paymentDay, 10) : null;
    if (type === 'CREDIT_CARD') {
      if (cutOff !== null && (cutOff < 1 || cutOff > 31)) {
        Alert.alert('Error', 'El día de corte debe estar entre 1 y 31');
        return;
      }
      if (payment !== null && (payment < 1 || payment > 31)) {
        Alert.alert('Error', 'El día de pago debe estar entre 1 y 31');
        return;
      }
    }
    setLoading(true);
    const insertPayload: Record<string, unknown> = {
      user_id: profile.id,
      org_id: profile.org_id,
      name: name.trim(),
      type,
      currency: 'MXN',
      opening_balance: parseFloat(openingBalance || '0') || 0,
    };
    if (type === 'CREDIT_CARD') {
      insertPayload.cut_off_day = cutOff ?? null;
      insertPayload.payment_day = payment ?? null;
      const limit = creditLimit.trim() ? parseFloat(creditLimit) : null;
      insertPayload.credit_limit = limit != null && !Number.isNaN(limit) && limit >= 0 ? limit : null;
    }
    const result = await createDocument(COLLECTIONS.accounts, insertPayload as Record<string, unknown>);
    const accountId = (result as { $id?: string }).$id ?? (result as { id?: string }).id ?? '';
    if (!accountId) {
      setLoading(false);
      Alert.alert('Error', 'No se pudo crear la cuenta.');
      return;
    }
    if (type === 'SAVINGS' && accountId && goalTargetAmount.trim()) {
      const target = parseFloat(goalTargetAmount.replace(/,/g, '.'));
      if (!Number.isNaN(target) && target > 0) {
        try {
          await createDocument(COLLECTIONS.savings_goals, {
            account_id: accountId,
            target_amount: target,
            name: goalName.trim() || null,
          } as Record<string, unknown>);
        } catch (goalErr) {
          Alert.alert('Aviso', 'Cuenta creada pero no se pudo guardar la meta: ' + (goalErr instanceof Error ? goalErr.message : ''));
        }
      }
    }
    setLoading(false);
    setShowForm(false);
    await fetchAccountsAndTx();
    const pointsAwarded = await awardPoints(profile.org_id, profile.id, 'CREATE_ACCOUNT', 'accounts', accountId);
    if (pointsAwarded > 0) {
      setRewardToShow({ points: pointsAwarded, message: '¡Cuenta agregada!' });
    }
    setName('');
    setOpeningBalance('');
    setCutOffDay('');
    setPaymentDay('');
    setCreditLimit('');
    setGoalTargetAmount('');
    setGoalName('');
    setShowForm(false);
    await fetchAccountsAndTx();
  }

  function openAddGoal(accountId: string) {
    setGoalModalAccountId(accountId);
    setGoalModalTarget('');
    setGoalModalName('');
  }

  function openEditGoal(accountId: string) {
    const g = savingsGoals[accountId];
    setGoalModalAccountId(accountId);
    setGoalModalTarget(g ? String(g.target_amount) : '');
    setGoalModalName(g?.name ?? '');
  }

  async function saveGoalModal() {
    if (!goalModalAccountId || !profile?.id) return;
    const target = parseFloat(goalModalTarget.replace(/,/g, '.'));
    if (Number.isNaN(target) || target <= 0) {
      Alert.alert('Error', 'El monto objetivo debe ser mayor que 0');
      return;
    }
    setGoalModalSaving(true);
    const existing = savingsGoals[goalModalAccountId];
    if (existing) {
      try {
        await updateDocument(COLLECTIONS.savings_goals, existing.id, {
          target_amount: target,
          name: goalModalName.trim() || null,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        setGoalModalSaving(false);
        Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
        return;
      }
    } else {
      try {
        await createDocument(COLLECTIONS.savings_goals, {
          account_id: goalModalAccountId,
          target_amount: target,
          name: goalModalName.trim() || null,
        } as Record<string, unknown>);
      } catch (err) {
        setGoalModalSaving(false);
        Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
        return;
      }
    }
    setGoalModalSaving(false);
    setGoalModalAccountId(null);
    await fetchAccountsAndTx();
  }

  const totalBalance = accounts.reduce((sum, a) => {
    const isDebt = isDebtAccount(a.type);
    const bal = balanceForAccount(a.id, txForBalance, a.opening_balance, isDebt);
    return sum + (isDebt ? -Math.abs(bal) : bal);
  }, 0);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {showForm && (
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
            style={styles.formCard}
          >
            <View style={styles.formCardHeader}>
              <View>
                <Text style={styles.formTitle}>Nueva cuenta</Text>
                <Text style={styles.formSubtitle}>Elige el tipo, nombre y saldo inicial</Text>
              </View>
              <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancelButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tipo de cuenta</Text>
            <View style={styles.typeGrid}>
              {ACCOUNT_TYPES.map((t) => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                const isActive = type === t;
                return (
                  <MotiView
                    key={t}
                    from={{ scale: 1 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'timing', duration: 150 }}
                  >
                    <TouchableOpacity
                      onPress={() => setType(t)}
                      style={[styles.typeCard, isActive && { backgroundColor: cfg.bg, borderColor: cfg.color, borderWidth: 2 }]}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.typeIconWrap, { backgroundColor: isActive ? cfg.color : cfg.bg }]}>
                        <Icon size={22} color={isActive ? '#fff' : cfg.color} />
                      </View>
                      <Text style={[styles.typeLabel, isActive && { color: cfg.color, fontWeight: '700' }]} numberOfLines={1}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  </MotiView>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Nombre de la cuenta</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Efectivo, Banco X, Tarjeta de débito"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />

            <Text style={styles.fieldLabel}>
              {isDebtAccount(type) ? 'Deuda inicial (MXN)' : 'Saldo inicial (MXN)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={isDebtAccount(type) ? 'Ej. 5000' : '0'}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              editable={!loading}
            />

            {type === 'SAVINGS' && (
              <>
                <Text style={styles.fieldLabel}>Meta de ahorro (monto objetivo, opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 50000"
                  value={goalTargetAmount}
                  onChangeText={setGoalTargetAmount}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
                <Text style={styles.fieldLabel}>Nombre de la meta (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Vacaciones, Fondo emergencia"
                  value={goalName}
                  onChangeText={setGoalName}
                  editable={!loading}
                />
              </>
            )}

            {type === 'CREDIT_CARD' && (
              <>
                <Text style={styles.fieldLabel}>Límite de crédito (MXN)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 50000"
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
                <Text style={styles.fieldLabel}>Día de corte (1-31)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 15"
                  value={cutOffDay}
                  onChangeText={setCutOffDay}
                  keyboardType="number-pad"
                  editable={!loading}
                />
                <Text style={styles.fieldLabel}>Día de pago (1-31)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 20"
                  value={paymentDay}
                  onChangeText={setPaymentDay}
                  keyboardType="number-pad"
                  editable={!loading}
                />
              </>
            )}

            <Button
              onPress={createAccount}
              disabled={loading}
              theme="green"
              size="$4"
              width="100%"
              marginTop={8}
            >
              {loading ? 'Guardando...' : 'Crear cuenta'}
            </Button>
          </MotiView>
        )}

        {fetchError ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>No se pudieron cargar las cuentas.</Text>
            <Button size="$2" theme="blue" onPress={() => fetchAccountsAndTx()} marginTop={8}>
              Reintentar
            </Button>
          </View>
        ) : null}

        {!showForm && !fetchError && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              {loadingList ? '...' : totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </Text>
          </View>
        )}

        {loadingList ? (
          <Text style={styles.loadingText}>Cargando cuentas...</Text>
        ) : (
        <>
        {accounts.map((item, index) => {
          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.BANK;
          const Icon = cfg.icon;
          const isDebt = isDebtAccount(item.type);
          const bal = balanceForAccount(item.id, txForBalance, item.opening_balance, isDebt);
          const balanceText = isDebt
            ? `Deuda: ${Math.abs(bal).toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' })}`
            : bal.toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' });
          const hasCreditCardMeta =
            item.type === 'CREDIT_CARD' &&
            (item.cut_off_day != null || item.payment_day != null || item.credit_limit != null);
          const creditCardMetaParts = hasCreditCardMeta
            ? [
                item.credit_limit != null
                  ? `Límite: ${Number(item.credit_limit).toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' })}`
                  : null,
                item.cut_off_day != null ? `Corte: día ${item.cut_off_day}` : null,
                item.payment_day != null ? `Pago: día ${item.payment_day}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : null;
          const goal = item.type === 'SAVINGS' ? savingsGoals[item.id] : undefined;
          const goalProgress =
            goal && bal >= 0
              ? Math.min(100, (bal / Number(goal.target_amount)) * 100)
              : undefined;
          return (
            <MotiView
              key={item.id}
              from={{ opacity: 0, translateX: -16 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 350, delay: 80 + index * 60 }}
              style={styles.accountCard}
            >
              <View style={[styles.accountIconWrap, { backgroundColor: cfg.bg }]}>
                <Icon size={24} color={cfg.color} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{item.name}</Text>
                {creditCardMetaParts ? (
                  <Text style={styles.accountMeta}>{creditCardMetaParts}</Text>
                ) : null}
                {item.type === 'SAVINGS' && goal && (
                  <Text style={styles.accountMeta}>
                    Meta: {bal.toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' })} /{' '}
                    {Number(goal.target_amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    {' · '}
                    {Math.round(goalProgress ?? 0)}%
                  </Text>
                )}
                <Text style={[styles.accountBalance, isDebt && styles.accountBalanceCredit]}>
                  {balanceText}
                </Text>
                {item.type === 'SAVINGS' && (
                  <TouchableOpacity
                    style={styles.goalButton}
                    onPress={() => (goal ? openEditGoal(item.id) : openAddGoal(item.id))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.goalButtonText}>{goal ? 'Editar meta' : 'Añadir meta'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </MotiView>
          );
        })}

        <MotiView
          from={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 80 + accounts.length * 60 }}
        >
          <TouchableOpacity style={styles.addCard} onPress={() => setShowForm(true)} activeOpacity={0.8}>
            <View style={styles.addCardIconWrap}>
              <Plus size={28} color="#64748b" />
            </View>
            <Text style={styles.addCardText}>Añadir cuenta</Text>
          </TouchableOpacity>
        </MotiView>
        </>
        )}
      </ScrollView>

      <Modal
        visible={goalModalAccountId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalAccountId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGoalModalAccountId(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <Text style={styles.modalTitle}>{savingsGoals[goalModalAccountId ?? ''] ? 'Editar meta' : 'Añadir meta de ahorro'}</Text>
            <Text style={styles.fieldLabel}>Monto objetivo (MXN)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. 50000"
              value={goalModalTarget}
              onChangeText={setGoalModalTarget}
              keyboardType="decimal-pad"
              editable={!goalModalSaving}
            />
            <Text style={styles.fieldLabel}>Nombre de la meta (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Vacaciones"
              value={goalModalName}
              onChangeText={setGoalModalName}
              editable={!goalModalSaving}
            />
            <View style={styles.modalActions}>
              <Button theme="gray" size="$4" onPress={() => setGoalModalAccountId(null)} marginRight={8}>
                Cancelar
              </Button>
              <Button theme="green" size="$4" onPress={saveGoalModal} disabled={goalModalSaving}>
                {goalModalSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <PointsRewardModal
        visible={rewardToShow !== null}
        points={rewardToShow?.points ?? 0}
        message={rewardToShow?.message ?? ''}
        onDismiss={() => {
          setRewardToShow(null);
          pointsContext?.refresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  cancelButton: {
    padding: 6,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  typeCard: {
    flex: 1,
    minWidth: 58,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#f8fafc',
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  errorRow: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { fontSize: 14, color: '#b91c1c', marginBottom: 4 },
  loadingText: { fontSize: 14, color: '#64748b', marginBottom: 16, paddingHorizontal: 4 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  accountIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  accountMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  accountBalance: { fontSize: 15, color: '#64748b', marginTop: 2 },
  accountBalanceCredit: { color: '#dc2626', fontWeight: '600' },
  goalButton: { marginTop: 8, alignSelf: 'flex-start' },
  goalButtonText: { fontSize: 14, fontWeight: '600', color: '#0d9488' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },
  addCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addCardText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
});
