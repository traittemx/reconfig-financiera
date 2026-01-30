-- Org-level pilot aggregates (no individual data, no amounts). RLS: org_admin reads own org, super_admin all.

CREATE TABLE org_pilot_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  total_users_with_recommendation int NOT NULL DEFAULT 0,
  total_recommendations int NOT NULL DEFAULT 0,
  count_safe int NOT NULL DEFAULT 0,
  count_caution int NOT NULL DEFAULT 0,
  count_containment int NOT NULL DEFAULT 0,
  count_reward int NOT NULL DEFAULT 0,
  pct_safe numeric,
  pct_caution numeric,
  pct_containment numeric,
  pct_reward numeric,
  follow_count int NOT NULL DEFAULT 0,
  containment_count_for_follow int NOT NULL DEFAULT 0,
  avg_follow_rate numeric,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (org_id, period)
);

CREATE INDEX idx_org_pilot_aggregates_org_period ON org_pilot_aggregates(org_id, period);

ALTER TABLE org_pilot_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admin_read_own_org_pilot_aggregates" ON org_pilot_aggregates
  FOR SELECT USING (is_org_admin_of(org_id));

CREATE POLICY "super_admin_all_org_pilot_aggregates" ON org_pilot_aggregates
  FOR ALL USING (is_super_admin());

-- Function to refresh aggregates for a given org and period (SECURITY DEFINER, called by super_admin or cron)
CREATE OR REPLACE FUNCTION refresh_org_pilot_aggregates(
  p_org_id uuid,
  p_period text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_users int;
  v_safe int;
  v_caution int;
  v_containment int;
  v_reward int;
  v_follow int;
  v_containment_for_follow int;
BEGIN
  IF NOT (is_super_admin() OR is_org_admin_of(p_org_id)) THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(DISTINCT user_id),
    COUNT(*) FILTER (WHERE state = 'SAFE'),
    COUNT(*) FILTER (WHERE state = 'CAUTION'),
    COUNT(*) FILTER (WHERE state = 'CONTAINMENT'),
    COUNT(*) FILTER (WHERE state = 'REWARD')
  INTO v_total, v_users, v_safe, v_caution, v_containment, v_reward
  FROM pilot_daily_recommendations
  WHERE org_id = p_org_id AND recommendation_date::text LIKE p_period || '%';

  SELECT COUNT(*)
  INTO v_follow
  FROM points_events
  WHERE org_id = p_org_id AND event_key = 'RECOMMENDATION_FOLLOWED'
    AND ref_table = 'pilot_followed' AND ref_id LIKE p_period || '%';

  v_containment_for_follow := (
    SELECT COUNT(*) FROM pilot_daily_recommendations
    WHERE org_id = p_org_id AND state = 'CONTAINMENT' AND recommendation_date::text LIKE p_period || '%'
  );

  INSERT INTO org_pilot_aggregates (
    org_id, period, total_users_with_recommendation, total_recommendations,
    count_safe, count_caution, count_containment, count_reward,
    pct_safe, pct_caution, pct_containment, pct_reward,
    follow_count, containment_count_for_follow, avg_follow_rate, updated_at
  ) VALUES (
    p_org_id, p_period, v_users, v_total,
    v_safe, v_caution, v_containment, v_reward,
    CASE WHEN v_total > 0 THEN ROUND(100.0 * v_safe / v_total, 2) END,
    CASE WHEN v_total > 0 THEN ROUND(100.0 * v_caution / v_total, 2) END,
    CASE WHEN v_total > 0 THEN ROUND(100.0 * v_containment / v_total, 2) END,
    CASE WHEN v_total > 0 THEN ROUND(100.0 * v_reward / v_total, 2) END,
    v_follow, v_containment_for_follow,
    CASE WHEN v_containment_for_follow > 0 THEN ROUND(100.0 * v_follow / v_containment_for_follow, 2) END,
    now()
  )
  ON CONFLICT (org_id, period) DO UPDATE SET
    total_users_with_recommendation = EXCLUDED.total_users_with_recommendation,
    total_recommendations = EXCLUDED.total_recommendations,
    count_safe = EXCLUDED.count_safe,
    count_caution = EXCLUDED.count_caution,
    count_containment = EXCLUDED.count_containment,
    count_reward = EXCLUDED.count_reward,
    pct_safe = EXCLUDED.pct_safe,
    pct_caution = EXCLUDED.pct_caution,
    pct_containment = EXCLUDED.pct_containment,
    pct_reward = EXCLUDED.pct_reward,
    follow_count = EXCLUDED.follow_count,
    containment_count_for_follow = EXCLUDED.containment_count_for_follow,
    avg_follow_rate = EXCLUDED.avg_follow_rate,
    updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_org_pilot_aggregates(uuid, text) TO authenticated;
