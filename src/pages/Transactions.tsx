import { useMemo, useState } from 'react';
import { Plus, Search, Filter, Upload, AlertTriangle, Trash2 } from 'lucide-react';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TransactionList from '@/components/TransactionList';
import { TransactionForm } from '@/components/TransactionForm';
import { ImportModal } from '@/components/ImportModal';
import { DeleteTransactionsModal } from '@/components/DeleteTransactionsModal';
import { IncludeCardsToggle } from '@/components/IncludeCardsToggle';
import { useTransactions } from '@/hooks/useTransactions';
import { useUnifiedTransactions } from '@/hooks/useUnifiedTransactions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { fmt, getMonthlySummary } from '@/lib/financial';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/supabase';

const ALL_CATEGORIES = ['Todas', ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter(c => !EXPENSE_CATEGORIES.includes(c))];

export default function Transactions() {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('Todas');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  const { transactions, isLoading } = useUnifiedTransactions();
  const { data: cards = [] } = useCreditCards();
  const deleteTransaction = useDeleteTransaction();
  const [showDuplicates, setShowDuplicates] = useState(false);

  // Find duplicates
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    transactions.forEach(t => {
      const key = `${t.description.trim().toLowerCase()}|${t.amount}|${t.date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return [...map.values()].filter(g => g.length > 1);
  }, [transactions]);

  // Build account list from available transactions + all registered cards
  // (cards aparecem mesmo sem despesas confirmadas para você poder filtrar)
  const availableAccounts = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.account) set.add(t.account); });
    cards.forEach(c => set.add(c.name));
    return [...set].sort();
  }, [transactions, cards]);

  // Build month options from available data
  const availableMonths = useMemo(() => {
    const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    return months;
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterCat !== 'Todas' && t.category !== filterCat) return false;
      if (filterMonth !== 'all' && !t.date.startsWith(filterMonth)) return false;
      if (filterAccount !== 'all' && t.account !== filterAccount) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, filterCat, filterMonth, filterAccount, search]);

  // Summary reflects filtered data
  const summary = useMemo(() => {
    const income   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const transfers = filtered.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses, transfers };
  }, [filtered]);

  return (
    <div>
      {/* Header - responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Transações</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} transação(ões) encontrada(s)
          </p>
        </div>

        {/* Buttons - stack vertical em mobile, horizontal em desktop */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-2 order-first sm:order-last">
            <Plus className="h-4 w-4" />
            <span>Nova Transação</span>
          </Button>
          <Button onClick={() => setShowImport(true)} size="sm" variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button onClick={() => setShowDelete(true)} size="sm" variant="outline" className="gap-2 text-red-500 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Deletar</span>
          </Button>
        </div>
      </div>

      {/* Toggle: incluir cartão por categoria */}
      <div className="mb-4">
        <IncludeCardsToggle compact />
      </div>

      {/* Duplicate alert banner */}
      {duplicateGroups.length > 0 && (
        <div className="mb-4 glass-card rounded-xl border border-warning/30 overflow-hidden">
          <div
            className="flex items-center justify-between gap-2 px-4 py-3 bg-warning/10 cursor-pointer"
            onClick={() => setShowDuplicates(v => !v)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-sm font-semibold text-warning">
                {duplicateGroups.length} grupo(s) de transações duplicadas encontrado(s)
              </p>
            </div>
            <span className="text-xs text-warning">{showDuplicates ? '▲ Fechar' : '▼ Ver e limpar'}</span>
          </div>
          {showDuplicates && (
            <div className="divide-y divide-border/20 max-h-64 overflow-y-auto">
              {duplicateGroups.map((group, gi) => (
                <div key={gi} className="px-4 py-3">
                  <p className="text-sm font-medium mb-2">
                    {group[0].description} — {fmt(group[0].amount)} em {group[0].date}
                    <span className="ml-2 text-xs text-warning">({group.length}x)</span>
                  </p>
                  <div className="space-y-1">
                    {group.map((tx, ti) => (
                      <div key={tx.id} className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1">
                        <span>#{ti + 1} — {tx.account} — {tx.category}</span>
                        {ti > 0 && (
                          <button
                            onClick={() => deleteTransaction.mutateAsync(tx.id)}
                            className="text-expense hover:text-expense/80 p-0.5 rounded hover:bg-expense/10 ml-2"
                            title="Remover duplicata"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {ti === 0 && <span className="text-primary text-xs">✓ manter</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary chips - responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-5">
        {[
          { label: 'Receitas',       value: summary.income,    color: 'text-income' },
          { label: 'Despesas',       value: summary.expenses,  color: 'text-expense' },
          { label: 'Transferências', value: summary.transfers, color: 'text-muted-foreground' },
          { label: 'Saldo',          value: summary.balance,   color: summary.balance >= 0 ? 'text-income' : 'text-expense' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card rounded-lg p-3 lg:p-3 text-center border border-border/20">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-sm lg:text-base font-display font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Filters - responsive grid */}
      <div className="glass-card rounded-lg p-4 mb-4 border border-border/20">
        {/* Search - full width */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Selects - responsive grid (2 col mobile, 4 col desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full text-sm">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
              <SelectItem value="transfer">Transferências</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {availableAccounts.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map(m => (
                <SelectItem key={m} value={m}>
                  {new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">Carregando...</div>
      ) : (
        <TransactionList transactions={filtered} />
      )}

      <TransactionForm open={showForm} onClose={() => setShowForm(false)} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <DeleteTransactionsModal open={showDelete} onClose={() => setShowDelete(false)} />
    </div>
  );
}
