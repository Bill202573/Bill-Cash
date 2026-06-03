import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { fmt } from '@/lib/financial';
import { Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DeleteTransactionsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: allTransactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const [monthFilter, setMonthFilter] = useState('2026-01');
  const [accountFilter, setAccountFilter] = useState('all');
  const [typeFilters, setTypeFilters] = useState(new Set(['income', 'expense', 'transfer']));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const availableMonths = useMemo(() => {
    const months = [...new Set(allTransactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    return months;
  }, [allTransactions]);

  const filtered = useMemo(
    () => allTransactions.filter(t => {
      if (!t.date.startsWith(monthFilter)) return false;
      if (accountFilter !== 'all' && t.account !== accountFilter) return false;
      if (!typeFilters.has(t.type)) return false;
      return true;
    }),
    [allTransactions, monthFilter, accountFilter, typeFilters]
  );

  const toggleTypeFilter = (type: 'income' | 'expense' | 'transfer') => {
    const newSet = new Set(typeFilters);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setTypeFilters(newSet);
  };

  const totalAmount = useMemo(
    () => filtered
      .filter(t => selectedIds.has(t.id))
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0),
    [filtered, selectedIds]
  );

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const toggleId = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione pelo menos uma transação');
      return;
    }

    if (!confirm(`Deseja deletar ${selectedIds.size} transação(ões)? Esta ação é irreversível.`)) {
      return;
    }

    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids);

      if (error) throw error;

      // Force immediate refetch to ensure ImportModal sees fresh data
      qc.resetQueries({ queryKey: ['transactions'] });
      await qc.refetchQueries({ queryKey: ['transactions'] });

      toast.success(`${selectedIds.size} transação(ões) deletada(s)`);
      setSelectedIds(new Set());
      setMonthFilter('2026-01');
      setAccountFilter('all');
      setTypeFilters(new Set(['income', 'expense', 'transfer']));
      onClose();
    } catch (e) {
      toast.error('Erro ao deletar: ' + String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setMonthFilter('2026-01');
    setAccountFilter('all');
    setTypeFilters(new Set(['income', 'expense', 'transfer']));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            Deletar Transações
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Mês */}
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m} value={m}>
                      {new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conta */}
            <div>
              <Label className="text-xs">Conta</Label>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {[...new Set(allTransactions.map(t => t.account))].sort().map(acc => (
                    <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipos */}
            <div>
              <Label className="text-xs">Tipos</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-2 py-1.5 bg-secondary/50 hover:bg-secondary">
                  <Checkbox
                    checked={typeFilters.has('income')}
                    onCheckedChange={() => toggleTypeFilter('income')}
                  />
                  <span>Receita</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-2 py-1.5 bg-secondary/50 hover:bg-secondary">
                  <Checkbox
                    checked={typeFilters.has('expense')}
                    onCheckedChange={() => toggleTypeFilter('expense')}
                  />
                  <span>Despesa</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-2 py-1.5 bg-secondary/50 hover:bg-secondary">
                  <Checkbox
                    checked={typeFilters.has('transfer')}
                    onCheckedChange={() => toggleTypeFilter('transfer')}
                  />
                  <span>Transfer.</span>
                </label>
              </div>
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              Encontradas <strong>{filtered.length}</strong> transação(ões)
              {monthFilter !== 'all' && <> em {new Date(monthFilter + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</>}
              {accountFilter !== 'all' && <> • {accountFilter}</>}
            </p>
            {selectedIds.size > 0 && (
              <p className="text-sm text-red-500 mt-1">
                <strong>{selectedIds.size}</strong> selecionada(s) • Total: <strong>{fmt(Math.abs(totalAmount))}</strong>
              </p>
            )}
          </div>

          {/* Selecionar tudo */}
          {filtered.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-primary hover:underline"
            >
              {selectedIds.size === filtered.length ? 'Desselecionar tudo' : 'Selecionar tudo'}
            </button>
          )}

          {/* Lista de transações */}
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma transação em {monthFilter}
              </p>
            ) : (
              filtered.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-2 hover:bg-secondary rounded cursor-pointer"
                  onClick={() => toggleId(tx.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(tx.id)}
                    onCheckedChange={() => toggleId(tx.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span>{tx.account}</span>
                      <span>•</span>
                      <span className={`font-medium ${
                        tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : 'text-muted-foreground'
                      }`}>
                        {tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transferência'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : 'text-muted-foreground'}`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{fmt(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.category}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1 gap-2"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || deleting}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deletando...' : `Deletar ${selectedIds.size || 'Nenhuma'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
