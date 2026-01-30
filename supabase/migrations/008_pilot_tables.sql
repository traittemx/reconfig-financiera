-- Piloto Financiero Inteligente: daily recommendations and emotional check-ins
-- One row per (user_id, date); RLS: user and super_admin only.

-- ============= ENUM =============
CREATE TYPE pilot_day_state AS ENUM ('SAFE', 'CAUTION', 'CONTAINMENT', 'REWARD');

-- ============= TABLES =============
CREATE TABLE pilot_daily_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recommendation_date date NOT NULL,
  state pilot_day_state NOT NULL,
  message_main text NOT NULL,
  message_why text NOT NULL,
  suggested_limit text NOT NULL,
  suggested_action text,
  flexibility text CHECK (flexibility IN ('bajo', 'medio', 'alto')),
  signals_snapshot jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, recommendation_date)
);

CREATE TABLE pilot_emotional_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, checkin_date)
);

-- ============= INDEXES =============
CREATE INDEX idx_pilot_daily_recommendations_user_date ON pilot_daily_recommendations(user_id, recommendation_date);
CREATE INDEX idx_pilot_daily_recommendations_org_date ON pilot_daily_recommendations(org_id, recommendation_date);
CREATE INDEX idx_pilot_emotional_checkins_user_date ON pilot_emotional_checkins(user_id, checkin_date);

-- ============= RLS =============
ALTER TABLE pilot_daily_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_emotional_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_pilot_recommendations" ON pilot_daily_recommendations
  FOR ALL USING (is_same_user(user_id));

CREATE POLICY "super_admin_all_pilot_recommendations" ON pilot_daily_recommendations
  FOR ALL USING (is_super_admin());

CREATE POLICY "user_own_pilot_checkins" ON pilot_emotional_checkins
  FOR ALL USING (is_same_user(user_id));

CREATE POLICY "super_admin_all_pilot_checkins" ON pilot_emotional_checkins
  FOR ALL USING (is_super_admin());
