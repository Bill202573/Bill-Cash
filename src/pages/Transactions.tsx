import { useMemo, useState } from 'react';
import { Plus, Search, Filter, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TransactionList from '@/components/TransactionList';
import { TransactionForm } from '@/components/TransactionForm';
import { ImportModal } from '@/components/ImportModal';
import { useTransactions } from '@/hooks/useTransactions';
import { fmt, getMonthlySummary } from '@/lib/financial';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/supabase';

const ALL_CATEGORIES = ['Todas', ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter(c => !EXPENSE_CATEGORIES.includes(c))];

export default function Transactions() {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('Todas');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  const { data: transactions = [], isLoading } = useTransactions();

  // Build account list from available transactions
  const availableAccounts = useMemo(() => {
    return [...new Set(transactions.map(t => t.account).filter(Boolean))].sort();
  }, [transactions]);

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

  const currentMonth = filterMonth !== 'all' ? filterMonth : new Date().toISOString().slice(0, 7);
  const summary = useMemo(() => getMonthlySummary(transactions, currentMonth), [transactions, currentMonth]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Transações</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} transação(ões) encontrada(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} size="sm" variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importar Extrato</span>
          </Button>
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Transação</span>
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Receitas', value: summary.income, color: 'text-income' },
          { label: 'Despesas', value: summary.expenses, color: 'text-expense' },
          { label: 'Saldo', value: summary.balance, color: summary.balance >= 0 ? 'text-income' : 'text-expense' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-base font-display font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card rounded-lg p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-36">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-full sm:w-40">
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
          <SelectTrigger className="w-full sm:w-36">
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

      {isLoading ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">Carregando...</div>
      ) : (
        <TransactionList transactions={filtered} />
      )}

      <TransactionForm open={showForm} onClose={() => setShowForm(false)} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
