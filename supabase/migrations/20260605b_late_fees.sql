-- ============================================================================
-- Migration: Multa e juros para contas fixas em atraso
-- ============================================================================
-- Adiciona ao template (fixed_bills) campos para:
--   • Multa única por atraso (ex: R$ 33,33 ou 2%)
--   • Juros diário (ex: R$ 0,56/dia ou 0,033%/dia)
--
-- Cada um pode ser:
--   - 'fixed':      valor em R$
--   - 'percentage': % do valor da conta
--
-- O cálculo é feito no client em tempo real (não armazenamos o valor calculado
-- porque ele muda a cada dia de atraso).
-- ============================================================================

ALTER TABLE fixed_bills
  ADD COLUMN IF NOT EXISTS late_fee_amount       NUMERIC(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_type         TEXT           DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS daily_interest_amount NUMERIC(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_interest_type   TEXT           DEFAULT 'fixed';

-- Constraints para garantir valores válidos
ALTER TABLE fixed_bills
  DROP CONSTRAINT IF EXISTS chk_late_fee_type;
ALTER TABLE fixed_bills
  ADD  CONSTRAINT chk_late_fee_type CHECK (late_fee_type IN ('fixed', 'percentage'));

ALTER TABLE fixed_bills
  DROP CONSTRAINT IF EXISTS chk_daily_interest_type;
ALTER TABLE fixed_bills
  ADD  CONSTRAINT chk_daily_interest_type CHECK (daily_interest_type IN ('fixed', 'percentage'));

COMMENT ON COLUMN fixed_bills.late_fee_amount       IS 'Multa por atraso (cobrada uma vez). Pode ser valor fixo (R$) ou % do valor da conta.';
COMMENT ON COLUMN fixed_bills.late_fee_type         IS 'fixed = R$, percentage = % do valor da conta';
COMMENT ON COLUMN fixed_bills.daily_interest_amount IS 'Juros por dia de atraso. Pode ser valor fixo (R$/dia) ou % do valor (%/dia).';
COMMENT ON COLUMN fixed_bills.daily_interest_type   IS 'fixed = R$/dia, percentage = %/dia sobre o valor da conta';
