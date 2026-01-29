-- Reprogramación Financiera B2B - Seed: lessons 1..23, points_rules, seed_default_categories RPC
-- Run after 001_initial.sql

-- ============= LESSONS 1..23 (placeholders) =============
INSERT INTO lessons (day, title, summary, mission, content) VALUES
(1, 'Día 1: Tu punto de partida', 'Resumen día 1', 'Misión día 1: Define tu situación actual', '{}'),
(2, 'Día 2: Mentalidad financiera', 'Resumen día 2', 'Misión día 2: Identifica creencias limitantes', '{}'),
(3, 'Día 3: Ingresos y gastos', 'Resumen día 3', 'Misión día 3: Registra todo durante una semana', '{}'),
(4, 'Día 4: El presupuesto base', 'Resumen día 4', 'Misión día 4: Crea tu primer presupuesto', '{}'),
(5, 'Día 5: Deudas y prioridades', 'Resumen día 5', 'Misión día 5: Lista todas tus deudas', '{}'),
(6, 'Día 6: Ahorro automático', 'Resumen día 6', 'Misión día 6: Configura un ahorro recurrente', '{}'),
(7, 'Día 7: Fondo de emergencia', 'Resumen día 7', 'Misión día 7: Define tu meta de fondo de emergencia', '{}'),
(8, 'Día 8: Cuentas y organización', 'Resumen día 8', 'Misión día 8: Organiza tus cuentas en la app', '{}'),
(9, 'Día 9: Categorías que funcionan', 'Resumen día 9', 'Misión día 9: Revisa y ajusta categorías', '{}'),
(10, 'Día 10: Revisión semanal', 'Resumen día 10', 'Misión día 10: Revisa tu semana y ajusta', '{}'),
(11, 'Día 11: Fuentes extra de ingreso', 'Resumen día 11', 'Misión día 11: Identifica una fuente extra', '{}'),
(12, 'Día 12: Gastos hormiga', 'Resumen día 12', 'Misión día 12: Elimina un gasto hormiga', '{}'),
(13, 'Día 13: Metas a corto plazo', 'Resumen día 13', 'Misión día 13: Define una meta a 3 meses', '{}'),
(14, 'Día 14: Metas a mediano plazo', 'Resumen día 14', 'Misión día 14: Define una meta a 1 año', '{}'),
(15, 'Día 15: Inversión básica', 'Resumen día 15', 'Misión día 15: Investiga una opción de inversión', '{}'),
(16, 'Día 16: Seguros y protección', 'Resumen día 16', 'Misión día 16: Revisa tus coberturas', '{}'),
(17, 'Día 17: Impuestos y deducciones', 'Resumen día 17', 'Misión día 17: Revisa tu situación fiscal', '{}'),
(18, 'Día 18: Negociar y optimizar', 'Resumen día 18', 'Misión día 18: Negocia un gasto fijo', '{}'),
(19, 'Día 19: Hábitos de ahorro', 'Resumen día 19', 'Misión día 19: Implementa un hábito nuevo', '{}'),
(20, 'Día 20: Revisión de medio curso', 'Resumen día 20', 'Misión día 20: Revisión completa y ajustes', '{}'),
(21, 'Día 21: Plan a 5 años', 'Resumen día 21', 'Misión día 21: Bosqueja tu plan a 5 años', '{}'),
(22, 'Día 22: Legado y herencia', 'Resumen día 22', 'Misión día 22: Documenta tus cuentas clave', '{}'),
(23, 'Día 23: Tu nuevo sistema', 'Resumen día 23', 'Misión día 23: Consolida tu sistema financiero', '{}')
ON CONFLICT (day) DO NOTHING;

-- ============= POINTS_RULES =============
INSERT INTO points_rules (key, points, is_active) VALUES
('CREATE_EXPENSE', 10, true),
('CREATE_INCOME', 10, true),
('CREATE_ACCOUNT', 15, true),
('CREATE_CATEGORY', 15, true),
('CREATE_BUDGET', 20, true),
('LESSON_COMPLETED', 50, true),
('MISSION_COMPLETED', 30, true),
('CREATE_INCOME_SOURCE', 25, true),
('STREAK_5_DAYS', 100, true)
ON CONFLICT (key) DO UPDATE SET points = EXCLUDED.points, is_active = EXCLUDED.is_active;

-- ============= RPC: seed_default_categories =============
CREATE OR REPLACE FUNCTION seed_default_categories(p_org_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_id uuid;
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

  INSERT INTO categories (org_id, user_id, kind, name, is_default) VALUES
  (p_org_id, p_user_id, 'EXPENSE', 'Alimentación', true),
  (p_org_id, p_user_id, 'EXPENSE', 'Transporte', true),
  (p_org_id, p_user_id, 'EXPENSE', 'Vivienda', true),
  (p_org_id, p_user_id, 'EXPENSE', 'Salud', true),
  (p_org_id, p_user_id, 'EXPENSE', 'Entretenimiento', true),
  (p_org_id, p_user_id, 'EXPENSE', 'Educación', true),
  (p_org_id, p_user_id, 'EXPENSE', 'Otros gastos', true),
  (p_org_id, p_user_id, 'INCOME', 'Nómina', true),
  (p_org_id, p_user_id, 'INCOME', 'Freelance', true),
  (p_org_id, p_user_id, 'INCOME', 'Otros ingresos', true);
END;
$$;

GRANT EXECUTE ON FUNCTION seed_default_categories(uuid, uuid) TO authenticated;
