-- Add CREDIT_CARD account type (credit card as debt) and optional cut/payment day columns.
-- Credit card accounts contribute negatively to net worth and can store cut_off_day and payment_day.

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'CREDIT_CARD';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS cut_off_day smallint,
  ADD COLUMN IF NOT EXISTS payment_day smallint;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_cut_off_day_range CHECK (cut_off_day IS NULL OR (cut_off_day >= 1 AND cut_off_day <= 31)),
  ADD CONSTRAINT accounts_payment_day_range CHECK (payment_day IS NULL OR (payment_day >= 1 AND payment_day <= 31));
