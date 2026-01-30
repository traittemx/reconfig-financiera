import {
  startOfMonth,
  endOfMonth,
  subDays,
  format,
  getDate,
  getDay,
  isWeekend,
  differenceInMonths,
} from 'date-fns';
import { supabase } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import type { PilotDayState, PilotRecommendation, PilotSignalsSnapshot } from '@/types/pilot';

// --- Thresholds (tunable) ---
const MARGIN_SAFE_MIN = 3000;
const MARGIN_CONTAINMENT_MAX = 1000;
const RATIO_CAUTION = 0.7;
const RATIO_SAFE = 0.5;
const RATIO_REWARD = 0.4;
const IMPULSIVE_DAY_MULTIPLIER = 1.4; // today's weekday avg expense vs overall avg

// --- Message templates (human, max 2 sentences, no jargon) ---
const MESSAGES_MAIN: Record<PilotDayState, string[]> = {
  SAFE: [
    'Hoy puedes ir con calma. Si quieres darte un gusto pequeño, hazlo sin culpa.',
  ],
  CAUTION: [
    'Hoy ve con calma, no es día para decisiones grandes. Mañana tendrás más claridad.',
  ],
  CONTAINMENT: [
    'Hoy mejor solo lo esencial. Si gastas de más, mañana se va a sentir.',
  ],
  REWARD: [
    'Te portaste bien con tus finanzas esta semana. Puedes darte un gusto pequeño hoy.',
  ],
};

function pickMainMessage(state: PilotDayState, _checkinNegative: boolean): string {
  const options = MESSAGES_MAIN[state];
  return options[0] ?? MESSAGES_MAIN.SAFE[0];
}

function pickWhyMessage(
  state: PilotDayState,
  preQuincena: boolean,
  highRiskImpulsive: boolean,
  ratio: number
): string {
  if (state === 'CONTAINMENT') {
    if (preQuincena) return 'Queda poco mes y el margen está justo; hoy solo lo necesario.';
    if (highRiskImpulsive) return 'Es un día típico en el que sueles gastar más; hoy mejor contención.';
    return 'Hoy el margen va justo; mejor solo lo esencial.';
  }
  if (state === 'CAUTION') {
    if (highRiskImpulsive) return 'Es un día en el que sueles gastar más; ve con calma.';
    if (ratio > RATIO_CAUTION) return 'Ya llevas un buen gasto del mes; hoy sin decisiones grandes.';
    return 'Hoy mejor ir con calma.';
  }
  if (state === 'SAFE' || state === 'REWARD') {
    if (preQuincena === false) return 'Acabas de recibir ingreso y tienes margen; hoy con calma.';
    return 'Tienes margen; hoy con calma.';
  }
  return 'Hoy con calma.';
}

function getSuggestedLimit(state: PilotDayState): string {
  switch (state) {
    case 'CONTAINMENT':
      return 'Solo lo esencial';
    case 'CAUTION':
      return 'Evitar gastos grandes';
    case 'SAFE':
    case 'REWARD':
      return 'Un gusto pequeño está bien';
    default:
      return 'Ir con calma';
  }
}

function getSuggestedAction(state: PilotDayState): string {
  switch (state) {
    case 'CONTAINMENT':
      return 'Registra lo que gastes hoy';
    case 'CAUTION':
      return 'Deja las compras grandes para otro día';
    case 'SAFE':
    case 'REWARD':
      return 'Disfruta el día con tranquilidad';
    default:
      return 'Sigue tu día';
  }
}

function getFlexibility(state: PilotDayState): 'bajo' | 'medio' | 'alto' {
  switch (state) {
    case 'CONTAINMENT':
      return 'bajo';
    case 'CAUTION':
      return 'medio';
    case 'SAFE':
    case 'REWARD':
      return 'alto';
    default:
      return 'medio';
  }
}

export async function getDailyRecommendation(
  userId: string,
  orgId: string,
  date: Date
): Promise<PilotRecommendation | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('pilot_daily_recommendations')
    .select('*')
    .eq('user_id', userId)
    .eq('recommendation_date', dateStr)
    .maybeSingle();

  if (error) {
    console.warn('[pilot] getDailyRecommendation error', error);
    return null;
  }
  return data as PilotRecommendation | null;
}

async function loadMonthTransactions(
  userId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<{ income: number; expense: number; rows: { kind: string; amount: number; occurred_at: string }[] }> {
  const startIso = monthStart.toISOString();
  const endIso = monthEnd.toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .select('kind, amount, occurred_at, is_recurring')
    .eq('user_id', userId)
    .gte('occurred_at', startIso)
    .lte('occurred_at', endIso);

  if (error) {
    console.warn('[pilot] loadMonthTransactions error', error);
    return { income: 0, expense: 0, rows: [] };
  }

  const rows = (data ?? []).filter((r: { is_recurring?: boolean }) => !r.is_recurring);
  let income = 0;
  let expense = 0;
  rows.forEach((r: { kind: string; amount: number }) => {
    const amt = Number(r.amount);
    if (r.kind === 'INCOME') income += amt;
    else if (r.kind === 'EXPENSE') expense += amt;
  });
  return { income, expense, rows };
}

async function loadBalance(userId: string): Promise<number> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, opening_balance, type')
    .eq('user_id', userId);

  let balance = 0;
  (accounts ?? []).forEach((a: { opening_balance: number; type?: string }) => {
    const bal = Number(a.opening_balance);
    balance += (a.type === 'CREDIT' || a.type === 'CREDIT_CARD') ? -bal : bal;
  });

  const { data: allTx } = await supabase
    .from('transactions')
    .select('kind, amount')
    .eq('user_id', userId);

  (allTx ?? []).forEach((t: { kind: string; amount: number }) => {
    const amt = Number(t.amount);
    if (t.kind === 'INCOME') balance += amt;
    else if (t.kind === 'EXPENSE') balance -= amt;
  });
  return balance;
}

async function loadRecurringMonthlyTotal(userId: string): Promise<number> {
  const { data } = await supabase
    .from('transactions')
    .select('amount, kind, occurred_at, recurrence_interval_months, recurrence_total_occurrences')
    .eq('user_id', userId)
    .eq('is_recurring', true);

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  let total = 0;
  (data ?? []).forEach((r: { amount: number; kind: string; occurred_at: string; recurrence_interval_months?: number | null; recurrence_total_occurrences?: number | null }) => {
    if (r.kind !== 'EXPENSE') return;
    if (r.recurrence_total_occurrences != null) {
      const start = startOfMonth(new Date(r.occurred_at));
      const occurrenceIndex = differenceInMonths(currentMonthStart, start) + 1;
      if (occurrenceIndex > r.recurrence_total_occurrences) return;
    }
    const interval = r.recurrence_interval_months ?? 1;
    total += Math.round((Number(r.amount) / interval) * 100) / 100;
  });
  return total;
}

async function debtDueWithinDays(userId: string, fromDate: Date, days: number): Promise<boolean> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('payment_day, type')
    .eq('user_id', userId)
    .in('type', ['CREDIT', 'CREDIT_CARD']);

  if (!accounts?.length) return false;
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (const a of accounts as { payment_day: number | null }[]) {
    if (a.payment_day == null) continue;
    const day = Math.min(a.payment_day, 28);
    let payDate = new Date(from.getFullYear(), from.getMonth(), day);
    if (payDate < from) payDate = new Date(from.getFullYear(), from.getMonth() + 1, day);
    const diff = (payDate.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (diff >= 0 && diff <= days) return true;
  }
  return false;
}

async function averageExpenseByWeekday(
  userId: string,
  fromDate: Date,
  daysBack: number
): Promise<Record<number, number>> {
  const start = subDays(fromDate, daysBack);
  const { data } = await supabase
    .from('transactions')
    .select('amount, occurred_at, kind, is_recurring')
    .eq('user_id', userId)
    .eq('kind', 'EXPENSE')
    .gte('occurred_at', start.toISOString());

  const byWeekday: Record<number, { sum: number; count: number }> = {};
  for (let d = 0; d <= 6; d++) byWeekday[d] = { sum: 0, count: 0 };

  (data ?? []).forEach((r: { amount: number; occurred_at: string; is_recurring?: boolean }) => {
    if (r.is_recurring) return;
    const day = getDay(new Date(r.occurred_at));
    byWeekday[day].sum += Number(r.amount);
    byWeekday[day].count += 1;
  });

  const avgByWeekday: Record<number, number> = {};
  for (let d = 0; d <= 6; d++) {
    avgByWeekday[d] = byWeekday[d].count > 0 ? byWeekday[d].sum / byWeekday[d].count : 0;
  }
  return avgByWeekday;
}

async function getEmotionalCheckin(userId: string, date: Date): Promise<string | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data } = await supabase
    .from('pilot_emotional_checkins')
    .select('value')
    .eq('user_id', userId)
    .eq('checkin_date', dateStr)
    .maybeSingle();
  return (data as { value: string } | null)?.value ?? null;
}

async function getYesterdayRecommendation(userId: string, today: Date): Promise<{ state: PilotDayState; suggested_limit: string } | null> {
  const yesterday = subDays(today, 1);
  const dateStr = format(yesterday, 'yyyy-MM-dd');
  const { data } = await supabase
    .from('pilot_daily_recommendations')
    .select('state, suggested_limit')
    .eq('user_id', userId)
    .eq('recommendation_date', dateStr)
    .maybeSingle();
  return data as { state: PilotDayState; suggested_limit: string } | null;
}

async function getYesterdayExpense(userId: string, yesterday: Date): Promise<number> {
  const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
  const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
  const { data } = await supabase
    .from('transactions')
    .select('amount, kind, is_recurring')
    .eq('user_id', userId)
    .eq('kind', 'EXPENSE')
    .gte('occurred_at', start.toISOString())
    .lte('occurred_at', end.toISOString());

  let sum = 0;
  (data ?? []).filter((r: { is_recurring?: boolean }) => !r.is_recurring).forEach((r: { amount: number }) => {
    sum += Number(r.amount);
  });
  return sum;
}

function classifyState(
  margin: number,
  incomeMonth: number,
  expenseMonth: number,
  dayOfMonth: number,
  isWeekendDay: boolean,
  weekday: number,
  avgByWeekday: Record<number, number>,
  debtDueSoon: boolean,
  yesterdayRec: { state: PilotDayState } | null,
  yesterdayExpense: number,
  emotionalNegative: boolean
): PilotDayState {
  const ratio = incomeMonth > 0 ? expenseMonth / incomeMonth : 0;
  const preQuincena = dayOfMonth >= 25 || dayOfMonth <= 5;
  const postQuincena = (dayOfMonth >= 14 && dayOfMonth <= 17) || dayOfMonth >= 28;

  const overallAvg =
    Object.values(avgByWeekday).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(avgByWeekday).length);
  const todayWeekdayAvg = avgByWeekday[weekday] ?? 0;
  const highRiskImpulsive =
    overallAvg > 0 && todayWeekdayAvg >= overallAvg * IMPULSIVE_DAY_MULTIPLIER;

  const followedRecommendationYesterday =
    yesterdayRec?.state === 'CONTAINMENT' && yesterdayExpense < MARGIN_CONTAINMENT_MAX * 2;

  let scoreContainment = 0;
  let scoreCaution = 0;
  let scoreSafe = 0;
  let scoreReward = 0;

  if (margin < MARGIN_CONTAINMENT_MAX || (preQuincena && margin < MARGIN_SAFE_MIN)) scoreContainment += 2;
  if (debtDueSoon) scoreContainment += 1;
  if (highRiskImpulsive && (preQuincena || ratio > RATIO_CAUTION)) scoreContainment += 1;
  if (emotionalNegative && margin < MARGIN_SAFE_MIN) scoreContainment += 1;

  if (preQuincena || ratio > RATIO_CAUTION) scoreCaution += 1;
  if (highRiskImpulsive) scoreCaution += 1;
  if (emotionalNegative && scoreContainment === 0) scoreCaution += 1;

  if (margin > MARGIN_SAFE_MIN && !preQuincena && !highRiskImpulsive) scoreSafe += 2;
  if (postQuincena && ratio < RATIO_SAFE) scoreSafe += 1;
  if (followedRecommendationYesterday) scoreSafe += 1;

  if (followedRecommendationYesterday && margin > MARGIN_CONTAINMENT_MAX) scoreReward += 1;
  if (postQuincena && ratio < RATIO_REWARD) scoreReward += 1;

  const order: PilotDayState[] = ['CONTAINMENT', 'CAUTION', 'SAFE', 'REWARD'];
  const scores = [scoreContainment, scoreCaution, scoreSafe, scoreReward];
  let bestIdx = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIdx]) bestIdx = i;
  }
  return order[bestIdx];
}

export async function getOrCreateDailyRecommendation(
  userId: string,
  orgId: string,
  date: Date = new Date()
): Promise<PilotRecommendation | null> {
  const existing = await getDailyRecommendation(userId, orgId, date);
  if (existing) return existing;

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const [monthData, balance, recurring, emotionalCheckin, yesterdayRec, avgByWeekday] =
    await Promise.all([
      loadMonthTransactions(userId, monthStart, monthEnd),
      loadBalance(userId),
      loadRecurringMonthlyTotal(userId),
      getEmotionalCheckin(userId, date),
      getYesterdayRecommendation(userId, date),
      averageExpenseByWeekday(userId, date, 90),
    ]);

  const yesterday = subDays(date, 1);
  const yesterdayExpense = await getYesterdayExpense(userId, yesterday);
  const debtDueSoon = await debtDueWithinDays(userId, date, 7);

  const incomeMonth = monthData.income;
  const expenseMonth = monthData.expense;
  const margin = balance;
  const dayOfMonth = getDate(date);
  const isWeekendDay = isWeekend(date);
  const weekday = getDay(date);
  const emotionalNegative =
    emotionalCheckin != null &&
    /estresad|ansios|mal|preocupad|triste|enojad/i.test(emotionalCheckin);

  const state = classifyState(
    margin,
    incomeMonth,
    expenseMonth,
    dayOfMonth,
    isWeekendDay,
    weekday,
    avgByWeekday,
    debtDueSoon,
    yesterdayRec,
    yesterdayExpense,
    emotionalNegative
  );

  const preQuincena = dayOfMonth >= 25 || dayOfMonth <= 5;
  const ratio = incomeMonth > 0 ? expenseMonth / incomeMonth : 0;
  const overallAvg =
    Object.values(avgByWeekday).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(avgByWeekday).length);
  const todayWeekdayAvg = avgByWeekday[weekday] ?? 0;
  const highRiskImpulsive =
    overallAvg > 0 && todayWeekdayAvg >= overallAvg * IMPULSIVE_DAY_MULTIPLIER;

  const message_main = pickMainMessage(state, emotionalNegative);
  const message_why = pickWhyMessage(state, preQuincena, highRiskImpulsive, ratio);
  const suggested_limit = getSuggestedLimit(state);
  const suggested_action = getSuggestedAction(state);
  const flexibility = getFlexibility(state);

  const signals_snapshot: PilotSignalsSnapshot = {
    day_of_month: dayOfMonth,
    is_weekend: isWeekendDay,
    pre_quincena: preQuincena,
    post_quincena: (dayOfMonth >= 14 && dayOfMonth <= 17) || dayOfMonth >= 28,
    margin,
    income_month: incomeMonth,
    expense_month: expenseMonth,
    ratio_expense_income: incomeMonth > 0 ? ratio : undefined,
    high_risk_impulsive_day: highRiskImpulsive,
    followed_recommendation_yesterday:
      yesterdayRec?.state === 'CONTAINMENT' && yesterdayExpense < MARGIN_CONTAINMENT_MAX * 2,
    debt_due_soon: debtDueSoon,
    emotional_checkin: emotionalCheckin ?? undefined,
  };

  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: inserted, error } = await supabase
    .from('pilot_daily_recommendations')
    .insert({
      user_id: userId,
      org_id: orgId,
      recommendation_date: dateStr,
      state,
      message_main,
      message_why,
      suggested_limit,
      suggested_action,
      flexibility,
      signals_snapshot: signals_snapshot as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (error) {
    console.warn('[pilot] insert recommendation error', error);
    return null;
  }

  const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');
  if (signals_snapshot.followed_recommendation_yesterday) {
    awardPoints(orgId, userId, 'RECOMMENDATION_FOLLOWED', 'pilot_followed', yesterdayStr);
  }
  if (yesterdayRec?.state === 'CONTAINMENT' && !signals_snapshot.followed_recommendation_yesterday) {
    awardPoints(orgId, userId, 'RESCUE', 'pilot_rescue', yesterdayStr);
  }

  return inserted as PilotRecommendation;
}

export async function saveEmotionalCheckin(
  userId: string,
  date: Date,
  value: string
): Promise<boolean> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { error } = await supabase
    .from('pilot_emotional_checkins')
    .upsert(
      { user_id: userId, checkin_date: dateStr, value: value.trim().slice(0, 100) },
      { onConflict: 'user_id,checkin_date' }
    );
  if (error) {
    console.warn('[pilot] saveEmotionalCheckin error', error);
    return false;
  }
  return true;
}
