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
import {
  listDocuments,
  createDocument,
  updateDocument,
  COLLECTIONS,
  Query,
  ID,
  type AppwriteDocument,
} from '@/lib/appwrite';
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
  _orgId: string,
  date: Date
): Promise<PilotRecommendation | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  try {
    const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.pilot_daily_recommendations, [
      Query.equal('user_id', [userId]),
      Query.equal('recommendation_date', [dateStr]),
      Query.limit(1),
    ]);
    const doc = data[0];
    if (!doc) return null;
    return doc as unknown as PilotRecommendation;
  } catch {
    return null;
  }
}

async function loadMonthTransactions(
  userId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<{ income: number; expense: number; rows: { kind: string; amount: number; occurred_at: string }[] }> {
  const startIso = monthStart.toISOString();
  const endIso = monthEnd.toISOString();
  try {
    const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
      Query.equal('user_id', [userId]),
      Query.greaterThanEqual('occurred_at', startIso),
      Query.lessThanEqual('occurred_at', endIso),
      Query.limit(500),
    ]);
    const rows = (data ?? []).filter((r) => !(r as AppwriteDocument).is_recurring);
    let income = 0;
    let expense = 0;
    rows.forEach((r) => {
      const doc = r as AppwriteDocument;
      const amt = Number(doc.amount);
      if (doc.kind === 'INCOME') income += amt;
      else if (doc.kind === 'EXPENSE') expense += amt;
    });
    return {
      income,
      expense,
      rows: rows.map((r) => ({
        kind: (r as AppwriteDocument).kind as string,
        amount: Number((r as AppwriteDocument).amount),
        occurred_at: (r as AppwriteDocument).occurred_at as string,
      })),
    };
  } catch {
    return { income: 0, expense: 0, rows: [] };
  }
}

async function loadBalance(userId: string): Promise<number> {
  const { data: accounts } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
    Query.equal('user_id', [userId]),
    Query.limit(200),
  ]);
  let balance = 0;
  (accounts ?? []).forEach((a) => {
    const doc = a as AppwriteDocument;
    const bal = Number(doc.opening_balance);
    balance += (doc.type === 'CREDIT' || doc.type === 'CREDIT_CARD') ? -bal : bal;
  });
  const { data: allTx } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
    Query.equal('user_id', [userId]),
    Query.limit(2000),
  ]);
  (allTx ?? []).forEach((t) => {
    const doc = t as AppwriteDocument;
    const amt = Number(doc.amount);
    if (doc.kind === 'INCOME') balance += amt;
    else if (doc.kind === 'EXPENSE') balance -= amt;
  });
  return balance;
}

async function loadRecurringMonthlyTotal(userId: string): Promise<number> {
  const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
    Query.equal('user_id', [userId]),
    Query.equal('is_recurring', [true]),
    Query.limit(200),
  ]);
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  let total = 0;
  (data ?? []).forEach((r) => {
    const doc = r as AppwriteDocument;
    if (doc.kind !== 'EXPENSE') return;
    const totalOcc = doc.recurrence_total_occurrences as number | null | undefined;
    if (totalOcc != null) {
      const start = startOfMonth(new Date(doc.occurred_at as string));
      const occurrenceIndex = differenceInMonths(currentMonthStart, start) + 1;
      if (occurrenceIndex > totalOcc) return;
    }
    const interval = (doc.recurrence_interval_months as number) ?? 1;
    total += Math.round((Number(doc.amount) / interval) * 100) / 100;
  });
  return total;
}

async function debtDueWithinDays(userId: string, fromDate: Date, days: number): Promise<boolean> {
  const { data: accounts } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
    Query.equal('user_id', [userId]),
    Query.limit(200),
  ]);
  const creditAccounts = (accounts ?? []).filter(
    (a) => (a as AppwriteDocument).type === 'CREDIT' || (a as AppwriteDocument).type === 'CREDIT_CARD'
  );
  if (!creditAccounts.length) return false;
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (const a of creditAccounts) {
    const doc = a as AppwriteDocument;
    const paymentDay = doc.payment_day as number | null | undefined;
    if (paymentDay == null) continue;
    const day = Math.min(paymentDay, 28);
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
  const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
    Query.equal('user_id', [userId]),
    Query.equal('kind', ['EXPENSE']),
    Query.greaterThanEqual('occurred_at', start.toISOString()),
    Query.limit(500),
  ]);
  const byWeekday: Record<number, { sum: number; count: number }> = {};
  for (let d = 0; d <= 6; d++) byWeekday[d] = { sum: 0, count: 0 };
  (data ?? []).forEach((r) => {
    const doc = r as AppwriteDocument;
    if (doc.is_recurring) return;
    const day = getDay(new Date(doc.occurred_at as string));
    byWeekday[day].sum += Number(doc.amount);
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
  const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.pilot_emotional_checkins, [
    Query.equal('user_id', [userId]),
    Query.equal('checkin_date', [dateStr]),
    Query.limit(1),
  ]);
  const doc = data[0];
  return (doc as AppwriteDocument)?.value as string | null ?? null;
}

async function getYesterdayRecommendation(userId: string, today: Date): Promise<{ state: PilotDayState; suggested_limit: string } | null> {
  const yesterday = subDays(today, 1);
  const dateStr = format(yesterday, 'yyyy-MM-dd');
  const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.pilot_daily_recommendations, [
    Query.equal('user_id', [userId]),
    Query.equal('recommendation_date', [dateStr]),
    Query.limit(1),
  ]);
  const doc = data[0];
  return doc ? { state: (doc as AppwriteDocument).state as PilotDayState, suggested_limit: (doc as AppwriteDocument).suggested_limit as string } : null;
}

async function getYesterdayExpense(userId: string, yesterday: Date): Promise<number> {
  const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
  const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
  const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
    Query.equal('user_id', [userId]),
    Query.equal('kind', ['EXPENSE']),
    Query.greaterThanEqual('occurred_at', start.toISOString()),
    Query.lessThanEqual('occurred_at', end.toISOString()),
    Query.limit(100),
  ]);
  let sum = 0;
  (data ?? []).filter((r) => !(r as AppwriteDocument).is_recurring).forEach((r) => {
    sum += Number((r as AppwriteDocument).amount);
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
  let inserted: AppwriteDocument;
  try {
    const doc = await createDocument(
      COLLECTIONS.pilot_daily_recommendations,
      {
        user_id: userId,
        org_id: orgId,
        recommendation_date: dateStr,
        state,
        message_main,
        message_why,
        suggested_limit,
        suggested_action,
        flexibility,
        signals_snapshot: JSON.stringify(signals_snapshot),
        created_at: new Date().toISOString(),
      },
      ID.unique()
    );
    inserted = doc as AppwriteDocument;
  } catch (e) {
    console.warn('[pilot] insert recommendation error', e);
    return null;
  }

  const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');
  if (signals_snapshot.followed_recommendation_yesterday) {
    awardPoints(orgId, userId, 'RECOMMENDATION_FOLLOWED', 'pilot_followed', yesterdayStr);
  }
  if (yesterdayRec?.state === 'CONTAINMENT' && !signals_snapshot.followed_recommendation_yesterday) {
    awardPoints(orgId, userId, 'RESCUE', 'pilot_rescue', yesterdayStr);
  }

  return inserted as unknown as PilotRecommendation;
}

export async function saveEmotionalCheckin(
  userId: string,
  date: Date,
  value: string
): Promise<boolean> {
  const dateStr = format(date, 'yyyy-MM-dd');
  try {
    const { data: existing } = await listDocuments<AppwriteDocument>(COLLECTIONS.pilot_emotional_checkins, [
      Query.equal('user_id', [userId]),
      Query.equal('checkin_date', [dateStr]),
      Query.limit(1),
    ]);
    const doc = existing[0];
    const payload = { value: value.trim().slice(0, 100) };
    if (doc) {
      await updateDocument(COLLECTIONS.pilot_emotional_checkins, (doc as AppwriteDocument).$id!, payload);
    } else {
      await createDocument(
        COLLECTIONS.pilot_emotional_checkins,
        { user_id: userId, checkin_date: dateStr, ...payload },
        ID.unique()
      );
    }
    return true;
  } catch (e) {
    console.warn('[pilot] saveEmotionalCheckin error', e);
    return false;
  }
}
