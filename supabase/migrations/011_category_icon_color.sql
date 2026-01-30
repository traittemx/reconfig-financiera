-- Add icon and color columns to categories for custom appearance
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color text;

-- Update seed_default_categories to include unique icons and colors for each default category
CREATE OR REPLACE FUNCTION seed_default_categories(p_org_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT (is_same_user(p_user_id) OR is_org_admin_of(p_org_id) OR is_super_admin()) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM categories WHERE org_id = p_org_id AND user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO categories (org_id, user_id, kind, name, is_default, icon, color) VALUES
  (p_org_id, p_user_id, 'EXPENSE', 'Alimentación', true, 'UtensilsCrossed', '#e11d48'),
  (p_org_id, p_user_id, 'EXPENSE', 'Transporte', true, 'Car', '#2563eb'),
  (p_org_id, p_user_id, 'EXPENSE', 'Vivienda', true, 'Home', '#16a34a'),
  (p_org_id, p_user_id, 'EXPENSE', 'Salud', true, 'HeartPulse', '#dc2626'),
  (p_org_id, p_user_id, 'EXPENSE', 'Entretenimiento', true, 'Gamepad2', '#7c3aed'),
  (p_org_id, p_user_id, 'EXPENSE', 'Educación', true, 'GraduationCap', '#ea580c'),
  (p_org_id, p_user_id, 'EXPENSE', 'Otros gastos', true, 'Receipt', '#64748b'),
  (p_org_id, p_user_id, 'INCOME', 'Nómina', true, 'Wallet', '#0d9488'),
  (p_org_id, p_user_id, 'INCOME', 'Freelance', true, 'Briefcase', '#be185d'),
  (p_org_id, p_user_id, 'INCOME', 'Otros ingresos', true, 'DollarSign', '#0891b2');
END;
$$;
