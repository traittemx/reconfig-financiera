-- Update seed_default_categories with new category list and add seed_default_accounts

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
  (p_org_id, p_user_id, 'INCOME', 'Salario', true, 'Wallet', '#0d9488'),
  (p_org_id, p_user_id, 'INCOME', 'Otros ingresos', true, 'DollarSign', '#0891b2'),
  (p_org_id, p_user_id, 'EXPENSE', 'Comida', true, 'UtensilsCrossed', '#e11d48'),
  (p_org_id, p_user_id, 'EXPENSE', 'Transporte', true, 'Car', '#2563eb'),
  (p_org_id, p_user_id, 'EXPENSE', 'Diversión', true, 'Gamepad2', '#7c3aed'),
  (p_org_id, p_user_id, 'EXPENSE', 'Renta', true, 'Home', '#16a34a'),
  (p_org_id, p_user_id, 'EXPENSE', 'Gasolina', true, 'Zap', '#ea580c'),
  (p_org_id, p_user_id, 'EXPENSE', 'Salud', true, 'HeartPulse', '#dc2626'),
  (p_org_id, p_user_id, 'EXPENSE', 'Entretenimiento', true, 'Gamepad2', '#7c3aed'),
  (p_org_id, p_user_id, 'EXPENSE', 'Streaming', true, 'Music', '#0891b2'),
  (p_org_id, p_user_id, 'EXPENSE', 'Viajes', true, 'Plane', '#0d9488'),
  (p_org_id, p_user_id, 'EXPENSE', 'Café', true, 'Coffee', '#ca8a04'),
  (p_org_id, p_user_id, 'EXPENSE', 'Libros', true, 'BookOpen', '#65a30d'),
  (p_org_id, p_user_id, 'EXPENSE', 'Regalos', true, 'Gift', '#be185d');
END;
$$;

CREATE OR REPLACE FUNCTION seed_default_accounts(p_org_id uuid, p_user_id uuid)
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

  IF EXISTS (SELECT 1 FROM accounts WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO accounts (user_id, org_id, name, type, currency, opening_balance)
  VALUES (p_user_id, p_org_id, 'Efectivo', 'CASH', 'MXN', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION seed_default_accounts(uuid, uuid) TO authenticated;
