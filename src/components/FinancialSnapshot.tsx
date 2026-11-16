import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Wallet, CreditCard, FileWarning, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useEntities } from '@/hooks/useEntities';
import { fetchEntityBalances } from '@/hooks/useEntityBalances';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useInternalTransfers } from '@/hooks/useInternalTransfers';
import { useCardBills } from '@/hooks/useCardBills';
import { useCardExpenses } from '@/hooks/useCardExpenses';
import { useDebts } from '@/hooks/useDebts';
import { useInvestments } from '@/hooks/useInvestments';
import { computeAccountBalance, computeFinancialSnapshot } from '@/lib/balances';
import { fmt } from '@/lib/financial';

/**
 * Painel "Posição atual": resumo em tempo real da situação financeira.
 * Mostra saldo em conta, investido, total a pagar (cartões + dívidas) e patrimônio líquido.
 */
export function FinancialSnapshot() {
  const { data: accounts          = [] } = useAccounts();
  const { data: transactions      = [] } = useTransactions();
  const { data: internalTransfers = [] } = useInternalTransfers();
  const { data: bills             = [] } = useCardBills();
  const { data: cardExpenses      = [] } = useCardExpenses();
  const { data: debts             = [] } = useDebts();
  const { data: investments       = [] } = useInvestments();

  const snap = useMemo(
    () => computeFinancialSnapshot(accounts, transactions, internalTransfers, bills, cardExpenses, debts, investments),
    [accounts, transactions, internalTransfers, bills, cardExpenses, debts, investments],
  );

  // "Em conta" mostra só contas correntes, do perfil selecionado (eu, Késya ou Família = soma de todas)
  const checking = useMemo(() => accounts.filter(a => a.type === 'checking'), [accounts]);
  const checkingCash = useMemo(
    () => checking.reduce((s, a) => s + computeAccountBalance(a, transactions, internalTransfers).current, 0),
    [checking, transactions, internalTransfers],
  );

  const investAccounts = useMemo(() => accounts.filter(a => a.type === 'investment').length, [accounts]);

  // ── Flag: somar o saldo das empresas (ex.: Stelle) à visão da Família ──
  // Só vale na visão "Família" inteira. Soma apenas os SALDOS (conta corrente e investimento), não dívidas nem faturas da empresa.
  const { scope, selectedMemberId } = useFamilyScope();
  const { data: entities = [] } = useEntities();
  const canInclude = scope === 'family' && !selectedMemberId && entities.length > 0;
  const [includeEntities, setIncludeEntities] = useState<boolean>(() => {
    try { return localStorage.getItem('billcash.includeEntities') === '1'; } catch { return false; }
  });
  const toggleInclude = (v: boolean) => {
    setIncludeEntities(v);
    try { localStorage.setItem('billcash.includeEntities', v ? '1' : '0'); } catch { /* sem storage */ }
  };
  const on = canInclude && includeEntities;
  const entityQs = useQueries({
    queries: entities.map(e => ({
      queryKey: ['entity_balances', e.id],
      enabled: on,
      queryFn: () => fetchEntityBalances(e.id),
    })),
  });
  const extra = useMemo(() => {
    let cash = 0, invested = 0;
    if (on) {
      for (const q of entityQs) for (const b of q.data ?? []) {
        if (b.type === 'investment') invested += b.balance; else cash += b.balance;
      }
    }
    return { cash, invested };
  }, [on, entityQs]);
  const entityNames = entities.map(e => e.name).join(', ');

  const shownCash     = checkingCash + extra.cash;
  const shownInvested = snap.totalInvested + extra.invested;
  const shownCashAll  = snap.totalCash + extra.cash;
  const netWorth      = snap.netWorth + extra.cash + extra.invested;
  const isPositive = netWorth >= 0;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-lg">Posição Atual</h3>
          <p className="text-xs text-muted-foreground">Atualizado em tempo real com base nas suas transações</p>
          {canInclude && (
            <label className="mt-2 inline-flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={includeEntities}
                onChange={e => toggleInclude(e.target.checked)}
              />
              <span>Incluir saldo da empresa ({entityNames}) na família</span>
            </label>
          )}
          {on && (
            <p className="text-xs text-primary mt-1">
              Somando {fmt(extra.cash)} em conta e {fmt(extra.invested)} investido da empresa. Dívidas e faturas dela não entram.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Patrimônio líquido</p>
          <p className={`font-display font-bold text-2xl ${isPositive ? 'text-income' : 'text-expense'}`}>
            {isPositive ? '+' : ''}{fmt(netWorth)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Em conta */}
        <div className="bg-income/5 border border-income/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-income mb-1">
            <Wallet className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Em conta</p>
          </div>
          <p className={`text-xl font-display font-bold ${shownCash < 0 ? 'text-expense' : 'text-income'}`}>
            {shownCash > 0 ? '+' : ''}{fmt(shownCash)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Soma do saldo de {checking.length} conta{checking.length !== 1 ? 's' : ''} corrente{checking.length !== 1 ? 's' : ''}
            {on ? ' + empresa' : ''}
          </p>
        </div>

        {/* Investido */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-primary mb-1">
            <PiggyBank className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Investido</p>
          </div>
          <p className="text-xl font-display font-bold text-primary">+{fmt(shownInvested)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {investments.length + investAccounts} aplicaç{investments.length + investAccounts === 1 ? 'ão' : 'ões'}
            {investAccounts > 0 ? ` (${investAccounts} conta${investAccounts > 1 ? 's' : ''} de investimento)` : ' — ver em Planos'}
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
          {fmt(shownCashAll)}
        </span>
        <span>+</span>
        <span className="text-primary">{fmt(shownInvested)}</span>
        <span>−</span>
        <span className="text-warning">{fmt(snap.cardBillsToPay)}</span>
        <span>−</span>
        <span className="text-expense">{fmt(snap.debtsRemaining)}</span>
        <span>=</span>
        <span className={`font-semibold ${isPositive ? 'text-income' : 'text-expense'}`}>
          <TrendingDown className="inline h-3 w-3 mr-1" />
          {fmt(netWorth)}
        </span>
      </div>
    </div>
  );
}
