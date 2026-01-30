-- Savings goals for SAVINGS-type accounts. One goal per account.

CREATE TABLE savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  name text,
  target_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_savings_goals_account_id ON savings_goals(account_id);

-- Only SAVINGS accounts may have a goal
CREATE OR REPLACE FUNCTION check_savings_goal_account_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT type FROM accounts WHERE id = NEW.account_id) != 'SAVINGS' THEN
    RAISE EXCEPTION 'savings_goals can only be set for accounts of type SAVINGS';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER savings_goals_account_type_trigger
  BEFORE INSERT OR UPDATE OF account_id ON savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION check_savings_goal_account_type();

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_savings_goals" ON savings_goals
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = savings_goals.account_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = savings_goals.account_id AND a.user_id = auth.uid())
  );

CREATE POLICY "super_admin_all_savings_goals" ON savings_goals
  FOR ALL
  USING (is_super_admin());
