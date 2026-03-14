-- Schema for InsForge (PostgreSQL)
-- Generated from Appwrite collections and Supabase seed references

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auth migration: links legacy (Appwrite) user id to email for first-login rekey to InsForge auth id
CREATE TABLE IF NOT EXISTS auth_migration (
    legacy_auth_id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    linked_at TIMESTAMPTZ
);

-- Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    linking_code VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles (linked to Auth and Organizations)
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- Maps to Auth UID
    full_name VARCHAR(255),
    org_id UUID REFERENCES organizations(id),
    role VARCHAR(32) NOT NULL,
    start_date DATE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    defaults_seeded_at TIMESTAMP WITH TIME ZONE
);

-- Org Members
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_in_org VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

-- Org Subscriptions
CREATE TABLE org_subscriptions (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    seats_total INTEGER NOT NULL DEFAULT 10,
    seats_used INTEGER NOT NULL DEFAULT 0,
    period_start DATE,
    period_end DATE,
    membership_cost DECIMAL(12, 2),
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lessons
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    day INTEGER NOT NULL UNIQUE,
    title VARCHAR(512) NOT NULL,
    summary TEXT,
    mission TEXT,
    audio_url TEXT
);

-- User Lesson Progress
CREATE TABLE user_lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(user_id, lesson_id)
);

-- Accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cut_off_day INTEGER CHECK (cut_off_day >= 1 AND cut_off_day <= 31),
    payment_day INTEGER CHECK (payment_day >= 1 AND payment_day <= 31),
    credit_limit DECIMAL(15, 2),
    interest_rate DECIMAL(5, 2),
    annual_fee DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id),
    is_default BOOLEAN DEFAULT FALSE,
    icon VARCHAR(64),
    color VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    note TEXT,
    transfer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_period VARCHAR(32),
    recurrence_day_of_month INTEGER CHECK (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 31),
    recurrence_interval_months INTEGER DEFAULT 1,
    recurrence_total_occurrences INTEGER,
    expense_label VARCHAR(32),
    is_scheduled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month VARCHAR(16) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Budget Items
CREATE TABLE budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    limit_amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Points Rules
CREATE TABLE points_rules (
    key VARCHAR(64) PRIMARY KEY,
    points INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Points Events
CREATE TABLE points_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_key VARCHAR(64) NOT NULL REFERENCES points_rules(key),
    points INTEGER NOT NULL,
    ref_table VARCHAR(64),
    ref_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Savings Goals
CREATE TABLE savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(255),
    target_amount DECIMAL(15, 2) NOT NULL,
    target_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Physical Assets
CREATE TABLE physical_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT '2000-01-01 00:00:00+00'
);

-- Pilot Recommendations
CREATE TABLE pilot_daily_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recommendation_date DATE NOT NULL,
    state VARCHAR(32) NOT NULL,
    message_main TEXT NOT NULL,
    message_why TEXT NOT NULL,
    suggested_limit TEXT NOT NULL,
    suggested_action TEXT,
    flexibility VARCHAR(32),
    signals_snapshot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pilot Emotional Checkins
CREATE TABLE pilot_emotional_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    value VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Points Totals (required by award_points)
CREATE TABLE IF NOT EXISTS points_totals (
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (org_id, user_id)
);

-- Org Invites
CREATE TABLE IF NOT EXISTS org_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- Business Logic: Seeding Functions
-- ==========================================

-- Function: seed_default_categories
CREATE OR REPLACE FUNCTION seed_default_categories(p_org_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Check if categories already exist for this user/org
    IF EXISTS (SELECT 1 FROM categories WHERE org_id = p_org_id AND user_id = p_user_id) THEN
        RETURN;
    END IF;

    INSERT INTO categories (org_id, user_id, kind, name, is_default, icon, color) VALUES
    (p_org_id, p_user_id, 'INCOME', 'Salario', TRUE, 'Wallet', '#0d9488'),
    (p_org_id, p_user_id, 'INCOME', 'Otros ingresos', TRUE, 'DollarSign', '#0891b2'),
    (p_org_id, p_user_id, 'EXPENSE', 'Comida', TRUE, 'UtensilsCrossed', '#e11d48'),
    (p_org_id, p_user_id, 'EXPENSE', 'Transporte', TRUE, 'Car', '#2563eb'),
    (p_org_id, p_user_id, 'EXPENSE', 'Diversión', TRUE, 'Gamepad2', '#7c3aed'),
    (p_org_id, p_user_id, 'EXPENSE', 'Renta', TRUE, 'Home', '#16a34a'),
    (p_org_id, p_user_id, 'EXPENSE', 'Gasolina', TRUE, 'Zap', '#ea580c'),
    (p_org_id, p_user_id, 'EXPENSE', 'Salud', TRUE, 'HeartPulse', '#dc2626'),
    (p_org_id, p_user_id, 'EXPENSE', 'Entretenimiento', TRUE, 'Gamepad2', '#7c3aed'),
    (p_org_id, p_user_id, 'EXPENSE', 'Streaming', TRUE, 'Music', '#0891b2'),
    (p_org_id, p_user_id, 'EXPENSE', 'Viajes', TRUE, 'Plane', '#0d9488'),
    (p_org_id, p_user_id, 'EXPENSE', 'Café', TRUE, 'Coffee', '#ca8a04'),
    (p_org_id, p_user_id, 'EXPENSE', 'Libros', TRUE, 'BookOpen', '#65a30d'),
    (p_org_id, p_user_id, 'EXPENSE', 'Regalos', TRUE, 'Gift', '#be185d');
END;
$$ LANGUAGE plpgsql;

-- Function: seed_default_accounts
CREATE OR REPLACE FUNCTION seed_default_accounts(p_org_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM accounts WHERE user_id = p_user_id) THEN
        RETURN;
    END IF;

    INSERT INTO accounts (user_id, org_id, name, type, currency, opening_balance)
    VALUES (p_user_id, p_org_id, 'Efectivo', 'CASH', 'MXN', 0);
END;
$$ LANGUAGE plpgsql;

-- Function: award_points
CREATE OR REPLACE FUNCTION award_points(
    p_org_id UUID,
    p_user_id UUID,
    p_event_key VARCHAR(64),
    p_ref_table VARCHAR(64) DEFAULT NULL,
    p_ref_id VARCHAR(64) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_points INTEGER;
    v_is_active BOOLEAN;
BEGIN
    -- Get points rule
    SELECT points, is_active INTO v_points, v_is_active FROM points_rules WHERE key = p_event_key;
    
    IF NOT FOUND OR NOT v_is_active THEN
        RETURN 0;
    END IF;

    -- Check for duplicate event
    IF p_ref_table IS NOT NULL AND p_ref_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM points_events 
                   WHERE user_id = p_user_id AND event_key = p_event_key 
                   AND ref_table = p_ref_table AND ref_id = p_ref_id) THEN
            RETURN 0;
        END IF;
    END IF;

    -- Insert points event
    INSERT INTO points_events (org_id, user_id, event_key, points, ref_table, ref_id)
    VALUES (p_org_id, p_user_id, p_event_key, v_points, p_ref_table, p_ref_id);

    -- Update or create points totals
    INSERT INTO points_totals (org_id, user_id, total_points, updated_at)
    VALUES (p_org_id, p_user_id, v_points, CURRENT_TIMESTAMP)
    ON CONFLICT (org_id, user_id) 
    DO UPDATE SET 
        total_points = points_totals.total_points + v_points,
        updated_at = EXCLUDED.updated_at;

    RETURN v_points;
END;
$$ LANGUAGE plpgsql;
