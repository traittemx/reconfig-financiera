-- Recurring transactions: optional limit on number of occurrences (e.g. 6 payments)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurrence_total_occurrences int
  CHECK (recurrence_total_occurrences IS NULL OR recurrence_total_occurrences >= 1);
