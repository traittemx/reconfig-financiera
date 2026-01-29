-- Reprogramación Financiera B2B - Initial schema, RLS, award_points, triggers
-- Run in Supabase SQL Editor or via supabase db push

-- ============= ENUMS =============
CREATE TYPE app_role AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'EMPLOYEE');
CREATE TYPE org_member_role AS ENUM ('ORG_ADMIN', 'EMPLOYEE');
CREATE TYPE org_member_status AS ENUM ('active', 'disabled');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled');
CREATE TYPE account_type AS ENUM ('CASH', 'BANK', 'CARD', 'SAVINGS', 'INVESTMENT');
CREATE TYPE transaction_kind AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE category_kind AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- ============= TABLES (order respects FKs) =============
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  role app_role NOT NULL DEFAULT 'EMPLOYEE',
  start_date date,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE org_members (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_org org_member_role NOT NULL,
  status org_member_status NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (org_id, user_id),
  UNIQUE (org_id, user_id)
);

CREATE TABLE org_subscriptions (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'trial',
  seats_total int NOT NULL DEFAULT 10,
  seats_used int NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role org_member_role NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE lessons (
  day int PRIMARY KEY CHECK (day >= 1 AND day <= 23),
  title text NOT NULL,
  summary text,
  mission text,
  content jsonb DEFAULT '{}'
);

CREATE TABLE user_lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day int NOT NULL REFERENCES lessons(day) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unlocked_at timestamptz,
  completed_at timestamptz,
  notes text,
  PRIMARY KEY (user_id, day),
  UNIQUE (user_id, day)
);

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type account_type NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  opening_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind category_kind NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind transaction_kind NOT NULL,
  amount numeric NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  note text,
  transfer_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT budgets_month_format CHECK (month ~ '^\d{4}-\d{2}$')
);

CREATE TABLE budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  limit_amount numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE points_rules (
  key text PRIMARY KEY,
  points int NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE points_events (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  points int NOT NULL,
  ref_table text,
  ref_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE points_totals (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

-- ============= INDEXES =============
CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_invites_token ON org_invites(token);
CREATE INDEX idx_org_invites_org_id ON org_invites(org_id);
CREATE INDEX idx_user_lesson_progress_org_id ON user_lesson_progress(org_id);
CREATE INDEX idx_accounts_user_org ON accounts(user_id, org_id);
CREATE INDEX idx_income_sources_user_org ON income_sources(user_id, org_id);
CREATE INDEX idx_categories_org_user_kind ON categories(org_id, user_id, kind);
CREATE INDEX idx_transactions_user_org ON transactions(user_id, org_id);
CREATE INDEX idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX idx_points_events_org_user ON points_events(org_id, user_id);
CREATE UNIQUE INDEX idx_points_events_idempotent ON points_events(user_id, event_key, ref_table, ref_id) WHERE ref_table IS NOT NULL AND ref_id IS NOT NULL;
CREATE INDEX idx_points_totals_org_id ON points_totals(org_id);

-- ============= RLS HELPERS =============
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION is_org_admin_of(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role_in_org = 'ORG_ADMIN' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_same_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() = p_user_id;
$$;

CREATE OR REPLACE FUNCTION my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============= ENABLE RLS =============
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_totals ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============

-- organizations
CREATE POLICY "super_admin_all_organizations" ON organizations FOR ALL USING (is_super_admin());
CREATE POLICY "org_admin_read_own_org" ON organizations FOR SELECT USING (id = my_org_id());
CREATE POLICY "org_admin_insert_own_org" ON organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "org_admin_update_own_org" ON organizations FOR UPDATE USING (id = my_org_id());

-- profiles
CREATE POLICY "super_admin_all_profiles" ON profiles FOR ALL USING (is_super_admin());
CREATE POLICY "read_own_profile" ON profiles FOR SELECT USING (is_same_user(id));
CREATE POLICY "org_admin_read_org_profiles" ON profiles FOR SELECT USING (is_org_admin_of(org_id));
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (is_same_user(id));
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT WITH CHECK (is_same_user(id));

-- org_members
CREATE POLICY "super_admin_all_org_members" ON org_members FOR ALL USING (is_super_admin());
CREATE POLICY "org_admin_read_org_members" ON org_members FOR SELECT USING (is_org_admin_of(org_id));
CREATE POLICY "org_admin_insert_org_members" ON org_members FOR INSERT WITH CHECK (is_org_admin_of(org_id));
CREATE POLICY "org_admin_update_org_members" ON org_members FOR UPDATE USING (is_org_admin_of(org_id));
CREATE POLICY "read_own_membership" ON org_members FOR SELECT USING (is_same_user(user_id));

-- org_subscriptions
CREATE POLICY "super_admin_all_org_subscriptions" ON org_subscriptions FOR ALL USING (is_super_admin());
CREATE POLICY "org_admin_read_org_subscriptions" ON org_subscriptions FOR SELECT USING (is_org_admin_of(org_id));
CREATE POLICY "read_own_org_subscription" ON org_subscriptions FOR SELECT USING (org_id = my_org_id());

-- org_invites
CREATE POLICY "super_admin_all_org_invites" ON org_invites FOR ALL USING (is_super_admin());
CREATE POLICY "org_admin_manage_org_invites" ON org_invites FOR ALL USING (is_org_admin_of(org_id));
CREATE POLICY "anon_read_invite_by_token" ON org_invites FOR SELECT USING (true);

-- lessons (read-only for all authenticated)
CREATE POLICY "authenticated_read_lessons" ON lessons FOR SELECT TO authenticated USING (true);

-- user_lesson_progress
CREATE POLICY "super_admin_all_user_lesson_progress" ON user_lesson_progress FOR ALL USING (is_super_admin());
CREATE POLICY "org_admin_read_org_progress" ON user_lesson_progress FOR SELECT USING (is_org_admin_of(org_id));
CREATE POLICY "user_own_progress" ON user_lesson_progress FOR ALL USING (is_same_user(user_id));

-- accounts
CREATE POLICY "super_admin_all_accounts" ON accounts FOR ALL USING (is_super_admin());
CREATE POLICY "user_own_accounts" ON accounts FOR ALL USING (is_same_user(user_id));

-- income_sources
CREATE POLICY "super_admin_all_income_sources" ON income_sources FOR ALL USING (is_super_admin());
CREATE POLICY "user_own_income_sources" ON income_sources FOR ALL USING (is_same_user(user_id));

-- categories
CREATE POLICY "super_admin_all_categories" ON categories FOR ALL USING (is_super_admin());
CREATE POLICY "user_own_categories" ON categories FOR ALL USING (is_same_user(user_id) OR user_id IS NULL AND org_id = my_org_id());
CREATE POLICY "user_insert_categories" ON categories FOR INSERT WITH CHECK (is_same_user(user_id) OR user_id IS NULL);
CREATE POLICY "user_update_own_categories" ON categories FOR UPDATE USING (is_same_user(user_id));

-- transactions
CREATE POLICY "super_admin_all_transactions" ON transactions FOR ALL USING (is_super_admin());
CREATE POLICY "user_own_transactions" ON transactions FOR ALL USING (is_same_user(user_id));

-- budgets
CREATE POLICY "super_admin_all_budgets" ON budgets FOR ALL USING (is_super_admin());
CREATE POLICY "user_own_budgets" ON budgets FOR ALL USING (is_same_user(user_id));

-- budget_items (via budget ownership)
CREATE POLICY "super_admin_all_budget_items" ON budget_items FOR ALL USING (is_super_admin());
CREATE POLICY "user_budget_items" ON budget_items FOR ALL USING (
  EXISTS (SELECT 1 FROM budgets b WHERE b.id = budget_items.budget_id AND b.user_id = auth.uid())
);

-- points_rules (read for authenticated)
CREATE POLICY "authenticated_read_points_rules" ON points_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "super_admin_manage_points_rules" ON points_rules FOR ALL USING (is_super_admin());

-- points_events
CREATE POLICY "super_admin_all_points_events" ON points_events FOR ALL USING (is_super_admin());
CREATE POLICY "org_admin_read_org_points_events" ON points_events FOR SELECT USING (is_org_admin_of(org_id));
CREATE POLICY "user_read_own_points_events" ON points_events FOR SELECT USING (is_same_user(user_id));
-- INSERT only via award_points() (SECURITY DEFINER)

-- points_totals
CREATE POLICY "super_admin_all_points_totals" ON points_totals FOR ALL USING (is_super_admin());
CREATE POLICY "org_member_read_org_points_totals" ON points_totals FOR SELECT USING (org_id = my_org_id());
-- INSERT/UPDATE only via award_points() (SECURITY DEFINER)

-- ============= AWARD_POINTS RPC =============
CREATE OR REPLACE FUNCTION award_points(
  p_org_id uuid,
  p_user_id uuid,
  p_event_key text,
  p_ref_table text DEFAULT NULL,
  p_ref_id text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points int;
  v_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  SELECT pr.points INTO v_points
  FROM points_rules pr
  WHERE pr.key = p_event_key AND pr.is_active = true;

  IF v_points IS NULL OR v_points <= 0 THEN
    RETURN 0;
  END IF;

  IF p_ref_table IS NOT NULL AND p_ref_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM points_events
      WHERE user_id = p_user_id AND event_key = p_event_key
        AND ref_table = p_ref_table AND ref_id = p_ref_id
    ) INTO v_exists;
    IF v_exists THEN
      RETURN 0;
    END IF;
  END IF;

  INSERT INTO points_events (org_id, user_id, event_key, points, ref_table, ref_id)
  VALUES (p_org_id, p_user_id, p_event_key, v_points, p_ref_table, p_ref_id);

  INSERT INTO points_totals (org_id, user_id, total_points, updated_at)
  VALUES (p_org_id, p_user_id, v_points, now())
  ON CONFLICT (org_id, user_id) DO UPDATE
  SET total_points = points_totals.total_points + v_points, updated_at = now();

  RETURN v_points;
END;
$$;

GRANT EXECUTE ON FUNCTION award_points(uuid, uuid, text, text, text) TO authenticated;

-- ============= TRIGGERS =============

-- Create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'EMPLOYEE'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Award points when lesson is completed
CREATE OR REPLACE FUNCTION public.on_lesson_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN
    PERFORM award_points(NEW.org_id, NEW.user_id, 'LESSON_COMPLETED', 'user_lesson_progress', NEW.day::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_lesson_completed
  AFTER INSERT OR UPDATE OF completed_at ON user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.on_lesson_completed();

-- Increment seats_used when org_member is inserted
CREATE OR REPLACE FUNCTION public.increment_seats_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE org_subscriptions
  SET seats_used = seats_used + 1, updated_at = now()
  WHERE org_id = NEW.org_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_increment_seats
  AFTER INSERT ON org_members
  FOR EACH ROW EXECUTE FUNCTION public.increment_seats_used();

-- Decrement seats_used when org_member is deleted
CREATE OR REPLACE FUNCTION public.decrement_seats_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE org_subscriptions
  SET seats_used = GREATEST(0, seats_used - 1), updated_at = now()
  WHERE org_id = OLD.org_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_decrement_seats
  AFTER DELETE ON org_members
  FOR EACH ROW EXECUTE FUNCTION public.decrement_seats_used();

-- profiles.updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
