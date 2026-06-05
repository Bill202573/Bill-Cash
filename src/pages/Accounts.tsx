import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Wallet, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountForm } from '@/components/AccountForm';
import { InternalTransferForm } from '@/components/InternalTransferForm';
import { useAccounts, useDeleteAccount } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useInternalTransfers } from '@/hooks/useInternalTransfers';
import { ACCOUNT_TYPE_LABELS, type Account } from '@/lib/supabase';
import { fmt, getMonthlySummary, currentMonth } from '@/lib/financial';
import { computeAccountBalance } from '@/lib/balances';
import { toast } from 'sonner';

export default function Accounts() {
  const [showForm,     setShowForm]     = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editing,      setEditing]      = useState<Account | null>(null);

  const { data: accounts          = [], isLoading } = useAccounts();
  const { data: transactions      = [] }            = useTransactions();
  const { data: internalTransfers = [] }            = useInternalTransfers();
  const del = useDeleteAccount();

  const month = currentMonth();

  /* Para cada conta: saldo dinâmico + movimentação do mês */
  const accountStats = useMemo(() => {
    return accounts.map(acc => {
      const bal = computeAccountBalance(acc, transactions, internalTransfers);
      const accTxs = transactions.filter(
        t => t.account?.toLowerCase() === acc.name.toLowerCase(),
      );
      const monthSum = getMonthlySummary(accTxs, month);
      return {
        ...acc,
        balanceCalculated: bal.current,
        balanceInitial:    bal.initial,
        balanceDate:       bal.initialDate,
        totalIncome:       bal.totalIncome,
        totalExpense:      bal.totalExpense,
        totalIn:           bal.totalIn,
        totalOut:          bal.totalOut,
        txCount:           bal.txCount,
        monthIncome:       monthSum.income,
        monthExpense:      monthSum.expenses,
      };
    });
  }, [accounts, transactions, internalTransfers, month]);

  const totalCalculated = accountStats.reduce((s, a) => s + a.balanceCalculated, 0);
  const totalInitial    = accountStats.reduce((s, a) => s + a.balanceInitial,    0);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover a conta "${name}"?`)) return;
    try { await del.mutateAsync(id); toast.success('Conta removida'); }
    catch { toast.error('Erro ao remover'); }
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Contas Bancárias</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {accounts.length} conta(s) · Saldo total: <strong className="text-foreground">{fmt(totalCalculated)}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 1 && (
            <Button onClick={() => setShowTransfer(true)} size="sm" variant="outline" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" /> Transferir
            </Button>
          )}
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nova Conta
          </Button>
        </div>
      </div>

      {/* Patrimônio em conta */}
      {accounts.length > 0 && (
        <div className="glass-card rounded-lg p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patrimônio em Conta (saldo vivo)</p>
                <p className="text-2xl font-display font-bold">{fmt(totalCalculated)}</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Saldo inicial somado: {fmt(totalInitial)}</p>
              <p>Variação: <strong className={totalCalculated >= totalInitial ? 'text-income' : 'text-expense'}>
                {totalCalculated >= totalInitial ? '+' : ''}{fmt(totalCalculated - totalInitial)}
              </strong></p>
            </div>
          </div>

          {totalCalculated > 0 && (
            <div className="flex rounded-full h-2.5 overflow-hidden bg-secondary">
              {accountStats.map(acc => (
                <div
                  key={acc.id}
                  className={`h-full bg-gradient-to-r ${acc.color} transition-all duration-700`}
                  style={{ width: `${Math.max(0, (acc.balanceCalculated / totalCalculated) * 100)}%` }}
                  title={`${acc.name}: ${fmt(acc.balanceCalculated)}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de contas */}
      {isLoading ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">Carregando...</div>
      ) : accounts.length === 0 ? (
        <div className="glass-card rounded-lg p-10 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Nenhuma conta cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione suas contas para acompanhar seus saldos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accountStats.map(acc => {
            const variation = acc.balanceCalculated - acc.balanceInitial;
            return (
              <div
                key={acc.id}
                className="glass-card rounded-xl overflow-hidden animate-fade-in group"
              >
                {/* Cabeçalho colorido */}
                <div className={`bg-gradient-to-r ${acc.color} px-5 py-4 relative`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                        {acc.bank} · {ACCOUNT_TYPE_LABELS[acc.type]}
                      </p>
                      <p className="text-white font-display font-bold text-lg mt-0.5">{acc.name}</p>
                    </div>
                    <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                      {acc.owner}
                    </span>
                  </div>
                  <p className="text-white text-2xl font-display font-bold mt-3">
                    {fmt(acc.balanceCalculated)}
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">
                    Saldo atual (calculado)
                  </p>

                  {/* Botões de ação */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(acc)}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id, acc.name)}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-red-500/60 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Saldo inicial + variação */}
                <div className="px-5 py-3 bg-secondary/20 border-b border-border/30 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Saldo inicial em {fmtDate(acc.balanceDate)}
                    </span>
                    <span className="font-medium">{fmt(acc.balanceInitial)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">
                      Variação desde então ({acc.txCount} transação{acc.txCount !== 1 ? 'ões' : ''})
                    </span>
                    <span className={`font-semibold ${variation >= 0 ? 'text-income' : 'text-expense'}`}>
                      {variation >= 0 ? '+' : ''}{fmt(variation)}
                    </span>
                  </div>
                </div>

                {/* Movimentação do mês */}
                <div className="px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                    Movimentação — mês atual
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-income/10 rounded-lg p-3">
                      <div className="flex items-center gap-1 text-income">
                        <TrendingUp className="h-3 w-3" />
                        <p className="text-xs">Entradas</p>
                      </div>
                      <p className="text-income font-semibold text-sm mt-1">
                        +{fmt(acc.monthIncome)}
                      </p>
                    </div>
                    <div className="bg-expense/10 rounded-lg p-3">
                      <div className="flex items-center gap-1 text-expense">
                        <TrendingDown className="h-3 w-3" />
                        <p className="text-xs">Saídas</p>
                      </div>
                      <p className="text-expense font-semibold text-sm mt-1">
                        -{fmt(acc.monthExpense)}
                      </p>
                    </div>
                  </div>

                  {/* Histórico desde o saldo inicial */}
                  <div className="text-xs text-muted-foreground space-y-1 pt-3 border-t border-border/30">
                    <div className="flex justify-between">
                      <span>Receitas (desde início)</span>
                      <span className="text-income">+{fmt(acc.totalIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Despesas (desde início)</span>
                      <span className="text-expense">-{fmt(acc.totalExpense)}</span>
                    </div>
                    {(acc.totalIn > 0 || acc.totalOut > 0) && (
                      <>
                        <div className="flex justify-between">
                          <span>Transferências recebidas</span>
                          <span className="text-income">+{fmt(acc.totalIn)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Transferências enviadas</span>
                          <span className="text-expense">-{fmt(acc.totalOut)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AccountForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && <AccountForm open onClose={() => setEditing(null)} account={editing} />}
      <InternalTransferForm open={showTransfer} onClose={() => setShowTransfer(false)} />
    </div>
  );
}
