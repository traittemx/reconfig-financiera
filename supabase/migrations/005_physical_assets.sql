-- Patrimonio Líquido: inventario de bienes físicos (nombre + monto por usuario)

CREATE TABLE physical_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_physical_assets_user_org ON physical_assets(user_id, org_id);

ALTER TABLE physical_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_physical_assets" ON physical_assets FOR ALL USING (is_super_admin());
CREATE POLICY "user_own_physical_assets" ON physical_assets FOR ALL USING (is_same_user(user_id));
