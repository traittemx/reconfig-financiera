-- Expense label: Deseo, Lujo or Necesidad (required for EXPENSE transactions in the UI)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS expense_label text
  CHECK (expense_label IS NULL OR expense_label IN ('DESEO', 'LUJO', 'NECESIDAD'));
