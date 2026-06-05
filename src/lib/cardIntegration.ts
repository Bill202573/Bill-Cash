import type { Transaction, CardExpense, CreditCard } from './supabase';

/**
 * Marker usado na descrição/categoria da transação de PAGAMENTO da fatura
 * (criada por useReconcileCardBill). Usamos para excluí-la ao montar a
 * visão "por categoria do cartão" — senão contaríamos as compras duas
 * vezes (uma por card_expense individual, outra pelo lump-sum pagamento).
 */
const CARD_PAYMENT_CATEGORY = 'Pagamento Cartão';

export interface MergeOptions {
  includeCardExpenses: boolean;   // mostra cada despesa do cartão por categoria
  cards?:              CreditCard[];   // para mapear card_id → nome
}

/**
 * Converte uma CardExpense em um objeto Transaction-like, para poder
 * ser somado/filtrado pelas funções existentes em lib/financial.ts
 * sem modificá-las.
 *
 * - O `account` recebe o nome do cartão (ex: "Nubank William") para
 *   aparecer nos filtros por conta.
 * - O `type` é 'expense' (compra de cartão = despesa do mês).
 * - O `date` usa a `purchase_date` (regime de competência: a compra
 *   conta no mês em que foi feita, não no mês que a fatura é paga).
 * - O `id` é prefixado com "card-" para não colidir com IDs de
 *   transactions reais.
 */
export function cardExpenseToTransaction(
  expense: CardExpense,
  cardName: string,
): Transaction {
  return {
    id:           `card-${expense.id}`,
    description:  expense.description,
    amount:       Number(expense.amount),
    type:         'expense',
    category:     expense.category || 'Outros',
    subcategory:  expense.subcategory,
    date:         expense.purchase_date,
    account:      cardName,
    user:         'Você',
    notes:        expense.notes,
    created_at:   expense.created_at,
  };
}

/**
 * Função-mestre de unificação. Sempre devolve um Transaction[] que pode
 * ser passado para getMonthlySummary, getCategoryBreakdown etc.
 *
 * Quando includeCardExpenses = true:
 *  - Adiciona as despesas confirmadas do cartão como transações.
 *  - REMOVE as transações de "Pagamento Cartão" (para não duplicar).
 *
 * Quando includeCardExpenses = false:
 *  - Retorna apenas as transações originais (incluindo "Pagamento
 *    Cartão" — regime de caixa puro).
 */
export function mergeCardExpensesAsTransactions(
  transactions: Transaction[],
  cardExpenses: CardExpense[],
  { includeCardExpenses, cards = [] }: MergeOptions,
): Transaction[] {
  if (!includeCardExpenses) return transactions;

  const cardNameById = new Map(cards.map(c => [c.id, c.name]));

  const cardAsTransactions: Transaction[] = cardExpenses
    .filter(e => e.status === 'confirmed')   // só confirmadas entram nos relatórios
    .map(e => cardExpenseToTransaction(e, cardNameById.get(e.card_id) ?? 'Cartão'));

  // Remove as transações de "Pagamento Cartão" para evitar dupla contagem
  const withoutCardPayments = transactions.filter(
    t => t.category !== CARD_PAYMENT_CATEGORY,
  );

  return [...withoutCardPayments, ...cardAsTransactions];
}

/** Conveniência: filtra apenas as despesas confirmadas de um determinado cartão */
export function getConfirmedCardExpenses(
  cardExpenses: CardExpense[],
  cardId?: string,
): CardExpense[] {
  return cardExpenses.filter(
    e => e.status === 'confirmed' && (!cardId || e.card_id === cardId),
  );
}
