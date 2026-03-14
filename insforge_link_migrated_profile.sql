-- Link migrated profile: rekey profile from legacy (Appwrite) id to new InsForge auth user id.
-- Call from app after lookup by email (auth_migration) so the authenticated user gets their migrated profile.
-- Tables with user_id FK to profiles (all updated): org_members, user_lesson_progress, accounts, categories,
-- transactions, points_events, points_totals, physical_assets, pilot_daily_recommendations, pilot_emotional_checkins,
-- budgets, budget_safe_style_expenses, cash_flow_income, financial_personality_results, financial_archetype_results,
-- income_sources, inventory_items, transaction_labels.

CREATE OR REPLACE FUNCTION link_migrated_profile(p_old_id UUID, p_new_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_old_id = p_new_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_old_id) THEN
    RAISE EXCEPTION 'profile not found for legacy id %', p_old_id;
  END IF;

  -- 1) Copy profile row with new id
  INSERT INTO profiles (id, full_name, org_id, role, start_date, avatar_url, created_at, updated_at, defaults_seeded_at)
  SELECT p_new_id, full_name, org_id, role, start_date, avatar_url, created_at, updated_at, defaults_seeded_at
  FROM profiles WHERE id = p_old_id;

  -- 2) Update all tables that reference profiles(id) via user_id
  UPDATE org_members SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE user_lesson_progress SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE accounts SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE categories SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE transactions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE points_events SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE points_totals SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE physical_assets SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE pilot_daily_recommendations SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE pilot_emotional_checkins SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE budgets SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE budget_safe_style_expenses SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE cash_flow_income SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE financial_personality_results SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE financial_archetype_results SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE income_sources SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE inventory_items SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE transaction_labels SET user_id = p_new_id WHERE user_id = p_old_id;

  -- 3) Remove old profile row
  DELETE FROM profiles WHERE id = p_old_id;

  -- 4) Mark as linked in auth_migration
  UPDATE auth_migration SET linked_at = CURRENT_TIMESTAMP WHERE legacy_auth_id = p_old_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper: look up legacy_auth_id by email and call link_migrated_profile. Returns legacy_auth_id if linked, NULL if no row or already linked.
CREATE OR REPLACE FUNCTION try_link_migrated_profile_by_email(p_email TEXT, p_new_id UUID)
RETURNS UUID AS $$
DECLARE
  v_old_id UUID;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT legacy_auth_id INTO v_old_id
  FROM auth_migration
  WHERE LOWER(trim(email)) = LOWER(trim(p_email))
    AND linked_at IS NULL
  LIMIT 1;

  IF v_old_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM link_migrated_profile(v_old_id, p_new_id);
  RETURN v_old_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
