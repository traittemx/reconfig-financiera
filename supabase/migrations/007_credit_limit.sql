-- Add optional credit_limit for credit card accounts (max line of credit in currency).

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS credit_limit numeric;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_credit_limit_non_negative CHECK (credit_limit IS NULL OR credit_limit >= 0);
