-- Add CREDIT account type (debt / money owed).
-- Credit accounts contribute negatively to net worth.

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'CREDIT';
