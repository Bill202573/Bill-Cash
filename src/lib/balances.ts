import type { Account, Transaction, CardBill, CardExpense, Debt } from './supabase';
import type { InternalTransfer } from '@/hooks/useInternalTransfers';

/**
 * Calcula o saldo VIVO de uma conta:
 *   saldo_atual = saldo_inicial
 *               + Σ receitas
 *               + Σ transferências recebidas
 *               − Σ despesas
 *               − Σ transferências enviadas
 *
 * Considera apenas transações com data >= initial_balance_date (quando definida).
 * Transferências usam internal_transfers para determinar a direção (entrada/saída).
 */
export function computeAccountBalance(
  account:           Account,
  transactions:      Transaction[],
  internalTransfers: InternalTransfer[] = [],
): {
  current:        number;
  initial:        number;
  initialDate:    string | null;
  totalIncome:    number;
  totalExpense:   number;
  totalIn:        number;     // transferências recebidas
  totalOut:       number;     // transferências enviadas
  txCount:        number;
} {
  const initial     = account.initial_balance ?? 0;
  const initialDate = account.initial_balance_date ?? null;

  // Mapa para descobrir a direção de uma transação de transferência rapidamente
  const direction = new Map<string, 'in' | 'out'>();
  for (const it of internalTransfers) {
    if (it.from_tx_id) direction.set(it.from_tx_id, 'out');
    if (it.to_tx_id)   direction.set(it.to_tx_id,   'in');
  }

  const accLower = account.name.toLowerCase();
  let totalIncome  = 0;
  let totalExpense = 0;
  let totalIn      = 0;
  let totalOut     = 0;
  let txCount      = 0;

  for (const tx of transactions) {
    if (!tx.account || tx.account.toLowerCase() !== accLower) continue;
    if (initialDate && tx.date < initialDate) continue;     // ignora antes do saldo inicial
    txCount++;

    if (tx.type === 'income')  { totalIncome  += Number(tx.amount); continue; }
    if (tx.type === 'expense') { totalExpense += Number(tx.amount); continue; }

    if (tx.type === 'transfer') {
      const dir = direction.get(tx.id);
      if (dir === 'in')  totalIn  += Number(tx.amount);
      else if (dir === 'out') totalOut += Number(tx.amount);
      // Se a direção não foi achada (transferência órfã), ignora — não chuta direção
    }
  }

  const current = initial + totalIncome + totalIn - totalExpense - totalOut;

  return { current, initial, initialDate, totalIncome, totalExpense, totalIn, totalOut, txCount };
}

/**
 * Snapshot financeiro agregado.
 * Útil para "Posição atual" no dashboard.
 */
export interface FinancialSnapshot {
  /** Soma de saldos vivos de TODAS as contas */
  totalCash:          number;
  /** Total a pagar de cartões (faturas open + closed, não reconciliadas) */
  cardBillsToPay:     number;
  /** Total a pagar de despesas pendentes/confirmadas em faturas não reconciliadas */
  cardExpensesPending:number;
  /** Total de dívidas remanescentes */
  debtsRemaining:     number;
  /** Patrimônio líquido = cash − a pagar */
  netWorth:           number;
}

export function computeFinancialSnapshot(
  accounts:           Account[],
  transactions:       Transaction[],
  internalTransfers:  InternalTransfer[],
  cardBills:          CardBill[],
  cardExpenses:       CardExpense[],
  debts:              Debt[],
): FinancialSnapshot {
  const totalCash = accounts.reduce(
    (sum, acc) => sum + computeAccountBalance(acc, transactions, internalTransfers).current,
    0,
  );

  // Faturas de cartão a pagar: não reconciliadas
  const openOrClosedBills = cardBills.filter(b => b.status !== 'reconciled');
  const cardBillsToPay = openOrClosedBills.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);

  // Despesas confirmadas/pendentes em faturas não reconciliadas
  const openBillIds = new Set(openOrClosedBills.map(b => b.id));
  const cardExpensesPending = cardExpenses
    .filter(e => e.status !== 'refunded')
    .filter(e => e.bill_id && openBillIds.has(e.bill_id))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Dívidas: usa "remaining" (campo do schema Debt)
  const debtsRemaining = debts.reduce((sum, d: any) => {
    // schema antigo pode ter "remaining" ou "balance" — tentamos ambos
    const v = d.remaining ?? d.balance ?? 0;
    return sum + Number(v);
  }, 0);

  // Usa cardExpensesPending se for maior (mais detalhado), senão cardBillsToPay (lump sum)
  const toPay = Math.max(cardBillsToPay, cardExpensesPending);

  return {
    totalCash,
    cardBillsToPay:     toPay,
    cardExpensesPending,
    debtsRemaining,
    netWorth: totalCash - toPay - debtsRemaining,
  };
}
