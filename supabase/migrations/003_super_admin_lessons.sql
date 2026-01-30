-- Super admin: manage lessons (INSERT/UPDATE/DELETE) and optional bootstrap for first super admin
-- Run after 001_initial.sql and 002_add_account_type_credit.sql

-- ============= LESSONS: super admin can manage =============
CREATE POLICY "super_admin_manage_lessons" ON lessons FOR ALL USING (is_super_admin());

-- ============= OPTIONAL: bootstrap first super admin =============
-- Only allows setting SUPER_ADMIN if no super admin exists yet (one-time bootstrap).
CREATE OR REPLACE FUNCTION set_first_super_admin(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1) THEN
    RETURN;
  END IF;
  UPDATE profiles
  SET role = 'SUPER_ADMIN'
  WHERE id = (SELECT id FROM auth.users WHERE email = trim(p_email) LIMIT 1);
END;
$$;

GRANT EXECUTE ON FUNCTION set_first_super_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_first_super_admin(text) TO service_role;
