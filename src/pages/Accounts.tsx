import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Wallet, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountForm } from '@/components/AccountForm';
import { InternalTransferForm } from '@/components/InternalTransferForm';
import { useAccounts, useDeleteAccount } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { ACCOUNT_TYPE_LABELS, type Account } from '@/lib/supabase';
import { fmt, getMonthlySummary, currentMonth } from '@/lib/financial';
import { toast } from 'sonner';

export default function Accounts() {
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const del = useDeleteAccount();

  const month = currentMonth();

  /* Para cada conta: soma receitas e despesas do mês pelo campo account */
  const accountStats = useMemo(() => {
    return accounts.map(acc => {
      const accTxs = transactions.filter(
        t => t.account.toLowerCase() === acc.name.toLowerCase(),
      );
      const { income, expenses } = getMonthlySummary(accTxs, month);
      const totalIncome  = accTxs.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0);
      const totalExpense = accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { ...acc, monthIncome: income, monthExpense: expenses, totalIncome, totalExpense };
    });
  }, [accounts, transactions, month]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover a conta "${name}"?`)) return;
    try { await del.mutateAsync(id); toast.success('Conta removida'); }
    catch { toast.error('Erro ao remover'); }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Contas Bancárias</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {accounts.length} conta(s) · Saldo total: {fmt(totalBalance)}
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

      {/* Saldo total */}
      {accounts.length > 0 && (
        <div className="glass-card rounded-lg p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Patrimônio em Conta</p>
              <p className="text-2xl font-display font-bold">{fmt(totalBalance)}</p>
            </div>
          </div>

          {/* Barra proporcional de contas */}
          {totalBalance > 0 && (
            <div className="flex rounded-full h-2.5 overflow-hidden bg-secondary">
              {accountStats.map(acc => (
                <div
                  key={acc.id}
                  className={`h-full bg-gradient-to-r ${acc.color} transition-all duration-700`}
                  style={{ width: `${(acc.balance / totalBalance) * 100}%` }}
                  title={`${acc.name}: ${fmt(acc.balance)}`}
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
          {accountStats.map(acc => (
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
                  {fmt(acc.balance)}
                </p>
                <p className="text-white/60 text-xs mt-0.5">Saldo cadastrado</p>

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

              {/* Estatísticas do mês */}
              <div className="px-5 py-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                  Movimentação — mês atual
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-income/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Entradas</p>
                    <p className="text-income font-semibold text-sm mt-0.5">
                      +{fmt(acc.monthIncome)}
                    </p>
                  </div>
                  <div className="bg-expense/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Saídas</p>
                    <p className="text-expense font-semibold text-sm mt-0.5">
                      -{fmt(acc.monthExpense)}
                    </p>
                  </div>
                </div>

                {/* Total de transações vinculadas */}
                {(acc.totalIncome > 0 || acc.totalExpense > 0) && (
                  <div className="mt-3 pt-3 border-t border-border/30 flex justify-between text-xs text-muted-foreground">
                    <span>Total histórico entrada</span>
                    <span className="text-income">+{fmt(acc.totalIncome)}</span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  Para vincular transações a esta conta, use o nome exato{' '}
                  <span className="font-medium text-foreground">"{acc.name}"</span>{' '}
                  no campo Conta ao lançar.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AccountForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && <AccountForm open onClose={() => setEditing(null)} account={editing} />}
      <InternalTransferForm open={showTransfer} onClose={() => setShowTransfer(false)} />
    </div>
  );
}
