export type AppRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'EMPLOYEE';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  linking_code: string | null;
}

/** Resultado de validate_linking_code(p_code) */
export interface ValidateLinkingCodeRow {
  valid: boolean;
  org_name: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  org_id: string | null;
  role: AppRole;
  start_date: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  /** Set when default categories/accounts were seeded (first login). Avoids re-seeding on every load. */
  defaults_seeded_at?: string | null;
}

export interface OrgSubscription {
  org_id: string;
  status: SubscriptionStatus;
  seats_total: number;
  seats_used: number;
  period_start: string | null;
  period_end: string | null;
  updated_at: string;
}

export function isSubscriptionValid(
  status: SubscriptionStatus,
  periodEnd: string | null
): boolean {
  if (status === 'active') return true;
  if (status === 'trial') {
    // Sin period_end = trial sin fecha de fin (válido). Con period_end = válido si no ha vencido.
    if (!periodEnd) return true;
    return new Date(periodEnd) >= new Date();
  }
  return false;
}

export interface SavingsGoal {
  id: string;
  account_id: string;
  target_amount: number;
  name: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalWithProgress {
  accountId: string;
  accountName: string;
  goalName: string | null;
  targetAmount: number;
  currentBalance: number;
  progressPct: number;
  goalId: string;
}

export interface FinancialPersonalityResult {
  id: string;
  user_id: string;
  org_id: string;
  dominant_personality: 'analitico' | 'impulsivo' | 'temeroso' | 'derrochador';
  secondary_personality: 'analitico' | 'impulsivo' | 'temeroso' | 'derrochador' | null;
  scores: string; // JSON stringified
  completed_at: string;
  created_at: string;
}
