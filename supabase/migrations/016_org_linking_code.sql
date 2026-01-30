-- Código de vinculación por organización para registro de usuarios
-- Run after 015_lesson_audio.sql

-- ============= organizations.linking_code =============
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS linking_code text UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_linking_code ON organizations(linking_code) WHERE linking_code IS NOT NULL;

-- ============= RPC: validar código (anon/authenticated) =============
CREATE OR REPLACE FUNCTION validate_linking_code(p_code text)
RETURNS TABLE(valid boolean, org_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;
  SELECT id, name INTO v_org_id, v_org_name
  FROM organizations
  WHERE linking_code = trim(p_code)
  LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_org_name;
  ELSE
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_linking_code(text) TO anon;
GRANT EXECUTE ON FUNCTION validate_linking_code(text) TO authenticated;

-- ============= RPC: unir usuario a org con código (solo authenticated) =============
CREATE OR REPLACE FUNCTION join_org_with_code(p_code text, p_full_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_org_name text;
  v_seats_used int;
  v_seats_total int;
  v_already_member boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'CODE_INVALID:Código de vinculación inválido';
  END IF;

  SELECT id, name INTO v_org_id, v_org_name
  FROM organizations
  WHERE linking_code = trim(p_code)
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'CODE_INVALID:Código de vinculación inválido';
  END IF;

  SELECT seats_used, seats_total INTO v_seats_used, v_seats_total
  FROM org_subscriptions
  WHERE org_id = v_org_id;

  IF v_seats_used >= v_seats_total THEN
    RAISE EXCEPTION 'NO_SEATS:No hay plazas disponibles en esta empresa';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_org_id AND user_id = v_uid AND status = 'active'
  ) INTO v_already_member;

  IF v_already_member THEN
    RAISE EXCEPTION 'ALREADY_MEMBER:Ya perteneces a esta empresa';
  END IF;

  INSERT INTO org_members (org_id, user_id, role_in_org, status)
  VALUES (v_org_id, v_uid, 'EMPLOYEE', 'active')
  ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active', role_in_org = 'EMPLOYEE';

  UPDATE profiles
  SET
    org_id = v_org_id,
    role = 'EMPLOYEE',
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    start_date = COALESCE(start_date, current_date),
    updated_at = now()
  WHERE id = v_uid;

  UPDATE org_subscriptions
  SET seats_used = (
    SELECT count(*)::int FROM org_members WHERE org_id = v_org_id AND status = 'active'
  )
  WHERE org_id = v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION join_org_with_code(text, text) TO authenticated;
