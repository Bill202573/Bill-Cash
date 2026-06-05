-- ============================================================================
-- Migration: Permitir registrar contas fixas em aberto (sem pagamento)
-- ============================================================================
-- Antes: fixed_bill_payments só podia existir se a conta foi paga
-- Agora: podemos registrar valor + vencimento ANTES de pagar
--   → expected_amount: valor que a concessionária cobrou no mês
--   → due_date:        data de vencimento daquele mês específico
--   → paid_amount:     null se ainda não pago
--   → paid_date:       null se ainda não pago
--
-- Isso permite:
--   • Cadastrar conta com vencimento futuro → status "a vencer"
--   • Cadastrar conta com vencimento passado e sem pagamento → "em atraso"
--   • Marcar como paga depois (preenche paid_amount e paid_date)
-- ============================================================================

-- 1. Tornar paid_amount e paid_date nullable
ALTER TABLE fixed_bill_payments
  ALTER COLUMN paid_amount DROP NOT NULL,
  ALTER COLUMN paid_date   DROP NOT NULL;

-- 2. Adicionar colunas de valor esperado + data de vencimento daquele mês
ALTER TABLE fixed_bill_payments
  ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS due_date        DATE;

-- 3. Comentários para documentar
COMMENT ON COLUMN fixed_bill_payments.expected_amount IS 'Valor cobrado neste mês específico (pode variar mês a mês)';
COMMENT ON COLUMN fixed_bill_payments.due_date        IS 'Data real de vencimento neste mês (pode variar mês a mês)';
COMMENT ON COLUMN fixed_bill_payments.paid_amount     IS 'Valor efetivamente pago. NULL se ainda não pago.';
COMMENT ON COLUMN fixed_bill_payments.paid_date       IS 'Data do pagamento. NULL se ainda não pago.';
