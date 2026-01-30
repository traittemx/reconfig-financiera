export type PilotDayState = 'SAFE' | 'CAUTION' | 'CONTAINMENT' | 'REWARD';

export interface PilotRecommendation {
  id: string;
  user_id: string;
  org_id: string;
  recommendation_date: string;
  state: PilotDayState;
  message_main: string;
  message_why: string;
  suggested_limit: string;
  suggested_action: string | null;
  flexibility: 'bajo' | 'medio' | 'alto' | null;
  signals_snapshot: PilotSignalsSnapshot | null;
  created_at: string;
}

export interface PilotSignalsSnapshot {
  day_of_month?: number;
  is_weekend?: boolean;
  pre_quincena?: boolean;
  post_quincena?: boolean;
  margin?: number;
  income_month?: number;
  expense_month?: number;
  ratio_expense_income?: number;
  high_risk_impulsive_day?: boolean;
  followed_recommendation_yesterday?: boolean;
  debt_due_soon?: boolean;
  emotional_checkin?: string | null;
}

export interface PilotRecommendationInput {
  state: PilotDayState;
  message_main: string;
  message_why: string;
  suggested_limit: string;
  suggested_action: string | null;
  flexibility: 'bajo' | 'medio' | 'alto';
  signals_snapshot: PilotSignalsSnapshot | null;
}
