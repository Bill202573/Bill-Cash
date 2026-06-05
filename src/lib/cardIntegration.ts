import type { Transaction, CardExpense, CreditCard, CardBill } from './supabase';

/**
 * Marker usado na descrição/categoria da transação de PAGAMENTO da fatura
 * (criada por useReconcileCardBill). Usamos para excluí-la ao montar a
 * visão "por categoria do cartão" — senão contaríamos as compras duas
 * vezes (uma por card_expense individual, outra pelo lump-sum pagamento).
 */
const CARD_PAYMENT_CATEGORY = 'Pagamento Cartão';

export interface MergeOptions {
  includeCardExpenses: boolean;   // mostra cada despesa do cartão por categoria
  cards?:              CreditCard[];
  bills?:              CardBill[];
}

/**
 * Decide a DATA EFETIVA da despesa do cartão para fins de relatório.
 *
 * Princípio: o toggle "Incluir cartão por categoria" apenas decompõe o
 * lump-sum "Pagamento Cartão" em categorias. O saldo do mês NÃO deve
 * mudar com o toggle. Para que isso aconteça, as despesas do cartão
 * precisam aparecer no MESMO mês em que o pagamento entra/entraria no
 * extrato bancário — ou seja, na data de VENCIMENTO da fatura.
 *
 * Prioridade:
 *  1. due_date da fatura (quando o cartão é/foi pago)
 *  2. month_ref da fatura (primeiro dia daquele mês)
 *  3. purchase_date (último fallback, se a despesa estiver órfã)
 */
function effectiveDateForExpense(
  expense: CardExpense,
  billsById: Map<string, CardBill>,
): string {
  const bill = expense.bill_id ? billsById.get(expense.bill_id) : null;
  if (bill?.due_date) return bill.due_date;
  if (bill?.month_ref) return `${bill.month_ref}-01`;
  return expense.purchase_date;
}

/**
 * Converte uma CardExpense em um objeto Transaction-like, para poder
 * ser somado/filtrado pelas funções existentes em lib/financial.ts
 * sem modificá-las.
 *
 * - O `account` recebe o nome do cartão (ex: "Nubank William") para
 *   aparecer nos filtros por conta.
 * - O `type` é 'expense' (compra de cartão = despesa do mês).
 * - O `date` usa a data efetiva (vide effectiveDateForExpense).
 * - O `id` é prefixado com "card-" para não colidir com IDs de
 *   transactions reais.
 */
export function cardExpenseToTransaction(
  expense:        CardExpense,
  cardName:       string,
  effectiveDate:  string,
): Transaction {
  return {
    id:           `card-${expense.id}`,
    description:  expense.description,
    amount:       Number(expense.amount),
    type:         'expense',
    category:     expense.category || 'Outros',
    subcategory:  expense.subcategory,
    date:         effectiveDate,
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
 *  - Adiciona as despesas confirmadas do cartão como transações, datadas
 *    pelo VENCIMENTO da fatura (regime de caixa decomposto por categoria).
 *  - REMOVE as transações de "Pagamento Cartão" (para não duplicar).
 *  - Resultado: saldo do mês idêntico ao toggle OFF, mas com categorias
 *    detalhadas em vez do lump-sum.
 *
 * Quando includeCardExpenses = false:
 *  - Retorna apenas as transações originais (incluindo "Pagamento
 *    Cartão" como uma única despesa).
 */
export function mergeCardExpensesAsTransactions(
  transactions: Transaction[],
  cardExpenses: CardExpense[],
  { includeCardExpenses, cards = [], bills = [] }: MergeOptions,
): Transaction[] {
  if (!includeCardExpenses) return transactions;

  const cardNameById = new Map(cards.map(c => [c.id, c.name]));
  const billsById    = new Map(bills.map(b => [b.id, b]));

  const cardAsTransactions: Transaction[] = cardExpenses
    .filter(e => e.status === 'confirmed')
    .map(e => cardExpenseToTransaction(
      e,
      cardNameById.get(e.card_id) ?? 'Cartão',
      effectiveDateForExpense(e, billsById),
    ));

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
