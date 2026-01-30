import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Platform, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { supabase } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { PointsRewardModal } from '@/components/PointsRewardModal';
import { NumericKeypad } from '@/components/finance/NumericKeypad';
import { getDailyRecommendation } from '@/lib/pilot';
import { Button } from 'tamagui';
import { TrendingDown, TrendingUp, ArrowLeftRight, ChevronLeft, ChevronRight, Pencil, Trash2, AlertCircle, X, Calendar } from '@tamagui/lucide-icons';
import { getCategoryIcon, getCategoryColor } from '@/lib/category-icons';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';

type FormStep = 'amount' | 'account' | 'transfer_dest' | 'category' | 'label' | 'notes';

const WIZARD_STEPS: Record<'EXPENSE' | 'INCOME' | 'TRANSFER', FormStep[]> = {
  EXPENSE: ['amount', 'account', 'category', 'label', 'notes'],
  INCOME: ['amount', 'account', 'category', 'notes'],
  TRANSFER: ['amount', 'account', 'transfer_dest', 'notes'],
};

const HEADER_COLORS = {
  EXPENSE: { bg: '#fda4af', text: '#9f1239' },
  INCOME: { bg: '#86efac', text: '#166534' },
  TRANSFER: { bg: '#93c5fd', text: '#1e40af' },
};

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string; icon?: string | null; color?: string | null };
type TransactionRow = {
  id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  note: string | null;
  account_id: string;
  category_id?: string | null;
  transfer_account_id?: string | null;
  is_recurring?: boolean;
  recurrence_period?: string | null;
  recurrence_day_of_month?: number | null;
  recurrence_interval_months?: number | null;
  recurrence_total_occurrences?: number | null;
  expense_label?: string | null;
};
type Transaction = TransactionRow & {
  isRecurringInstance?: boolean;
  virtualDate?: string;
  recurringTemplateId?: string;
  templateAmount?: number;
};

function kindLabel(kind: string): string {
  if (kind === 'INCOME') return 'Ingreso';
  if (kind === 'EXPENSE') return 'Gasto';
  return 'Transferencia';
}

const TX_KINDS = [
  { value: 'EXPENSE' as const, label: 'Gasto', icon: TrendingDown },
  { value: 'INCOME' as const, label: 'Ingreso', icon: TrendingUp },
  { value: 'TRANSFER' as const, label: 'Transferencia', icon: ArrowLeftRight },
];

const EXPENSE_LABELS = [
  { value: 'DESEO' as const, label: 'Deseo' },
  { value: 'LUJO' as const, label: 'Lujo' },
  { value: 'NECESIDAD' as const, label: 'Necesidad' },
];

const RECURRENCE_INTERVAL_OPTIONS = [
  { value: 1, label: 'Mensual' },
  { value: 2, label: 'Bimestral' },
  { value: 3, label: 'Trimestral' },
  { value: 6, label: 'Semestral' },
  { value: 12, label: 'Anual' },
] as const;

function expenseLabelDisplay(value: string | null | undefined): string {
  const opt = EXPENSE_LABELS.find((l) => l.value === value);
  return opt?.label ?? '';
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { new: newParam } = useLocalSearchParams<{ new?: string }>();
  const { profile, session } = useAuth();
  const pointsContext = usePoints();
  const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferAccountId, setTransferAccountId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(newParam === '1');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(1);
  const [recurrenceIntervalMonths, setRecurrenceIntervalMonths] = useState(1);
  const [recurrenceTotalOccurrences, setRecurrenceTotalOccurrences] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expenseLabel, setExpenseLabel] = useState<'' | 'DESEO' | 'LUJO' | 'NECESIDAD'>('');
  const [formStep, setFormStep] = useState<FormStep>('amount');
  const [occurredAt, setOccurredAt] = useState(() => new Date());

  useEffect(() => {
    if (newParam === '1') {
      setShowForm(true);
      setFormStep('amount');
      setOccurredAt(new Date());
    }
  }, [newParam]);

  useEffect(() => {
    if (editingTx) {
      setKind(editingTx.kind as 'INCOME' | 'EXPENSE' | 'TRANSFER');
      const amountToShow = 'templateAmount' in editingTx && editingTx.templateAmount != null ? editingTx.templateAmount : editingTx.amount;
      setAmount(String(amountToShow));
      setAccountId(editingTx.account_id);
      setCategoryId(editingTx.category_id ?? '');
      setTransferAccountId(editingTx.transfer_account_id ?? '');
      setNote(editingTx.note ?? '');
      setExpenseLabel((editingTx.kind === 'EXPENSE' && (editingTx.expense_label === 'DESEO' || editingTx.expense_label === 'LUJO' || editingTx.expense_label === 'NECESIDAD')) ? editingTx.expense_label : '');
      setOccurredAt(new Date(editingTx.occurred_at));
      const isRecurringTx = editingTx.is_recurring || ('recurringTemplateId' in editingTx && editingTx.recurringTemplateId);
      setIsRecurring(!!isRecurringTx);
      setRecurrenceDayOfMonth(editingTx.recurrence_day_of_month ?? 1);
      setRecurrenceIntervalMonths(editingTx.recurrence_interval_months ?? 1);
      setRecurrenceTotalOccurrences(editingTx.recurrence_total_occurrences != null ? String(editingTx.recurrence_total_occurrences) : '');
      setFormStep('amount');
    }
  }, [editingTx]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data: accData } = await supabase.from('accounts').select('id, name').eq('user_id', profile.id);
      setAccounts((accData ?? []) as Account[]);
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name, kind, icon, color')
        .eq('user_id', profile.id)
        .in('kind', ['INCOME', 'EXPENSE']);
      setCategories((catData ?? []) as Category[]);
    })();
  }, [profile?.id]);

  const monthStart = startOfMonth(selectedMonth).toISOString();
  const monthEnd = endOfMonth(selectedMonth).toISOString();

  const fetchTransactions = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const ms = startOfMonth(selectedMonth).toISOString();
      const me = endOfMonth(selectedMonth).toISOString();
      const selectFields = 'id, kind, amount, occurred_at, note, account_id, category_id, transfer_account_id, is_recurring, recurrence_period, recurrence_day_of_month, recurrence_interval_months, recurrence_total_occurrences, expense_label';
      const { data: txRows, error: txErr } = await supabase
        .from('transactions')
        .select(selectFields)
        .eq('user_id', profile.id)
        .gte('occurred_at', ms)
        .lte('occurred_at', me)
        .order('occurred_at', { ascending: false });
      if (txErr) {
        console.error('[transactions] fetch error', txErr);
        setTransactions([]);
        return;
      }
      const allInMonth = (txRows ?? []) as TransactionRow[];
      const realRows = allInMonth.filter((r) => !r.is_recurring);
      const { data: recurringTemplates, error: recErr } = await supabase
        .from('transactions')
        .select(selectFields)
        .eq('user_id', profile.id)
        .eq('is_recurring', true);
      if (recErr) {
        console.error('[transactions] fetch recurring error', recErr);
      }
      const templates = (recurringTemplates ?? []) as TransactionRow[];
      const monthStartDate = startOfMonth(selectedMonth);
      const monthEndDate = endOfMonth(selectedMonth);
      const virtuals: Transaction[] = [];
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
          virtualDate: d.toISOString(),
          recurringTemplateId: t.id,
          templateAmount: Number(t.amount),
        });
      }
      const combined: Transaction[] = [...realRows, ...virtuals];
      combined.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      setTransactions(combined);
    } catch (e) {
      console.error('[transactions] fetchTransactions error', e);
      setTransactions([]);
    }
  }, [profile?.id, selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [fetchTransactions])
  );

  function getValidationMessage(): string | null {
    const needCategory = kind === 'EXPENSE' && categories.filter((c) => c.kind === 'EXPENSE').length > 0;
    const parts: string[] = [];
    if (!amount?.trim()) parts.push('El monto no puede estar vacío.');
    else {
      const n = parseFloat(amount.replace(',', '.'));
      if (Number.isNaN(n) || n <= 0) parts.push('El monto debe ser mayor a 0.');
    }
    if (!accountId) parts.push('Elige una cuenta.');
    if (needCategory && !categoryId) parts.push('Elige una categoría.');
    if (kind === 'EXPENSE' && !expenseLabel) parts.push('Selecciona si es Deseo, Lujo o Necesidad.');
    if (kind === 'TRANSFER' && !transferAccountId) parts.push('Elige la cuenta destino.');
    return parts.length ? parts.join(' ') : null;
  }

  const steps = WIZARD_STEPS[kind];
  const stepIndex = steps.indexOf(formStep);
  const nextStep = stepIndex >= 0 && stepIndex < steps.length - 1 ? steps[stepIndex + 1] : null;
  const prevStep = stepIndex > 0 ? steps[stepIndex - 1] : null;

  function goNext() {
    setValidationError(null);
    if (formStep === 'amount') {
      const n = parseFloat(amount.replace(',', '.'));
      if (!amount?.trim() || Number.isNaN(n) || n <= 0) {
        setValidationError('El monto debe ser mayor a 0.');
        return;
      }
    }
    if (formStep === 'account' && !accountId) {
      setValidationError('Elige una cuenta.');
      return;
    }
    if (formStep === 'transfer_dest' && !transferAccountId) {
      setValidationError('Elige la cuenta destino.');
      return;
    }
    if (formStep === 'category' && kind !== 'TRANSFER') {
      const needCat = kind === 'EXPENSE' && categories.filter((c) => c.kind === 'EXPENSE').length > 0;
      if (needCat && !categoryId) {
        setValidationError('Elige una categoría.');
        return;
      }
    }
    if (formStep === 'label' && !expenseLabel) {
      setValidationError('Selecciona Deseo, Lujo o Necesidad.');
      return;
    }
    if (nextStep) setFormStep(nextStep);
    else if (formStep === 'notes') {
      if (editingTx) updateTransaction();
      else createTransaction();
    }
  }

  function goBack() {
    setValidationError(null);
    if (prevStep) setFormStep(prevStep);
    else closeWizard();
  }

  function closeWizard() {
    setShowForm(false);
    setEditingTx(null);
    setFormStep('amount');
    setValidationError(null);
  }

  function getNextButtonLabel(): string {
    if (!nextStep) return editingTx ? 'Guardar cambios' : 'Guardar';
    // El botón indica el paso al que se va (qué verá el usuario en la siguiente pantalla).
    const labels: Record<FormStep, string> = {
      amount: 'Cuenta',
      account: 'Cuenta',
      transfer_dest: 'Cuenta destino',
      category: 'Categoría',
      label: 'Etiqueta',
      notes: 'Notas',
    };
    return labels[nextStep];
  }

  function getRecurrenceStartDate(): Date {
    const now = new Date();
    const day = recurrenceDayOfMonth;
    const maxDayThisMonth = endOfMonth(now).getDate();
    const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), Math.min(day, maxDayThisMonth));
    if (thisMonthDate >= now) return thisMonthDate;
    const nextMonth = addMonths(now, 1);
    const maxDayNext = endOfMonth(nextMonth).getDate();
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, maxDayNext));
  }

  async function createTransaction() {
    if (!profile?.id || !profile.org_id) {
      Alert.alert('Error', 'No se pudo verificar tu sesión. Vuelve a iniciar sesión si el problema continúa.');
      return;
    }
    const userId = session?.user?.id ?? profile?.id;
    if (!userId) {
      Alert.alert('Error', 'Sesión no disponible. Cierra sesión y vuelve a entrar.');
      return;
    }
    const msg = getValidationMessage();
    if (msg) {
      setValidationError(msg);
      return;
    }
    setValidationError(null);
    setLoading(true);
    try {
      const amountNum = parseFloat(amount.replace(',', '.'));
      const occurredAtIso = isRecurring ? getRecurrenceStartDate().toISOString() : occurredAt.toISOString();
      const payload = {
        org_id: profile.org_id,
        user_id: userId,
        account_id: accountId,
        kind,
        amount: Math.abs(amountNum),
        occurred_at: occurredAtIso,
        category_id: kind === 'TRANSFER' ? null : categoryId || null,
        note: note.trim() || null,
        transfer_account_id: kind === 'TRANSFER' ? transferAccountId : null,
        is_recurring: isRecurring,
        recurrence_period: isRecurring ? 'MONTHLY' : null,
        recurrence_day_of_month: isRecurring ? recurrenceDayOfMonth : null,
        recurrence_interval_months: isRecurring ? recurrenceIntervalMonths : 1,
        recurrence_total_occurrences: isRecurring && recurrenceTotalOccurrences.trim() ? (() => {
          const n = parseInt(recurrenceTotalOccurrences.trim(), 10);
          return Number.isFinite(n) && n >= 1 ? n : null;
        })() : null,
        expense_label: kind === 'EXPENSE' ? expenseLabel : null,
      };
      const { data, error } = await supabase.from('transactions').insert(payload).select('id').single();
      if (error) {
        console.error('[transactions] insert error', error);
        Alert.alert('Error al guardar', error.message);
        return;
      }
      if (!data?.id) {
        console.error('[transactions] insert ok but no id', { data, error });
        Alert.alert('Error al guardar', 'La transacción no se guardó. Revisa permisos o intenta de nuevo.');
        return;
      }
      let earnedPoints = 0;
      let hasDoubleReward = false;
      if (kind === 'EXPENSE') {
        const p1 = await awardPoints(profile.org_id, userId, 'CREATE_EXPENSE', 'transactions', data.id);
        earnedPoints += p1;
        const txDate = new Date(occurredAtIso);
        const dayRec = await getDailyRecommendation(userId, profile.org_id, txDate);
        if (dayRec?.state === 'CONTAINMENT') {
          const p2 = await awardPoints(profile.org_id, userId, 'CRITICAL_DAY_LOGGED', 'pilot_critical_day', format(txDate, 'yyyy-MM-dd'));
          earnedPoints += p2;
          hasDoubleReward = p2 > 0;
        }
      }
      if (kind === 'INCOME') {
        const p = await awardPoints(profile.org_id, userId, 'CREATE_INCOME', 'transactions', data.id);
        earnedPoints += p;
      }
      if (earnedPoints > 0) {
        const message = hasDoubleReward ? '¡Buen trabajo!' : kind === 'EXPENSE' ? '¡Gasto registrado!' : kind === 'INCOME' ? '¡Ingreso registrado!' : '¡Buen trabajo!';
        setRewardToShow({ points: earnedPoints, message });
      }
      setAmount('');
      setCategoryId('');
      setTransferAccountId('');
      setNote('');
      setExpenseLabel('');
      setIsRecurring(false);
      setRecurrenceDayOfMonth(1);
      setRecurrenceIntervalMonths(1);
      setRecurrenceTotalOccurrences('');
      setShowForm(false);
      setEditingTx(null);
      setFormStep('amount');
      await fetchTransactions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado al guardar.';
      console.error('[transactions] createTransaction error', err);
      Alert.alert('Error al guardar', message);
    } finally {
      setLoading(false);
    }
  }

  async function updateTransaction() {
    if (!editingTx || !profile?.id || !profile.org_id) return;
    const msg = getValidationMessage();
    if (msg) {
      setValidationError(msg);
      return;
    }
    setValidationError(null);
    setLoading(true);
    try {
      const amountNum = parseFloat(amount.replace(',', '.'));
      const realId = 'recurringTemplateId' in editingTx && editingTx.recurringTemplateId ? editingTx.recurringTemplateId : editingTx.id;
      const payload: Record<string, unknown> = {
        account_id: accountId,
        kind,
        amount: Math.abs(amountNum),
        occurred_at: new Date(editingTx.occurred_at).toISOString(),
        category_id: kind === 'TRANSFER' ? null : categoryId || null,
        note: note.trim() || null,
        transfer_account_id: kind === 'TRANSFER' ? transferAccountId : null,
        expense_label: kind === 'EXPENSE' ? expenseLabel : null,
      };
      if (editingTx.is_recurring || ('recurringTemplateId' in editingTx && editingTx.recurringTemplateId)) {
        payload.is_recurring = true;
        payload.recurrence_period = 'MONTHLY';
        payload.recurrence_day_of_month = recurrenceDayOfMonth;
        payload.recurrence_interval_months = recurrenceIntervalMonths;
        const totalOcc = recurrenceTotalOccurrences.trim() ? (() => {
          const n = parseInt(recurrenceTotalOccurrences.trim(), 10);
          return Number.isFinite(n) && n >= 1 ? n : null;
        })() : null;
        payload.recurrence_total_occurrences = totalOcc;
      }
      const { error } = await supabase.from('transactions').update(payload).eq('id', realId);
      if (error) {
        console.error('[transactions] update error', error);
        Alert.alert('Error al guardar', error.message);
        return;
      }
      setAmount('');
      setCategoryId('');
      setTransferAccountId('');
      setNote('');
      setExpenseLabel('');
      setShowForm(false);
      setEditingTx(null);
      setFormStep('amount');
      await fetchTransactions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado.';
      console.error('[transactions] updateTransaction error', err);
      Alert.alert('Error al guardar', msg);
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete(item: Transaction) {
    const isVirtual = 'isRecurringInstance' in item && item.isRecurringInstance;
    if (isVirtual) {
      Alert.alert('Eliminar plantilla', 'Las instancias recurrentes no se eliminan una a una. Elimina la plantilla recurrente desde la transacción original.');
      return;
    }
    const amountToShow = 'templateAmount' in item && item.templateAmount != null ? item.templateAmount : item.amount;
    Alert.alert(
      'Eliminar transacción',
      `¿Eliminar esta transacción de ${Number(amountToShow).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteTransaction(item) },
      ]
    );
  }

  async function deleteTransaction(item: Transaction) {
    const isVirtual = 'isRecurringInstance' in item && item.isRecurringInstance;
    if (isVirtual) return;
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', item.id);
      if (error) {
        console.error('[transactions] delete error', error);
        Alert.alert('Error al eliminar', error.message);
        return;
      }
      if (editingTx?.id === item.id) {
        setShowForm(false);
        setEditingTx(null);
        setAmount('');
        setCategoryId('');
        setTransferAccountId('');
        setNote('');
        setExpenseLabel('');
      }
      await fetchTransactions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado.';
      console.error('[transactions] deleteTransaction error', err);
      Alert.alert('Error al eliminar', msg);
    } finally {
      setLoading(false);
    }
  }

  const categoriesForKind = categories.filter((c) => c.kind === kind);
  const showCategoryPicker = kind !== 'TRANSFER';

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Button
            onPress={() => {
              setValidationError(null);
              if (showForm) {
                closeWizard();
              } else {
                setEditingTx(null);
                setAmount('');
                setCategoryId('');
                setTransferAccountId('');
                setNote('');
                setExpenseLabel('');
                setKind('EXPENSE');
                setFormStep('amount');
                setOccurredAt(new Date());
                setIsRecurring(false);
                setRecurrenceDayOfMonth(1);
                setRecurrenceIntervalMonths(1);
                setShowForm(true);
              }
            }}
            theme="blue"
            size="$3"
            width="100%"
            marginBottom={20}
          >
            {showForm ? 'Cancelar' : 'Nueva transacción'}
          </Button>
        </MotiView>

        <Modal
          visible={showForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={goBack}
        >
          <View style={styles.wizardWrap}>
            <View style={[styles.wizardHeader, { backgroundColor: HEADER_COLORS[kind].bg }]}>
              <View style={styles.wizardHeaderRow}>
                <TouchableOpacity onPress={goBack} style={styles.wizardClose} accessibilityLabel="Cerrar">
                  <X size={24} color={HEADER_COLORS[kind].text} />
                </TouchableOpacity>
                <View style={styles.wizardHeaderCenter}>
                  <View style={styles.wizardKindRow}>
                    {TX_KINDS.map(({ value, label }) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => { setValidationError(null); setKind(value); if (value !== 'EXPENSE') setExpenseLabel(''); setFormStep('amount'); }}
                        style={[styles.wizardKindChip, kind === value && styles.wizardKindChipActive]}
                      >
                        <Text style={[styles.wizardKindText, kind === value && styles.wizardKindTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.wizardAmount, { color: HEADER_COLORS[kind].text }]}>
                    {kind === 'EXPENSE' ? '–' : ''}{amount || '0'}
                  </Text>
                  {formStep !== 'amount' && (
                    <Text style={[styles.wizardDate, { color: HEADER_COLORS[kind].text }]}>
                      {format(occurredAt, "EEE, d MMM yyyy h:mm a", { locale: es })}
                    </Text>
                  )}
                </View>
                <View style={styles.wizardClosePlaceholder} />
              </View>
            </View>

            {validationError ? (
              <View style={styles.validationBanner}>
                <AlertCircle size={16} color="#b45309" />
                <Text style={styles.validationBannerText}>{validationError}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.wizardBody} contentContainerStyle={styles.wizardBodyContent} showsVerticalScrollIndicator={false}>
              {formStep === 'amount' && (
                <>
                  <View style={styles.wizardDateRow}>
                    <Calendar size={18} color="#64748b" />
                    <Text style={styles.wizardDateText}>{format(occurredAt, "EEE, d MMM yyyy h:mm a", { locale: es })}</Text>
                  </View>
                  <NumericKeypad value={amount} onChange={(v) => { setValidationError(null); setAmount(v); }} />
                </>
              )}

              {formStep === 'account' && (
                <View style={styles.stepContent}>
                  {accounts.length === 0 ? (
                    <View style={styles.emptyBlock}>
                      <Text style={styles.emptyText}>Crea una cuenta en Cuentas para registrar transacciones.</Text>
                      <Button size="$2" theme="blue" onPress={() => router.push('/(tabs)/finance/accounts')}>
                        Ir a Cuentas
                      </Button>
                    </View>
                  ) : (
                    <View style={styles.picker}>
                      {accounts.map((a) => (
                        <TouchableOpacity
                          key={a.id}
                          onPress={() => { setValidationError(null); setAccountId(a.id); }}
                          style={[styles.pill, accountId === a.id && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, accountId === a.id && styles.pillTextActive]}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {formStep === 'transfer_dest' && (
                <View style={styles.stepContent}>
                  <View style={styles.picker}>
                    {accounts.filter((a) => a.id !== accountId).map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        onPress={() => { setValidationError(null); setTransferAccountId(a.id); }}
                        style={[styles.pill, transferAccountId === a.id && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, transferAccountId === a.id && styles.pillTextActive]}>{a.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {formStep === 'category' && (
                <View style={styles.stepContent}>
                  {categoriesForKind.length === 0 ? (
                    <View style={styles.emptyBlock}>
                      <Text style={styles.emptyText}>
                        {kind === 'EXPENSE' ? 'Sin categorías de gasto.' : 'Sin categorías de ingreso.'} Crea categorías para organizar mejor.
                      </Text>
                      <Button size="$2" theme="blue" onPress={() => router.push('/(tabs)/finance/categories')}>
                        Gestionar categorías
                      </Button>
                    </View>
                  ) : (
                    <View style={styles.picker}>
                      {categoriesForKind.map((c, idx) => {
                        const CatIcon = getCategoryIcon(c.icon, kind);
                        const catColor = getCategoryColor(c.color, idx);
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => { setValidationError(null); setCategoryId(c.id); }}
                            style={[styles.pill, categoryId === c.id && styles.pillActive]}
                          >
                            <View style={{ marginRight: 6 }}>
                              <CatIcon size={16} color={categoryId === c.id ? '#fff' : catColor} />
                            </View>
                            <Text style={[styles.pillText, categoryId === c.id && styles.pillTextActive]}>{c.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {formStep === 'label' && (
                <View style={styles.stepContent}>
                  <View style={styles.picker}>
                    {EXPENSE_LABELS.map(({ value, label }) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => { setValidationError(null); setExpenseLabel(value); }}
                        style={[styles.pill, expenseLabel === value && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, expenseLabel === value && styles.pillTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {formStep === 'notes' && (
                <View style={styles.stepContent}>
                  <Text style={styles.fieldLabel}>Nota (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. detalle del gasto"
                    value={note}
                    onChangeText={setNote}
                    editable={!loading}
                  />
                  {!editingTx && (
                    <>
                      <View style={styles.recurringRow}>
                        <TouchableOpacity
                          onPress={() => setIsRecurring(!isRecurring)}
                          style={styles.recurringToggle}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]} />
                          <Text style={styles.recurringLabel}>Recurrente</Text>
                        </TouchableOpacity>
                      </View>
                      {isRecurring && (
                        <>
                          <View style={styles.daySelectorWrap}>
                            <Text style={styles.fieldLabel}>Cada mes el día</Text>
                            <View style={styles.daySelectorRow}>
                              <TouchableOpacity
                                onPress={() => setRecurrenceDayOfMonth((d) => Math.max(1, d - 1))}
                                style={styles.dayNavButton}
                                disabled={recurrenceDayOfMonth <= 1}
                              >
                                <Text style={styles.dayNavText}>−</Text>
                              </TouchableOpacity>
                              <Text style={styles.dayValue}>{recurrenceDayOfMonth}</Text>
                              <TouchableOpacity
                                onPress={() => setRecurrenceDayOfMonth((d) => Math.min(31, d + 1))}
                                style={styles.dayNavButton}
                                disabled={recurrenceDayOfMonth >= 31}
                              >
                                <Text style={styles.dayNavText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.recurringIntervalWrap}>
                            <Text style={styles.fieldLabel}>Dividir gasto en</Text>
                            <View style={styles.intervalPillsRow}>
                              {RECURRENCE_INTERVAL_OPTIONS.map(({ value, label }) => (
                                <TouchableOpacity
                                  key={value}
                                  onPress={() => setRecurrenceIntervalMonths(value)}
                                  style={[styles.intervalPill, recurrenceIntervalMonths === value && styles.pillActive]}
                                >
                                  <Text style={[styles.pillText, recurrenceIntervalMonths === value && styles.pillTextActive]}>{label}</Text>
                                </TouchableOpacity>
                              ))}
                              <TouchableOpacity
                                onPress={() => setRecurrenceIntervalMonths((n) => (RECURRENCE_INTERVAL_OPTIONS.some((o) => o.value === n) ? 24 : n))}
                                style={[styles.intervalPill, !RECURRENCE_INTERVAL_OPTIONS.some((o) => o.value === recurrenceIntervalMonths) && styles.pillActive]}
                              >
                                <Text style={[styles.pillText, !RECURRENCE_INTERVAL_OPTIONS.some((o) => o.value === recurrenceIntervalMonths) && styles.pillTextActive]}>Otro</Text>
                              </TouchableOpacity>
                            </View>
                            {!RECURRENCE_INTERVAL_OPTIONS.some((o) => o.value === recurrenceIntervalMonths) && (
                              <View style={[styles.daySelectorRow, { marginTop: 8 }]}>
                                <Text style={[styles.fieldLabel, { marginBottom: 0, marginRight: 8 }]}>N meses (MSI, etc.)</Text>
                                <View style={styles.daySelectorRow}>
                                  <TouchableOpacity
                                    onPress={() => setRecurrenceIntervalMonths((n) => Math.max(4, n - 1))}
                                    style={styles.dayNavButton}
                                    disabled={recurrenceIntervalMonths <= 4}
                                  >
                                    <Text style={styles.dayNavText}>−</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.dayValue}>{recurrenceIntervalMonths}</Text>
                                  <TouchableOpacity
                                    onPress={() => setRecurrenceIntervalMonths((n) => Math.min(120, n + 1))}
                                    style={styles.dayNavButton}
                                    disabled={recurrenceIntervalMonths >= 120}
                                  >
                                    <Text style={styles.dayNavText}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                          <View style={styles.recurringRow}>
                            <Text style={styles.fieldLabel}>Número de pagos (opcional)</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Ej. 6 (vacío = sin límite)"
                              value={recurrenceTotalOccurrences}
                              onChangeText={(text) => setRecurrenceTotalOccurrences(text.replace(/[^0-9]/g, ''))}
                              keyboardType="number-pad"
                              editable={!loading}
                            />
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.wizardFooter}>
              <TouchableOpacity
                onPress={goNext}
                disabled={loading}
                style={[styles.wizardNextBtn, loading && styles.wizardNextBtnDisabled]}
              >
                <Text style={styles.wizardNextBtnText}>
                  {loading ? 'Guardando...' : getNextButtonLabel()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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

        <Text style={styles.sectionTitle}>Transacciones</Text>
        {transactions.map((item, index) => {
          const Icon = TX_KINDS.find((k) => k.value === item.kind)?.icon ?? TrendingDown;
          const isVirtual = 'isRecurringInstance' in item && item.isRecurringInstance;
          const accountName = accounts.find((a) => a.id === item.account_id)?.name ?? '';
          const categoryName = item.category_id ? (categories.find((c) => c.id === item.category_id)?.name ?? null) : null;
          const transferName = item.transfer_account_id ? accounts.find((a) => a.id === item.transfer_account_id)?.name : null;
          const isExpense = item.kind === 'EXPENSE';
          const isIncome = item.kind === 'INCOME';
          const isTransfer = item.kind === 'TRANSFER';
          const iconWrapStyle = isExpense ? styles.txIconRed : isIncome ? styles.txIconGreen : styles.txIconBlue;
          const iconColor = isExpense ? '#dc2626' : isIncome ? '#16a34a' : '#2563eb';
          const amountStyle = isExpense ? styles.txNeg : isIncome ? styles.txPos : styles.txTransfer;
          return (
            <MotiView
              key={item.id}
              from={{ opacity: 0, translateX: -12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 320, delay: 100 + index * 45 }}
              style={styles.txCard}
            >
              <View style={[styles.txIconWrap, iconWrapStyle]}>
                <Icon size={20} color={iconColor} />
              </View>
              <View style={styles.txInfo}>
                <View style={styles.txKindRow}>
                  <Text style={styles.txKind}>{kindLabel(item.kind)}</Text>
                  {isVirtual && <View style={styles.recurringBadge}><Text style={styles.recurringBadgeText}>Recurrente</Text></View>}
                </View>
                <Text style={styles.txDate}>{format(new Date(item.occurred_at), 'dd/MM/yyyy')}</Text>
                {accountName ? (
                  <Text numberOfLines={1} style={styles.txMeta}>
                    Cuenta: {isTransfer && transferName ? `${accountName} → ${transferName}` : accountName}
                  </Text>
                ) : null}
                {(categoryName && (isExpense || isIncome)) ? (
                  <Text numberOfLines={1} style={styles.txMeta}>Categoría: {categoryName}</Text>
                ) : null}
                {isExpense && item.expense_label ? (
                  <Text numberOfLines={1} style={styles.txMeta}>Etiqueta: {expenseLabelDisplay(item.expense_label)}</Text>
                ) : null}
                {item.note ? <Text numberOfLines={1} style={styles.txNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.txRight}>
                <Text style={amountStyle}>
                  {isExpense ? '-' : ''}{Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
                {!isVirtual && (
                  <View style={styles.txActions}>
                    <TouchableOpacity
                      onPress={() => { setValidationError(null); setEditingTx(item); setShowForm(true); }}
                      style={styles.txActionBtn}
                      accessibilityLabel="Editar"
                    >
                      <Pencil size={18} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(item)}
                      style={styles.txActionBtn}
                      accessibilityLabel="Eliminar"
                    >
                      <Trash2 size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </MotiView>
          );
        })}
      </ScrollView>

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
  wizardWrap: { flex: 1, backgroundColor: '#fff' },
  wizardHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  wizardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wizardClose: { padding: 8, width: 40 },
  wizardClosePlaceholder: { width: 40 },
  wizardHeaderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wizardKindRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  wizardKindChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  wizardKindChipActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  wizardKindText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  wizardKindTextActive: { color: '#0f172a' },
  wizardAmount: { fontSize: 36, fontWeight: '700', textAlign: 'center' },
  wizardDate: { fontSize: 12, opacity: 0.85, textAlign: 'center', marginTop: 6 },
  wizardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 8 },
  wizardDateText: { fontSize: 14, color: '#64748b' },
  wizardBody: { flex: 1 },
  wizardBodyContent: { padding: 20, paddingBottom: 24 },
  wizardFooter: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  wizardNextBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardNextBtnDisabled: { opacity: 0.6 },
  wizardNextBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  stepContent: { marginBottom: 20 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  validationBannerText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 10 },
  kindRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  kindChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  kindChipActive: { backgroundColor: '#2563eb' },
  kindChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  kindChipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  pillActive: { backgroundColor: '#2563eb' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  pillTextActive: { color: '#fff' },
  emptyBlock: { marginBottom: 18 },
  emptyText: { fontSize: 14, color: '#64748b', marginBottom: 10 },
  recurringRow: { marginBottom: 18 },
  recurringToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recurringLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  daySelectorWrap: { marginBottom: 18 },
  recurringIntervalWrap: { marginBottom: 18 },
  intervalPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  intervalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  daySelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dayNavButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavText: { fontSize: 20, fontWeight: '700', color: '#334155' },
  dayValue: { fontSize: 18, fontWeight: '700', color: '#0f172a', minWidth: 32, textAlign: 'center' },
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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  txCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  txIconRed: { backgroundColor: '#fee2e2' },
  txIconGreen: { backgroundColor: '#dcfce7' },
  txIconBlue: { backgroundColor: '#dbeafe' },
  txInfo: { flex: 1 },
  txRight: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  txActions: { flexDirection: 'row', gap: 6 },
  txActionBtn: { padding: 6 },
  txMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  txKindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  txKind: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  recurringBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  recurringBadgeText: { fontSize: 11, fontWeight: '600', color: '#4338ca' },
  txDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  txNote: { fontSize: 12, color: '#64748b', marginTop: 2 },
  txNeg: { fontWeight: '700', color: '#dc2626', fontSize: 15 },
  txPos: { fontWeight: '700', color: '#16a34a', fontSize: 15 },
  txTransfer: { fontWeight: '700', color: '#2563eb', fontSize: 15 },
});
