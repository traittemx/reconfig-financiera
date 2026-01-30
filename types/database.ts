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
  if (status === 'trial' && periodEnd) {
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
