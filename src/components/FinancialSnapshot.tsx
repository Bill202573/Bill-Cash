import { useMemo } from 'react';
import { Wallet, CreditCard, FileWarning, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useInternalTransfers } from '@/hooks/useInternalTransfers';
import { useCardBills } from '@/hooks/useCardBills';
import { useCardExpenses } from '@/hooks/useCardExpenses';
import { useDebts } from '@/hooks/useDebts';
import { computeFinancialSnapshot } from '@/lib/balances';
import { fmt } from '@/lib/financial';

/**
 * Painel "Posição atual": resumo em tempo real da situação financeira.
 * Mostra saldo em conta, total a pagar (cartões + dívidas) e patrimônio líquido.
 */
export function FinancialSnapshot() {
  const { data: accounts          = [] } = useAccounts();
  const { data: transactions      = [] } = useTransactions();
  const { data: internalTransfers = [] } = useInternalTransfers();
  const { data: bills             = [] } = useCardBills();
  const { data: cardExpenses      = [] } = useCardExpenses();
  const { data: debts             = [] } = useDebts();

  const snap = useMemo(
    () => computeFinancialSnapshot(accounts, transactions, internalTransfers, bills, cardExpenses, debts),
    [accounts, transactions, internalTransfers, bills, cardExpenses, debts],
  );

  const isPositive = snap.netWorth >= 0;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-lg">Posição Atual</h3>
          <p className="text-xs text-muted-foreground">Atualizado em tempo real com base nas suas transações</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Patrimônio líquido</p>
          <p className={`font-display font-bold text-2xl ${isPositive ? 'text-income' : 'text-expense'}`}>
            {isPositive ? '+' : ''}{fmt(snap.netWorth)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Em conta */}
        <div className="bg-income/5 border border-income/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-income mb-1">
            <Wallet className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Em conta</p>
          </div>
          <p className="text-xl font-display font-bold text-income">+{fmt(snap.totalCash)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Soma do saldo vivo de {accounts.length} conta{accounts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* A pagar (cartões) */}
        <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-warning mb-1">
            <CreditCard className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Cartões a pagar</p>
          </div>
          <p className="text-xl font-display font-bold text-warning">-{fmt(snap.cardBillsToPay)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Faturas em aberto/fechadas, não conciliadas
          </p>
        </div>

        {/* Dívidas */}
        <div className="bg-expense/5 border border-expense/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-expense mb-1">
            <FileWarning className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Dívidas</p>
          </div>
          <p className="text-xl font-display font-bold text-expense">-{fmt(snap.debtsRemaining)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Saldo devedor restante
          </p>
        </div>
      </div>

      {/* Equação visual */}
      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
        <span className="text-income">
          <TrendingUp className="inline h-3 w-3 mr-1" />
          {fmt(snap.totalCash)}
        </span>
        <span>−</span>
        <span className="text-warning">{fmt(snap.cardBillsToPay)}</span>
        <span>−</span>
        <span className="text-expense">{fmt(snap.debtsRemaining)}</span>
        <span>=</span>
        <span className={`font-semibold ${isPositive ? 'text-income' : 'text-expense'}`}>
          <TrendingDown className="inline h-3 w-3 mr-1" />
          {fmt(snap.netWorth)}
        </span>
      </div>
    </div>
  );
}
