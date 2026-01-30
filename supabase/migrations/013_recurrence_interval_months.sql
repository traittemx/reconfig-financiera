-- Recurring transactions: divide expense across N months (annual, semiannual, MSI, etc.)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurrence_interval_months int NOT NULL DEFAULT 1
  CHECK (recurrence_interval_months >= 1 AND recurrence_interval_months <= 120);

COMMENT ON COLUMN transactions.recurrence_interval_months IS 'When is_recurring: divide amount across this many months (1=monthly, 12=annual, etc.). Monthly equivalent = amount / recurrence_interval_months.';
