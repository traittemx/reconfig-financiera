-- Recurring transactions: add columns to transactions for monthly recurrence
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_period text,
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month int CHECK (recurrence_day_of_month IS NULL OR (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 31));
