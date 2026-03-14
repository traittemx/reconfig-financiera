import { PointsRewardModal } from '@/components/PointsRewardModal';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { client, COLLECTIONS, createDocument, deleteDocument, listDocuments, Query, updateDocument, type AppwriteDocument } from '@/lib/appwrite';
import { getCategoryColor, getCategoryIcon } from '@/lib/category-icons';
import { cancelTransactionNotifications, scheduleTransactionNotification } from '@/lib/notifications';

import { awardPoints } from '@/lib/points';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { AlertCircle, ArrowLeftRight, Calendar, Camera, Check, ChevronLeft, ChevronRight, Clock, Image as ImageIcon, Pencil, Trash2, TrendingDown, TrendingUp, X } from '@tamagui/lucide-icons';
import { addMonths, differenceInMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from 'tamagui';

const INSFORGE_URL = process.env.EXPO_PUBLIC_INSFORGE_URL || 'https://m4kkgsr8.us-east.insforge.app';

const HEADER_COLORS = {
  EXPENSE: { bg: '#fff1f2', text: '#be123c', primary: '#e11d48' },
  INCOME: { bg: '#f0fdf4', text: '#15803d', primary: '#16a34a' },
  TRANSFER: { bg: '#eff6ff', text: '#1d4ed8', primary: '#2563eb' },
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
  is_scheduled?: boolean;
  ticket_image_id?: string | null;
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

type Label = { id: string; name: string; color?: string | null };

const RECURRENCE_PERIOD_OPTIONS = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
] as const;

const DAYS_OF_WEEK = [
  { value: 0, label: 'D' },
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
];

function expenseLabelDisplay(value: string | null | undefined, labels: Label[]): string {
  if (!value) return '';
  const opt = labels.find((l) => l.name === value);
  return opt?.name ?? value;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { new: newParam, kind: kindParam, date: dateParam, accountId: accountIdParam, categoryId: categoryIdParam } = useLocalSearchParams<{
    new?: string;
    kind?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date?: string;
    accountId?: string;
    categoryId?: string;
  }>();
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
  const [recurrencePeriod, setRecurrencePeriod] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('MONTHLY');
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(1); // 0-6
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(1);
  const [recurrenceIntervalMonths, setRecurrenceIntervalMonths] = useState(1);
  const [recurrenceTotalOccurrences, setRecurrenceTotalOccurrences] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expenseLabels, setExpenseLabels] = useState<Label[]>([]);
  const [expenseLabel, setExpenseLabel] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(() => new Date());

  // Inventory state
  const [isInventoryItem, setIsInventoryItem] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [store, setStore] = useState('');
  const [assetNotes, setAssetNotes] = useState('');

  // Ticket image state
  const [ticketImageUri, setTicketImageUri] = useState<string | null>(null);
  const [ticketImageId, setTicketImageId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingTicketImageId, setViewingTicketImageId] = useState<string | null>(null);

  // Filter state
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');

  useEffect(() => {
    if (accountIdParam) {
      setFilterAccountId(accountIdParam);
    }
    if (categoryIdParam) {
      setFilterCategoryId(categoryIdParam);
    }
  }, [accountIdParam, categoryIdParam]);

  useEffect(() => {
    if (newParam === '1') {
      setShowForm(true);
      if (dateParam) {
        setOccurredAt(new Date(dateParam));
      } else {
        setOccurredAt(new Date());
      }
      if (kindParam && (kindParam === 'INCOME' || kindParam === 'EXPENSE' || kindParam === 'TRANSFER')) {
        setKind(kindParam);
      }
    }
  }, [newParam, kindParam, dateParam]);

  useEffect(() => {
    if (editingTx) {
      setKind(editingTx.kind as 'INCOME' | 'EXPENSE' | 'TRANSFER');
      const amountToShow = 'templateAmount' in editingTx && editingTx.templateAmount != null ? editingTx.templateAmount : editingTx.amount;
      setAmount(String(amountToShow));
      setAccountId(editingTx.account_id);
      setCategoryId(editingTx.category_id ?? '');
      setTransferAccountId(editingTx.transfer_account_id ?? '');
      setNote(editingTx.note ?? '');
      setExpenseLabel(editingTx.kind === 'EXPENSE' ? (editingTx.expense_label ?? '') : '');
      setOccurredAt(new Date(editingTx.occurred_at));
      setRecurrencePeriod((editingTx.recurrence_period as any) ?? 'MONTHLY');
      setRecurrenceDayOfWeek(editingTx.recurrence_day_of_month ?? 1); // Using same field for day of week if period is weekly
      setRecurrenceDayOfMonth(editingTx.recurrence_day_of_month ?? 1);
      setRecurrenceIntervalMonths(editingTx.recurrence_interval_months ?? 1);
      setRecurrenceTotalOccurrences(editingTx.recurrence_total_occurrences != null ? String(editingTx.recurrence_total_occurrences) : '');
      setTicketImageId(editingTx.ticket_image_id ?? null);
      setTicketImageUri(null);
    }
  }, [editingTx]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setTicketImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    setIsUploading(true);
    try {
      const fileName = `ticket_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { data, error } = await client.storage
        .from('tickets')
        .upload(fileName, blob);

      if (error) throw error;
      return (data as any)?.id || fileName;
    } catch (err) {
      console.error('[transactions] uploadImage error', err);
      Alert.alert('Error', 'No se pudo subir la imagen del ticket.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const openAndroidPicker = useCallback((mode: 'date' | 'time', initialDate: Date) => {
    DateTimePickerAndroid.open({
      value: initialDate,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          if (mode === 'date') {
            const next = new Date(date);
            // Preserve time if editing
            next.setHours(initialDate.getHours(), initialDate.getMinutes());
            openAndroidPicker('time', next);
          } else {
            setOccurredAt(date);
            setShowDatePicker(false);
          }
        } else if (event.type === 'dismissed') {
          setShowDatePicker(false);
        }
      },
      mode,
      display: 'default',
      is24Hour: false,
    });
  }, []);

  const handleDateChange = useCallback((event: any, date?: Date) => {
    if (Platform.OS === 'ios') {
      if (date) setTempDate(date);
    }
  }, []);

  const handleDateConfirm = useCallback(() => {
    setOccurredAt(tempDate);
    setShowDatePicker(false);
  }, [tempDate]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data: accData } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
        Query.equal('user_id', [profile.id]),
        Query.limit(200),
      ]);

      const { data: allTx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [profile.id]),
        Query.limit(5000),
      ]);

      setAccounts(accData.map((d) => {
        const openingBalance = Number(d.opening_balance || 0);
        const isDebt = d.type === 'CREDIT' || d.type === 'CREDIT_CARD';

        let currentBalance = isDebt ? -openingBalance : openingBalance;
        allTx.filter(t => t.account_id === (d as { $id?: string }).$id || t.account_id === (d as { id?: string }).id).forEach(t => {
          const amt = Number(t.amount);
          if (t.kind === 'INCOME') currentBalance += isDebt ? -amt : amt;
          else if (t.kind === 'EXPENSE' || t.kind === 'TRANSFER') currentBalance += isDebt ? amt : -amt;
        });
        // Also secondary side of transfers
        allTx.filter(t => t.kind === 'TRANSFER' && (t.transfer_account_id === (d as { $id?: string }).$id || t.transfer_account_id === (d as { id?: string }).id)).forEach(t => {
          currentBalance += isDebt ? -Number(t.amount) : Number(t.amount);
        });

        return {
          id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '',
          name: (d.name as string) ?? '',
          balance: currentBalance,
        };
      }) as (Account & { balance: number })[]);
      const { data: catData } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
        Query.equal('user_id', [profile.id]),
        Query.equal('kind', ['INCOME', 'EXPENSE']),
        Query.limit(500),
      ]);
      setCategories(catData.map((d) => ({ id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '', name: (d.name as string) ?? '', kind: (d.kind as string) ?? '', icon: (d.icon as string) ?? null, color: (d.color as string) ?? null })) as Category[]);

      const { data: labelData } = await listDocuments<AppwriteDocument>(COLLECTIONS.transaction_labels, [
        Query.equal('user_id', [profile.id]),
        Query.limit(100),
      ]);
      setExpenseLabels(labelData.map((d) => ({ id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '', name: (d.name as string) ?? '', color: (d.color as string) ?? null })) as Label[]);
    })();
  }, [profile?.id]);

  const monthStart = startOfMonth(selectedMonth).toISOString();
  const monthEnd = endOfMonth(selectedMonth).toISOString();

  const mapTxRow = (doc: AppwriteDocument): TransactionRow => ({
    id: (doc as { $id?: string }).$id ?? (doc as { id?: string }).id ?? '',
    kind: doc.kind as string,
    amount: Number(doc.amount ?? 0),
    occurred_at: doc.occurred_at as string,
    note: doc.note as string | null,
    account_id: doc.account_id as string,
    category_id: doc.category_id as string | null,
    transfer_account_id: doc.transfer_account_id as string | null,
    is_recurring: doc.is_recurring as boolean | undefined,
    recurrence_period: doc.recurrence_period as string | null,
    recurrence_day_of_month: doc.recurrence_day_of_month as number | null,
    recurrence_interval_months: doc.recurrence_interval_months as number | null,
    recurrence_total_occurrences: doc.recurrence_total_occurrences as number | null,
    expense_label: doc.expense_label as string | null,
    ticket_image_id: doc.ticket_image_id as string | null,
  });

  const fetchTransactions = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const ms = startOfMonth(selectedMonth).toISOString();
      const me = endOfMonth(selectedMonth).toISOString();
      const { data: txRows } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [profile.id]),
        Query.greaterThanEqual('occurred_at', ms),
        Query.lessThanEqual('occurred_at', me),
        Query.orderDesc('occurred_at'),
        Query.limit(500),
      ]);
      const allInMonth = txRows.map(mapTxRow);
      const realRows = allInMonth.filter((r) => !r.is_recurring);
      const { data: recurringTemplates } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
        Query.equal('user_id', [profile.id]),
        Query.equal('is_recurring', [true]),
        Query.limit(100),
      ]);
      const templates = recurringTemplates.map(mapTxRow);
      const monthStartDate = startOfMonth(selectedMonth);
      const monthEndDate = endOfMonth(selectedMonth);
      const virtuals: Transaction[] = [];

      for (const t of templates) {
        const templateStart = new Date(t.occurred_at);
        const start = startOfMonth(templateStart);
        const diffMonths = differenceInMonths(monthStartDate, start);

        const period = t.recurrence_period ?? 'MONTHLY';
        const interval = t.recurrence_interval_months ?? 1;

        const generateVirtual = (date: Date) => {
          // Duplication Check: Skip if a real transaction exists on the same day with same kind, account and similar amount
          const isDuplicate = realRows.some((r) =>
            format(new Date(r.occurred_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
            r.kind === t.kind &&
            r.account_id === t.account_id &&
            Math.abs(r.amount - Number(t.amount)) < 0.01
          );
          if (isDuplicate) return null;

          const monthlyAmount = period === 'MONTHLY' ? Math.round((Number(t.amount) / interval) * 100) / 100 : Number(t.amount);
          return {
            ...t,
            id: `recurring-${t.id}-${format(date, 'yyyy-MM-dd')}`,
            amount: monthlyAmount,
            occurred_at: date.toISOString(),
            isRecurringInstance: true,
            virtualDate: date.toISOString(),
            recurringTemplateId: t.id,
            templateAmount: Number(t.amount),
          };
        };

        if (period === 'WEEKLY') {
          const dow = t.recurrence_day_of_month ?? 1;
          let d = new Date(monthStartDate);
          while (d <= monthEndDate) {
            if (d.getDay() === dow && d >= templateStart) {
              const v = generateVirtual(new Date(d));
              if (v) virtuals.push(v);
            }
            d.setDate(d.getDate() + 1);
          }
        } else if (period === 'BIWEEKLY') {
          // 15th and last day
          [15, monthEndDate.getDate()].forEach((day) => {
            const d = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), day);
            if (d >= templateStart) {
              const v = generateVirtual(d);
              if (v) virtuals.push(v);
            }
          });
        } else {
          // MONTHLY
          if (diffMonths >= 0 && diffMonths % interval === 0) {
            const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
            if (t.recurrence_total_occurrences == null || occurrenceIndex <= t.recurrence_total_occurrences) {
              const day = t.recurrence_day_of_month ?? 1;
              const maxDay = monthEndDate.getDate();
              const safeDay = Math.min(day, maxDay);
              const d = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), safeDay);
              if (d >= templateStart) {
                const v = generateVirtual(d);
                if (v) virtuals.push(v);
              }
            }
          }
        }
      }

      setTransactions([...realRows, ...virtuals]);
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

  const filteredTransactions = React.useMemo(() => {
    let result = [...transactions];
    if (filterAccountId) {
      result = result.filter(t => t.account_id === filterAccountId || t.transfer_account_id === filterAccountId);
    }
    if (filterCategoryId) {
      result = result.filter(t => t.category_id === filterCategoryId);
    }
    return result.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }, [transactions, filterAccountId, filterCategoryId]);

  function getValidationMessage(): string | null {
    const needCategory = kind === 'EXPENSE' && categories.filter((c: Category) => c.kind === 'EXPENSE').length > 0;
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

    if (kind === 'EXPENSE' && isInventoryItem) {
      if (!assetName.trim()) parts.push('Ingresa el nombre del bien para el inventario.');
      if (!store.trim()) parts.push('Ingresa la tienda donde se compró el bien.');
    }

    return parts.length ? parts.join(' ') : null;
  }

  function closeWizard() {
    setShowForm(false);
    setEditingTx(null);
    setValidationError(null);
    setTicketImageUri(null);
    setTicketImageId(null);
  }

  function getRecurrenceStartDate(): Date {
    const now = new Date();
    if (recurrencePeriod === 'WEEKLY') {
      // Find the first occurrence of recurrenceDayOfWeek starting from today
      let d = new Date(now);
      while (d.getDay() !== recurrenceDayOfWeek) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
    if (recurrencePeriod === 'BIWEEKLY') {
      // 15th or last day of current month
      const day15 = new Date(now.getFullYear(), now.getMonth(), 15);
      if (day15 >= now) return day15;
      return endOfMonth(now);
    }
    // MONTHLY
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
      const occurredAtDate = isRecurring ? getRecurrenceStartDate() : occurredAt;
      const occurredAtIso = occurredAtDate.toISOString();
      const now = new Date();

      let finalTicketId = ticketImageId;
      if (ticketImageUri) {
        const uploadedId = await uploadImage(ticketImageUri);
        if (uploadedId) finalTicketId = uploadedId;
      }

      // If the date is in the future, mark as scheduled
      const isScheduled = occurredAtDate > now;
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
        recurrence_period: isRecurring ? recurrencePeriod : null,
        recurrence_day_of_month: isRecurring ? (recurrencePeriod === 'WEEKLY' ? recurrenceDayOfWeek : recurrenceDayOfMonth) : null,
        recurrence_interval_months: isRecurring && recurrencePeriod === 'MONTHLY' ? Math.max(1, recurrenceIntervalMonths) : 1,
        recurrence_total_occurrences: isRecurring && recurrenceTotalOccurrences.trim() ? (() => {
          const n = parseInt(recurrenceTotalOccurrences.trim(), 10);
          return Number.isFinite(n) && n >= 1 ? n : null;
        })() : null,
        expense_label: kind === 'EXPENSE' ? expenseLabel : null,
        is_scheduled: isScheduled,
        created_at: new Date().toISOString(),
        ticket_image_id: finalTicketId,
      };
      const result = await createDocument(COLLECTIONS.transactions, payload as Record<string, unknown>);
      const newId = (result as { $id?: string }).$id ?? (result as { id?: string }).id;
      if (!newId) {
        console.error('[transactions] insert ok but no id', result);
        Alert.alert('Error al guardar', 'La transacción no se guardó. Revisa permisos o intenta de nuevo.');
        return;
      }

      // If inventory item, create the record
      if (kind === 'EXPENSE' && isInventoryItem) {
        try {
          await createDocument(COLLECTIONS.inventory_items, {
            user_id: userId,
            org_id: profile.org_id,
            transaction_id: newId,
            name: assetName.trim(),
            store: store.trim(),
            notes: assetNotes.trim() || null,
            amount: Math.abs(amountNum),
            purchase_date: occurredAtIso,
            created_at: new Date().toISOString(),
          });
        } catch (invErr) {
          console.error('[transactions] error creating inventory item', invErr);
          // We don't block the transaction if inventory creation fails, but maybe alert?
          Alert.alert('Atención', 'Se guardó la transacción pero hubo un error al registrar en Inventario.');
        }
      }
      let earnedPoints = 0;
      let hasDoubleReward = false;
      if (kind === 'EXPENSE') {
        const p1 = await awardPoints(profile.org_id, userId, 'CREATE_EXPENSE', 'transactions', newId);
        earnedPoints += p1;
      }
      if (kind === 'INCOME') {
        const p = await awardPoints(profile.org_id, userId, 'CREATE_INCOME', 'transactions', newId);
        earnedPoints += p;
      }
      if (earnedPoints > 0) {
        const message = hasDoubleReward ? '¡Buen trabajo!' : kind === 'EXPENSE' ? '¡Gasto registrado!' : kind === 'INCOME' ? '¡Ingreso registrado!' : '¡Buen trabajo!';
        setRewardToShow({ points: earnedPoints, message });
      }

      // Schedule notification for scheduled transactions
      if (isScheduled && newId) {
        const categoryName = categoryId ? categories.find((c: Category) => c.id === categoryId)?.name : undefined;
        await scheduleTransactionNotification({
          transactionId: newId,
          kind: kind as 'EXPENSE' | 'INCOME' | 'TRANSFER',
          amount: Math.abs(amountNum),
          categoryName,
          scheduledDate: occurredAtDate,
        });
      }

      setShowForm(false);
      setEditingTx(null);
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
      const isTemplateEdit = 'recurringTemplateId' in editingTx && editingTx.recurringTemplateId;

      const payload: Record<string, unknown> = {
        account_id: accountId,
        kind,
        amount: Math.abs(amountNum),
        occurred_at: isTemplateEdit ? new Date(editingTx.occurred_at).toISOString() : occurredAt.toISOString(),
        category_id: kind === 'TRANSFER' ? null : categoryId || null,
        note: note.trim() || null,
        transfer_account_id: kind === 'TRANSFER' ? transferAccountId : null,
        expense_label: kind === 'EXPENSE' ? expenseLabel : null,
        ticket_image_id: ticketImageId,
      };

      if (ticketImageUri) {
        const uploadedId = await uploadImage(ticketImageUri);
        if (uploadedId) payload.ticket_image_id = uploadedId;
      }

      if (isRecurring) {
        payload.is_recurring = true;
        payload.recurrence_period = recurrencePeriod;
        payload.recurrence_day_of_month = recurrencePeriod === 'WEEKLY' ? recurrenceDayOfWeek : recurrenceDayOfMonth;
        payload.recurrence_interval_months = recurrencePeriod === 'MONTHLY' ? Math.max(1, recurrenceIntervalMonths) : 1;
        const totalOcc = recurrenceTotalOccurrences.trim() ? (() => {
          const n = parseInt(recurrenceTotalOccurrences.trim(), 10);
          return Number.isFinite(n) && n >= 1 ? n : null;
        })() : null;
        payload.recurrence_total_occurrences = totalOcc;
      } else {
        payload.is_recurring = false;
        payload.recurrence_period = null;
        payload.recurrence_day_of_month = null;
        payload.recurrence_interval_months = 1;
        payload.recurrence_total_occurrences = null;
      }
      await updateDocument(COLLECTIONS.transactions, realId, payload);
      setShowForm(false);
      setEditingTx(null);
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
    const amountToShow = 'templateAmount' in item && item.templateAmount != null ? item.templateAmount : item.amount;
    const realId = 'recurringTemplateId' in item && item.recurringTemplateId ? item.recurringTemplateId : item.id;
    const isRecurringOrTemplate = item.is_recurring || ('recurringTemplateId' in item && item.recurringTemplateId);

    if (isRecurringOrTemplate) {
      Alert.alert(
        'Eliminar serie recurrente',
        `¿Eliminar esta serie recurrente y todas sus transacciones futuras?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar serie', style: 'destructive', onPress: () => deleteTransaction(item) },
        ]
      );
      return;
    }

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
    const realId = 'recurringTemplateId' in item && item.recurringTemplateId ? item.recurringTemplateId : item.id;
    try {
      // Cancel any scheduled notifications for this transaction
      if (item.is_scheduled) {
        await cancelTransactionNotifications(realId);
      }

      await deleteDocument(COLLECTIONS.transactions, realId);
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

  const categoriesForKind = categories.filter((c: Category) => c.kind === kind);
  const showCategoryPicker = kind !== 'TRANSFER';

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={styles.activeTabText}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push('/(protected)/(tabs)/finance/calendar')}
        >
          <Text style={styles.tabText}>Calendario</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 400 }}
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

        {!showForm && (
          <View style={styles.filtersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
              <TouchableOpacity
                onPress={() => setFilterAccountId('')}
                style={[styles.filterChip, !filterAccountId && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, !filterAccountId && styles.filterChipTextActive]}>Todas las cuentas</Text>
              </TouchableOpacity>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => setFilterAccountId(acc.id === filterAccountId ? '' : acc.id)}
                  style={[styles.filterChip, filterAccountId === acc.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filterAccountId === acc.id && styles.filterChipTextActive]}>{acc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
              <TouchableOpacity
                onPress={() => setFilterCategoryId('')}
                style={[styles.filterChip, !filterCategoryId && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, !filterCategoryId && styles.filterChipTextActive]}>Todas las categorías</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setFilterCategoryId(cat.id === filterCategoryId ? '' : cat.id)}
                  style={[styles.filterChip, filterCategoryId === cat.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filterCategoryId === cat.id && styles.filterChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Modal
          visible={showForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeWizard}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.wizardWrap}
          >
            <View style={[styles.wizardHeader, { backgroundColor: HEADER_COLORS[kind].bg }]}>
              <View style={styles.wizardHeaderRow}>
                <TouchableOpacity onPress={closeWizard} style={styles.wizardClose} accessibilityLabel="Cerrar">
                  <X size={24} color={HEADER_COLORS[kind].text} />
                </TouchableOpacity>
                <View style={styles.wizardHeaderCenter}>
                  <View style={styles.wizardKindRow}>
                    {TX_KINDS.map(({ value, label }) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => {
                          setValidationError(null);
                          setKind(value);
                          if (value !== 'EXPENSE') setExpenseLabel('');
                        }}
                        style={[styles.wizardKindChip, kind === value && styles.wizardKindChipActive]}
                      >
                        <Text style={[styles.wizardKindText, kind === value && styles.wizardKindTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.amountInputContainer}>
                    <Text style={[styles.amountCurrency, { color: HEADER_COLORS[kind].text }]}>
                      {kind === 'EXPENSE' ? '–' : ''}$
                    </Text>
                    <TextInput
                      style={[styles.wizardAmountInput, { color: HEADER_COLORS[kind].text }]}
                      value={amount}
                      onChangeText={(v) => { setValidationError(null); setAmount(v); }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="rgba(0,0,0,0.2)"
                      autoFocus={newParam === '1' && !editingTx}
                    />
                  </View>
                  <Text style={[styles.wizardDate, { color: HEADER_COLORS[kind].text }]}>
                    {format(occurredAt, "EEE, d MMM yyyy h:mm a", { locale: es })}
                  </Text>

                  {/* Projected Balance Display */}
                  {accountId && (
                    <View style={styles.projectedBalanceContainer}>
                      <Text style={[styles.projectedBalanceLabel, { color: HEADER_COLORS[kind].text }]}>
                        BALANCE PROYECTADO:
                      </Text>
                      <Text style={[styles.projectedBalanceValue, { color: HEADER_COLORS[kind].text }]}>
                        {(() => {
                          const acc = (accounts as (Account & { balance: number })[]).find(a => a.id === accountId);
                          if (!acc) return '$0.00';
                          const curBal = acc.balance || 0;
                          const inputAmount = parseFloat(amount.replace(',', '.')) || 0;
                          let projected = curBal;

                          if (kind === 'INCOME') projected += inputAmount;
                          else if (kind === 'EXPENSE' || kind === 'TRANSFER') projected -= inputAmount;

                          return projected.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
                        })()}
                      </Text>
                    </View>
                  )}

                  {(isRecurring || (editingTx && (editingTx.is_recurring || ('recurringTemplateId' in editingTx && editingTx.recurringTemplateId)))) && (
                    <Text style={[styles.scheduledLegend, { color: HEADER_COLORS[kind].text }]}>
                      {kind === 'INCOME' ? 'INGRESO PROGRAMADO' : 'GASTO PROGRAMADO'}
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

            <ScrollView
              style={styles.wizardBody}
              contentContainerStyle={styles.wizardBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitleSmall}>CUENTA</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                {accounts.map((a: Account) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => { setValidationError(null); setAccountId(a.id); }}
                    style={[styles.pill, accountId === a.id && { backgroundColor: HEADER_COLORS[kind].primary }]}
                  >
                    <Text style={[styles.pillText, accountId === a.id && styles.pillTextActive]}>{a.name}</Text>
                  </TouchableOpacity>
                ))}
                {accounts.length === 0 && (
                  <Text style={styles.emptyTextInline}>Sin cuentas.</Text>
                )}
              </ScrollView>

              {kind === 'TRANSFER' && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                    <Text style={styles.sectionTitleSmall}>DESTINO</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                    {accounts.filter((a: Account) => a.id !== accountId).map((a: Account) => (
                      <TouchableOpacity
                        key={a.id}
                        onPress={() => { setValidationError(null); setTransferAccountId(a.id); }}
                        style={[styles.pill, transferAccountId === a.id && { backgroundColor: HEADER_COLORS[kind].primary }]}
                      >
                        <Text style={[styles.pillText, transferAccountId === a.id && styles.pillTextActive]}>{a.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {accounts.length <= 1 && (
                      <Text style={styles.emptyTextInline}>Necesitas otra cuenta.</Text>
                    )}
                  </ScrollView>
                </>
              )}

              {kind !== 'TRANSFER' && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                    <Text style={styles.sectionTitleSmall}>CATEGORÍA</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                    {categoriesForKind.map((c: Category, idx: number) => {
                      const CatIcon = getCategoryIcon(c.icon, kind);
                      const catColor = getCategoryColor(c.color, idx);
                      const isActive = categoryId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => { setValidationError(null); setCategoryId(c.id); }}
                          style={[styles.pill, isActive && { backgroundColor: HEADER_COLORS[kind].primary }]}
                        >
                          <CatIcon size={14} color={isActive ? '#fff' : (c.color || catColor)} style={{ marginRight: 6 }} />
                          <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{c.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {categoriesForKind.length === 0 && (
                      <Text style={styles.emptyTextInline}>Sin categorías.</Text>
                    )}
                  </ScrollView>
                </>
              )}

              {kind === 'EXPENSE' && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                    <Text style={styles.sectionTitleSmall}>ETIQUETA</Text>
                  </View>
                  <View style={styles.labelsRow}>
                    {expenseLabels.map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => { setValidationError(null); setExpenseLabel(l.name); }}
                        style={[styles.labelChip, expenseLabel === l.name && { backgroundColor: HEADER_COLORS[kind].primary, borderColor: HEADER_COLORS[kind].primary }]}
                      >
                        <Text style={[styles.labelChipText, expenseLabel === l.name && styles.labelChipTextActive]}>{l.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {expenseLabels.length === 0 && (
                      <Text style={styles.emptyTextInline}>Sin etiquetas configuradas.</Text>
                    )}
                  </View>
                </>
              )}

              <View style={[styles.sectionHeader, { marginTop: 16, marginBottom: 8 }]}>
                <Text style={styles.sectionTitleSmall}>NOTA</Text>
              </View>
              <View style={styles.noteInputContainer}>
                <TextInput
                  style={[styles.singleLineInput, { flex: 1 }]}
                  placeholder="Añadir una nota..."
                  value={note}
                  onChangeText={setNote}
                  editable={!loading}
                />
                <TouchableOpacity onPress={pickImage} style={styles.cameraBtn}>
                  <Camera size={24} color={HEADER_COLORS[kind].primary} />
                </TouchableOpacity>
              </View>

              {(ticketImageUri || ticketImageId) && (
                <View style={styles.ticketPreviewContainer}>
                  <Image
                    source={{ uri: ticketImageUri || `${INSFORGE_URL}/api/storage/buckets/tickets/objects/${ticketImageId}` }}
                    style={styles.ticketPreview}
                  />
                  <TouchableOpacity
                    onPress={() => { setTicketImageUri(null); setTicketImageId(null); }}
                    style={styles.removeTicketBtn}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.dateSelectorCard}
                onPress={() => {
                  if (Platform.OS === 'android') {
                    openAndroidPicker('date', occurredAt);
                  } else {
                    setTempDate(occurredAt);
                    setShowDatePicker(true);
                  }
                }}
              >
                <Calendar size={18} color="#64748b" />
                <Text style={styles.dateSelectorText}>{format(occurredAt, "EEE, d MMM yyyy h:mm a", { locale: es })}</Text>
                <Clock size={16} color={HEADER_COLORS[kind].primary} />
              </TouchableOpacity>

              {kind === 'EXPENSE' && (
                <>
                  <View style={styles.divider} />

                  <View style={styles.inventorySection}>
                    <TouchableOpacity
                      onPress={() => setIsInventoryItem(!isInventoryItem)}
                      style={styles.recurringToggleBtn}
                    >
                      <View style={[styles.checkbox, isInventoryItem && { backgroundColor: HEADER_COLORS[kind].primary, borderColor: HEADER_COLORS[kind].primary }]} />
                      <Text style={styles.recurringLabel}>Registrar en Inventario</Text>
                    </TouchableOpacity>

                    {isInventoryItem && (
                      <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={styles.recurringDetails}
                      >
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputTitleSmall}>NOMBRE DEL BIEN</Text>
                          <TextInput
                            style={styles.singleLineInput}
                            placeholder="Ej. iPhone 15, Laptop, Sofá"
                            value={assetName}
                            onChangeText={setAssetName}
                            editable={!loading}
                          />
                        </View>

                        <View style={[styles.inputGroup, { marginTop: 12 }]}>
                          <Text style={styles.inputTitleSmall}>TIENDA</Text>
                          <TextInput
                            style={styles.singleLineInput}
                            placeholder="Ej. Apple Store, Amazon, IKEA"
                            value={store}
                            onChangeText={setStore}
                            editable={!loading}
                          />
                        </View>

                        <View style={[styles.inputGroup, { marginTop: 12 }]}>
                          <Text style={styles.inputTitleSmall}>NOTAS ADICIONALES</Text>
                          <TextInput
                            style={styles.singleLineInput}
                            placeholder="Garantía, color, etc."
                            value={assetNotes}
                            onChangeText={setAssetNotes}
                            editable={!loading}
                          />
                        </View>
                      </MotiView>
                    )}
                  </View>
                </>
              )}

              <View style={styles.divider} />

              <View style={styles.recurringToggleRow}>
                <TouchableOpacity
                  onPress={() => setIsRecurring(!isRecurring)}
                  style={styles.recurringToggleBtn}
                >
                  <View style={[styles.checkbox, isRecurring && { backgroundColor: HEADER_COLORS[kind].primary, borderColor: HEADER_COLORS[kind].primary }]} />
                  <Text style={styles.recurringLabel}>
                    {kind === 'INCOME' ? 'Ingreso Recurrente' : 'Gasto Recurrente'}
                  </Text>
                </TouchableOpacity>

                {isRecurring && (
                  <MotiView
                    from={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={styles.recurringDetails}
                  >
                    <View style={styles.periodPickerRow}>
                      <Text style={styles.dayPickerLabel}>Frecuencia:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayValueTabs}>
                        {RECURRENCE_PERIOD_OPTIONS.map((opt) => (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => setRecurrencePeriod(opt.value as any)}
                            style={[
                              styles.dayTab,
                              { width: 'auto', paddingHorizontal: 12 },
                              recurrencePeriod === opt.value && { backgroundColor: HEADER_COLORS[kind].primary },
                            ]}
                          >
                            <Text style={[styles.dayTabText, recurrencePeriod === opt.value && styles.dayTabTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    {recurrencePeriod === 'WEEKLY' && (
                      <View style={[styles.dayPickerRow, { marginTop: 16 }]}>
                        <Text style={styles.dayPickerLabel}>Día de la semana:</Text>
                        <View style={styles.dayValueTabs}>
                          {DAYS_OF_WEEK.map((d) => (
                            <TouchableOpacity
                              key={d.value}
                              onPress={() => setRecurrenceDayOfWeek(d.value)}
                              style={[styles.dayTab, recurrenceDayOfWeek === d.value && { backgroundColor: HEADER_COLORS[kind].primary }]}
                            >
                              <Text style={[styles.dayTabText, recurrenceDayOfWeek === d.value && styles.dayTabTextActive]}>{d.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {recurrencePeriod === 'MONTHLY' && (
                      <>
                        <View style={[styles.dayPickerRow, { marginTop: 16 }]}>
                          <Text style={styles.dayPickerLabel}>Día del mes:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayValueTabs}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                              <TouchableOpacity
                                key={d}
                                onPress={() => setRecurrenceDayOfMonth(d)}
                                style={[styles.dayTab, recurrenceDayOfMonth === d && { backgroundColor: HEADER_COLORS[kind].primary }]}
                              >
                                <Text style={[styles.dayTabText, recurrenceDayOfMonth === d && styles.dayTabTextActive]}>{d}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>

                        <View style={[styles.dayPickerRow, { marginTop: 16 }]}>
                          <Text style={styles.dayPickerLabel}>Cada X meses:</Text>
                          <TextInput
                            style={styles.occurrenceInput}
                            value={String(recurrenceIntervalMonths)}
                            onChangeText={(v) => setRecurrenceIntervalMonths(parseInt(v, 10) || 1)}
                            keyboardType="number-pad"
                            placeholder="1"
                            placeholderTextColor="#94a3b8"
                          />
                        </View>
                      </>
                    )}

                    <View style={[styles.dayPickerRow, { marginTop: 16 }]}>
                      <Text style={styles.dayPickerLabel}>Límite (ocurrencias):</Text>
                      <TextInput
                        style={styles.occurrenceInput}
                        value={recurrenceTotalOccurrences}
                        onChangeText={setRecurrenceTotalOccurrences}
                        keyboardType="number-pad"
                        placeholder="Sin límite"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </MotiView>
                )}
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.wizardFooter}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: HEADER_COLORS[kind].primary }]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                  if (editingTx) updateTransaction();
                  else createTransaction();
                }}
                disabled={loading}
              >
                <Check size={20} color="#fff" strokeWidth={3} />
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Guardando...' : editingTx ? 'Actualizar' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* DateTimePicker Modal for scheduling */}
        {showDatePicker && Platform.OS === 'web' && (
          <Modal visible transparent animationType="fade">
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerBtn}>
                    <Text style={styles.datePickerBtnCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Programar fecha</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setOccurredAt(tempDate);
                      setShowDatePicker(false);
                    }}
                    style={styles.datePickerBtn}
                  >
                    <Text style={styles.datePickerBtnConfirm}>Aceptar</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.webDatePickerContainer}>
                  <input
                    type="datetime-local"
                    value={format(tempDate, "yyyy-MM-dd'T'HH:mm")}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newDate = new Date(e.target.value);
                      if (!isNaN(newDate.getTime())) {
                        setTempDate(newDate);
                      }
                    }}
                    style={{
                      fontSize: 18,
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      width: '100%',
                      marginTop: 16,
                      marginBottom: 16,
                    }}
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal visible transparent animationType="slide">
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerBtn}>
                    <Text style={styles.datePickerBtnCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Programar fecha</Text>
                  <TouchableOpacity
                    onPress={handleDateConfirm}
                    style={styles.datePickerBtn}
                  >
                    <Text style={styles.datePickerBtnConfirm}>Aceptar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate instanceof Date ? tempDate : new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={handleDateChange}
                  locale="es"
                />
              </View>
            </View>
          </Modal>
        )}
        {/* Note: Android uses imperative API via openAndroidPicker */}

        <View style={styles.monthNavWrap}>
          <TouchableOpacity
            onPress={() => setSelectedMonth((m: Date) => subMonths(m, 1))}
            style={styles.monthNavButton}
            accessibilityLabel="Mes anterior"
          >
            <ChevronLeft size={24} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.monthNavLabel}>{format(selectedMonth, 'MMMM yyyy', { locale: es })}</Text>
          <TouchableOpacity
            onPress={() => setSelectedMonth((m: Date) => addMonths(m, 1))}
            style={styles.monthNavButton}
            accessibilityLabel="Mes siguiente"
          >
            <ChevronRight size={24} color="#334155" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Transacciones</Text>
        {filteredTransactions.map((item: Transaction, index: number) => {
          const Icon = TX_KINDS.find((k) => k.value === item.kind)?.icon ?? TrendingDown;
          const isVirtual = 'isRecurringInstance' in item && item.isRecurringInstance;
          const accountName = accounts.find((a: Account) => a.id === item.account_id)?.name ?? '';
          const categoryName = item.category_id ? (categories.find((c: Category) => c.id === item.category_id)?.name ?? null) : null;
          const transferName = item.transfer_account_id ? accounts.find((a: Account) => a.id === item.transfer_account_id)?.name : null;
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
              transition={{ duration: 320, delay: 100 + index * 45 }}
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
                  <Text numberOfLines={1} style={styles.txMeta}>Etiqueta: {expenseLabelDisplay(item.expense_label, expenseLabels)}</Text>
                ) : null}
                {item.note ? <Text numberOfLines={1} style={styles.txNote}>{item.note}</Text> : null}
                {item.ticket_image_id && (
                  <TouchableOpacity
                    onPress={() => setViewingTicketImageId(item.ticket_image_id || null)}
                    style={styles.txTicketIcon}
                  >
                    <ImageIcon size={14} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.txTicketText}>Ver ticket</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.txRight}>
                <Text style={amountStyle}>
                  {isExpense ? '-' : ''}{Number(item.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </Text>
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

      <Modal
        visible={!!viewingTicketImageId}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingTicketImageId(null)}
      >
        <View style={styles.fullscreenImageOverlay}>
          <TouchableOpacity
            style={styles.fullscreenImageClose}
            onPress={() => setViewingTicketImageId(null)}
          >
            <X size={32} color="#fff" />
          </TouchableOpacity>
          {viewingTicketImageId && (
            <Image
              source={{ uri: `${INSFORGE_URL}/api/storage/buckets/tickets/objects/${viewingTicketImageId}` }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View >
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  wizardWrap: { flex: 1, backgroundColor: '#f8fafc' },
  wizardHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  wizardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wizardClose: { padding: 8, width: 44, alignItems: 'center' },
  wizardClosePlaceholder: { width: 44 },
  wizardHeaderCenter: { flex: 1, alignItems: 'center' },
  wizardKindRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
  },
  wizardKindChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  wizardKindChipActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  wizardKindText: { fontSize: 13, fontWeight: '600', color: 'rgba(0,0,0,0.5)' },
  wizardKindTextActive: { color: '#0f172a' },
  wizardAmount: { fontSize: 48, fontWeight: '800', textAlign: 'center', letterSpacing: -1 },
  wizardDate: { fontSize: 13, opacity: 0.7, textAlign: 'center', marginTop: 8, fontWeight: '500' },
  wizardBody: { flex: 1 },
  wizardBodyContent: { padding: 20, paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionTitleSmall: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
  horizontalPills: { gap: 10, paddingRight: 20 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pillText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  pillTextActive: { color: '#fff' },
  labelsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', paddingHorizontal: 4 },
  labelChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
  labelChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  labelChipTextActive: { color: '#fff' },
  singleLineInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
  },
  wizardAmountInput: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'left',
    letterSpacing: -1,
    padding: 0,
    margin: 0,
    minWidth: 80,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  amountCurrency: {
    fontSize: 32,
    fontWeight: '700',
    marginRight: 4,
    opacity: 0.9,
  },
  wizardFooter: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    gap: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scheduledLegend: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 8,
    opacity: 0.8,
  },
  occurrenceInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 80,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
  },
  noteInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  cameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketPreviewContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
  },
  ticketPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  removeTicketBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 24,
  },
  dateSelectorText: { flex: 1, fontSize: 15, color: '#475569', fontWeight: '500' },
  projectedBalanceContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  projectedBalanceLabel: {
    fontSize: 9,
    fontWeight: '800',
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  projectedBalanceValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  recurringToggleRow: { paddingHorizontal: 4, marginVertical: 16 },
  recurringToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  recurringLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  recurringDetails: { marginTop: 16, paddingLeft: 36 },
  periodPickerRow: { gap: 8 },
  dayPickerRow: { gap: 8 },
  dayPickerLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  dayValueTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayTab: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  dayTabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  dayTabTextActive: { color: '#fff' },
  keypadContainer: { marginTop: 16, borderTopWidth: 1.5, borderTopColor: '#f1f5f9', paddingTop: 28 },
  validationBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7ed', padding: 14, borderRadius: 16, margin: 20, marginBottom: 0, borderWidth: 1, borderColor: '#ffedd5' },
  validationBannerText: { flex: 1, fontSize: 13, color: '#9a3412', fontWeight: '500' },
  emptyTextInline: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 10 },
  monthNavWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
  monthNavButton: { padding: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  monthNavLabel: { fontSize: 18, fontWeight: '800', color: '#0f172a', textTransform: 'capitalize' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  txIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  txIconRed: { backgroundColor: '#fff1f2' },
  txIconGreen: { backgroundColor: '#f0fdf4' },
  txIconBlue: { backgroundColor: '#eff6ff' },
  txInfo: { flex: 1 },
  txKind: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  txDate: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  txMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  txNote: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' },
  txRight: { alignItems: 'flex-end' },
  txNeg: { fontSize: 17, fontWeight: '800', color: '#e11d48' },
  txPos: { fontSize: 17, fontWeight: '800', color: '#16a34a' },
  txTransfer: { fontSize: 17, fontWeight: '800', color: '#2563eb' },
  txActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  txActionBtn: { padding: 4 },
  recurringBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  recurringBadgeText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  txKindRow: { flexDirection: 'row', alignItems: 'center' },
  txTicketIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  txTicketText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  datePickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40 },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  datePickerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  datePickerBtn: { padding: 8 },
  datePickerBtnCancel: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  datePickerBtnConfirm: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  webDatePickerContainer: { padding: 20 },
  inventorySection: { paddingVertical: 16 },
  inputGroup: { marginBottom: 4 },
  inputTitleSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  fullscreenImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImageClose: {
    position: 'absolute',
    top: 50,
    right: 25,
    zIndex: 10,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#fff',
  },
  filtersContainer: {
    marginBottom: 20,
    gap: 12,
  },
  filtersScroll: {
    paddingHorizontal: 0,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
});
