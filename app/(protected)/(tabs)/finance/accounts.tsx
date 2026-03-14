import { PointsRewardModal } from '@/components/PointsRewardModal';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { TYPE_CONFIG } from '@/lib/account-types';
import { COLLECTIONS, createDocument, deleteDocument, listDocuments, Query, updateDocument, type AppwriteDocument } from '@/lib/appwrite';
import { awardPoints } from '@/lib/points';
import type { SavingsGoal } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronRight,
  CreditCard,
  Pencil,
  Trash2
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from 'tamagui';

const ACCOUNT_TYPES = ['CASH', 'BANK', 'CARD', 'CREDIT_CARD', 'SAVINGS', 'INVESTMENT', 'CREDIT'] as const;

/** En web Alert.alert no se muestra; usamos window.alert. */
function showError(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

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
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [showBalance, setShowBalance] = useState(true);
  const STORAGE_KEY = '@finance_show_balance';

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
        cut_off_day: a.cut_off_day != null ? Number(a.cut_off_day) : null,
        payment_day: a.payment_day != null ? Number(a.payment_day) : null,
        credit_limit: a.credit_limit != null ? Number(a.credit_limit) : null,
      })) as Account[]);
    } catch (accountsError) {
      setLoadingList(false);
      const msg = accountsError instanceof Error ? accountsError.message : 'Error al cargar cuentas';
      setFetchError(msg);
      showError('Error al cargar cuentas', msg);
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
          updated_at: (g as { $updatedAt?: string }).$updatedAt ?? '',
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
      AsyncStorage.getItem(STORAGE_KEY).then(val => {
        if (val !== null) setShowBalance(val === 'true');
      });
      fetchAccountsAndTx();
    }, [fetchAccountsAndTx])
  );

  async function createAccount() {
    setCreateError(null);
    if (!name.trim()) {
      const msg = 'Escribe el nombre de la cuenta.';
      setCreateError(msg);
      showError('Error', msg);
      return;
    }
    if (!profile?.id) {
      const msg = 'No se pudo identificar tu sesión. Cierra sesión y vuelve a entrar.';
      setCreateError(msg);
      showError('Error', msg);
      return;
    }
    const isSuperAdminWithoutOrg = profile.role === 'SUPER_ADMIN' && !profile.org_id;
    if (!profile.org_id && !isSuperAdminWithoutOrg) {
      const msg =
        'Para crear cuentas debes estar vinculado a una organización. Si te registraste sin código de vinculación, cierra sesión y crea una nueva cuenta usando el código que te dio tu empresa.';
      setCreateError(msg);
      showError('Error', msg);
      return;
    }
    const cutOff = cutOffDay.trim() ? parseInt(cutOffDay, 10) : null;
    const payment = paymentDay.trim() ? parseInt(paymentDay, 10) : null;
    if (type === 'CREDIT_CARD') {
      if (cutOff !== null && (cutOff < 1 || cutOff > 31)) {
        showError('Error', 'El día de corte debe estar entre 1 y 31');
        return;
      }
      if (payment !== null && (payment < 1 || payment > 31)) {
        showError('Error', 'El día de pago debe estar entre 1 y 31');
        return;
      }
    }
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const orgIdForAccount = profile.org_id ?? (profile.role === 'SUPER_ADMIN' ? '' : '');
      const insertPayload: Record<string, unknown> = {
        user_id: profile.id,
        org_id: orgIdForAccount,
        name: name.trim(),
        type,
        currency: 'MXN',
        opening_balance: parseFloat(openingBalance || '0') || 0,
        created_at: now,
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
        setCreateError('No se pudo crear la cuenta.');
        showError('Error', 'No se pudo crear la cuenta.');
        setLoading(false);
        return;
      }
      if (type === 'SAVINGS' && accountId && goalTargetAmount.trim()) {
        const target = parseFloat(goalTargetAmount.replace(/,/g, '.'));
        if (!Number.isNaN(target) && target > 0) {
          try {
            const now = new Date().toISOString();
            await createDocument(COLLECTIONS.savings_goals, {
              account_id: accountId,
              target_amount: target,
              name: goalName.trim() || null,
              created_at: now,
              updated_at: now,
            } as Record<string, unknown>);
          } catch (goalErr) {
            showError('Aviso', 'Cuenta creada pero no se pudo guardar la meta: ' + (goalErr instanceof Error ? goalErr.message : ''));
          }
        }
      }
      setShowForm(false);
      await fetchAccountsAndTx();
      if (profile.org_id) {
        const pointsAwarded = await awardPoints(profile.org_id, profile.id, 'CREATE_ACCOUNT', 'accounts', accountId);
        if (pointsAwarded > 0) {
          setRewardToShow({ points: pointsAwarded, message: '¡Cuenta agregada!' });
        }
      }
      setName('');
      setOpeningBalance('');
      setCutOffDay('');
      setPaymentDay('');
      setCreditLimit('');
      setGoalTargetAmount('');
      setGoalName('');
      await fetchAccountsAndTx();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la cuenta. Revisa permisos en Appwrite (colección accounts).';
      setCreateError(msg);
      showError('Error al crear cuenta', msg);
    } finally {
      setLoading(false);
    }
  }

  function openNewAccountForm() {
    setEditingAccount(null);
    setName('');
    setType('BANK');
    setOpeningBalance('');
    setCutOffDay('');
    setPaymentDay('');
    setCreditLimit('');
    setGoalTargetAmount('');
    setGoalName('');
    setCreateError(null);
    setShowForm(true);
  }

  function openEditAccount(account: Account) {
    setEditingAccount(account);
    setName(account.name);
    setType((account.type as (typeof ACCOUNT_TYPES)[number]) || 'BANK');
    setOpeningBalance(String(account.opening_balance));
    setCutOffDay(account.cut_off_day != null ? String(account.cut_off_day) : '');
    setPaymentDay(account.payment_day != null ? String(account.payment_day) : '');
    setCreditLimit(account.credit_limit != null ? String(account.credit_limit) : '');
    setCreateError(null);
    setShowForm(true);
  }

  function cancelAccountForm() {
    setShowForm(false);
    setEditingAccount(null);
    setName('');
    setType('BANK');
    setOpeningBalance('');
    setCutOffDay('');
    setPaymentDay('');
    setCreditLimit('');
    setGoalTargetAmount('');
    setGoalName('');
    setCreateError(null);
  }

  async function updateAccount() {
    setCreateError(null);
    if (!editingAccount || !name.trim()) {
      const msg = 'Escribe el nombre de la cuenta.';
      setCreateError(msg);
      showError('Error', msg);
      return;
    }
    const cutOff = cutOffDay.trim() ? parseInt(cutOffDay, 10) : null;
    const payment = paymentDay.trim() ? parseInt(paymentDay, 10) : null;
    if (type === 'CREDIT_CARD') {
      if (cutOff !== null && (cutOff < 1 || cutOff > 31)) {
        showError('Error', 'El día de corte debe estar entre 1 y 31');
        return;
      }
      if (payment !== null && (payment < 1 || payment > 31)) {
        showError('Error', 'El día de pago debe estar entre 1 y 31');
        return;
      }
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        type,
        currency: 'MXN',
        opening_balance: parseFloat(openingBalance || '0') || 0,
      };
      if (type === 'CREDIT_CARD') {
        payload.cut_off_day = cutOff ?? null;
        payload.payment_day = payment ?? null;
        const limit = creditLimit.trim() ? parseFloat(creditLimit) : null;
        payload.credit_limit = limit != null && !Number.isNaN(limit) && limit >= 0 ? limit : null;
      } else {
        payload.cut_off_day = null;
        payload.payment_day = null;
        payload.credit_limit = null;
      }
      await updateDocument(COLLECTIONS.accounts, editingAccount.id, payload);
      cancelAccountForm();
      await fetchAccountsAndTx();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la cuenta.';
      setCreateError(msg);
      showError('Error al guardar', msg);
    } finally {
      setLoading(false);
    }
  }

  function confirmDeleteAccount(account: Account) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(
        `¿Eliminar la cuenta "${account.name}"? Las transacciones asociadas quedarán en el historial pero ya no estarán vinculadas a esta cuenta.`
      );
      if (ok) deleteAccount(account);
    } else {
      Alert.alert(
        'Eliminar cuenta',
        `¿Eliminar la cuenta "${account.name}"? Las transacciones asociadas quedarán en el historial pero ya no estarán vinculadas a esta cuenta.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => deleteAccount(account) },
        ]
      );
    }
  }

  async function deleteAccount(account: Account) {
    setLoading(true);
    try {
      await deleteDocument(COLLECTIONS.accounts, account.id);
      if (editingAccount?.id === account.id) cancelAccountForm();
      await fetchAccountsAndTx();
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
    } finally {
      setLoading(false);
    }
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
      showError('Error', 'El monto objetivo debe ser mayor que 0');
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
        showError('Error', err instanceof Error ? err.message : 'Error al guardar');
        return;
      }
    } else {
      try {
        const now = new Date().toISOString();
        await createDocument(COLLECTIONS.savings_goals, {
          account_id: goalModalAccountId,
          target_amount: target,
          name: goalModalName.trim() || null,
          created_at: now,
          updated_at: now,
        } as Record<string, unknown>);
      } catch (err) {
        setGoalModalSaving(false);
        showError('Error', err instanceof Error ? err.message : 'Error al guardar');
        return;
      }
    }
    setGoalModalSaving(false);
    setGoalModalAccountId(null);
    await fetchAccountsAndTx();
  }

  const totalBalance = accounts.reduce((sum, a) => {
    const isDebt = isDebtAccount(a.type);
    if (isDebt) return sum;
    const bal = balanceForAccount(a.id, txForBalance, a.opening_balance, isDebt);
    return sum + bal;
  }, 0);

  const debitAccounts = accounts.filter(a => !isDebtAccount(a.type));
  const creditAccounts = accounts.filter(a => isDebtAccount(a.type));
  const filteredAccounts = activeTab === 'DEBIT' ? debitAccounts : creditAccounts;

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
                <Text style={styles.formTitle}>{editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
                <Text style={styles.formSubtitle}>
                  {editingAccount ? 'Modifica los datos de la cuenta' : 'Elige el tipo, nombre y saldo inicial'}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelAccountForm} style={styles.cancelButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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

            {type === 'SAVINGS' && !editingAccount && (
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

            {createError ? (
              <Text style={styles.createErrorText}>{createError}</Text>
            ) : null}

            <Button
              onPress={editingAccount ? updateAccount : createAccount}
              disabled={loading}
              theme="green"
              size="$4"
              width="100%"
              marginTop={8}
            >
              {loading ? 'Guardando...' : editingAccount ? 'Guardar cambios' : 'Crear cuenta'}
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
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'DEBIT' && styles.activeTab]}
              onPress={() => setActiveTab('DEBIT')}
            >
              <Text style={[styles.tabText, activeTab === 'DEBIT' && styles.activeTabText]}>Cuentas de débito</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'CREDIT' && styles.activeTab]}
              onPress={() => setActiveTab('CREDIT')}
            >
              <Text style={[styles.tabText, activeTab === 'CREDIT' && styles.activeTabText]}>Tarjetas de crédito</Text>
            </TouchableOpacity>
          </View>
        )}

        {!showForm && !fetchError && activeTab === 'CREDIT' && (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(tabs)/finance/credit-cards')}
              style={styles.manageCardsBtn}
            >
              <View style={styles.manageCardsIconWrap}>
                <CreditCard size={20} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.manageCardsBtnText}>Control Total de Tarjetas</Text>
                <Text style={styles.manageCardsBtnSub}>Ver cortes, fechas de pago y anualidades</Text>
              </View>
              <ChevronRight size={20} color="#2563eb" />
            </TouchableOpacity>
          </MotiView>
        )}

        {loadingList ? (
          <Text style={styles.loadingText}>Cargando cuentas...</Text>
        ) : (
          <>
            {filteredAccounts.map((item, index) => {
              const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.BANK;
              const Icon = cfg.icon;
              const isDebt = isDebtAccount(item.type);
              const bal = balanceForAccount(item.id, txForBalance, item.opening_balance, isDebt);

              return (
                <MotiView
                  key={item.id}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 350, delay: index * 50 }}
                  style={styles.accountCard}
                >
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => router.push({ pathname: '/(protected)/(tabs)/finance/transactions', params: { accountId: item.id } } as any)}
                  >
                    <View style={[styles.accountIconWrap, { backgroundColor: cfg.bg }]}>
                      <Icon size={20} color={cfg.color} />
                    </View>
                    <Text style={styles.accountName} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.accountBalanceText, isDebt && styles.accountBalanceCredit]}>
                      {showBalance
                        ? (isDebt ? Math.abs(bal) : bal).toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' })
                        : '••••••'
                      }
                    </Text>
                  </TouchableOpacity>

                  {isDebt && item.credit_limit != null && (
                    <View style={styles.creditInfo}>
                      <View style={styles.creditLabels}>
                        <Text style={styles.creditLabel}>Disponible</Text>
                        <Text style={styles.creditLimitText}>
                          {showBalance
                            ? (Number(item.credit_limit) - Math.abs(bal)).toLocaleString('es-MX', { style: 'currency', currency: item.currency || 'MXN' })
                            : '••••'
                          }
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.max(0, Math.min(100, ((Number(item.credit_limit) - Math.abs(bal)) / Number(item.credit_limit)) * 100))}%`,
                              backgroundColor: '#22c55e'
                            }
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {!isDebt && (
                    <Text style={styles.accountTypeLabel}>{cfg.label}</Text>
                  )}

                  <View style={styles.accountActions}>
                    <TouchableOpacity onPress={() => openEditAccount(item)} style={styles.accountActionBtn}>
                      <Pencil size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDeleteAccount(item)} style={styles.accountActionBtn}>
                      <Trash2 size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </MotiView>
              );
            })}

            <View style={styles.footerContainer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Balance Total</Text>
                <Text style={styles.totalAmount}>
                  {showBalance ? totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '••••••'}
                </Text>
              </View>

              <TouchableOpacity style={styles.addAccountButton} onPress={openNewAccountForm}>
                <Text style={styles.addAccountButtonText}>Agregar Cuenta</Text>
              </TouchableOpacity>
            </View>

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
  wrapper: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 24,
    marginTop: 10,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#0ea5e9',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0ea5e9',
    fontWeight: '700',
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f8fafc',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  accountBalanceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  accountBalanceCredit: {
    color: '#1e293b', // Neko keeps it dark
  },
  accountTypeLabel: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 12,
  },
  creditInfo: {
    marginTop: 16,
  },
  creditLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  creditLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  creditLimitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  accountActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  accountActionBtn: {
    padding: 4,
  },
  footerContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  addAccountButton: {
    backgroundColor: '#f0f9ff',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountButtonText: {
    color: '#0ea5e9',
    fontSize: 15,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
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
  },
  createErrorText: {
    fontSize: 14,
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
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
  manageCardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bae6fd',
    elevation: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  manageCardsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  manageCardsBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0369a1',
  },
  manageCardsBtnSub: {
    fontSize: 12,
    color: '#0ea5e9',
    marginTop: 2,
  },
});
