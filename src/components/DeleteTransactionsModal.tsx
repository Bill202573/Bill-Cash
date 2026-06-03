import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useTransactions } from '@/hooks/useTransactions';
import { fmt } from '@/lib/financial';
import { Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DeleteTransactionsModal({ open, onClose }: Props) {
  const { data: allTransactions = [] } = useTransactions();
  const [monthFilter, setMonthFilter] = useState('2026-01');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(
    () => allTransactions.filter(t => t.date.startsWith(monthFilter)),
    [allTransactions, monthFilter]
  );

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

      toast.success(`${selectedIds.size} transação(ões) deletada(s)`);
      setSelectedIds(new Set());
      setMonthFilter('2026-01');
      onClose();
    } catch (e) {
      toast.error('Erro ao deletar: ' + String(e));
    } finally {
      setDeleting(false);
    }
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
          {/* Filtro de mês */}
          <div>
            <Label>Filtrar por mês</Label>
            <Input
              type="month"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Resumo */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              Encontradas <strong>{filtered.length}</strong> transação(ões) em {monthFilter}
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
                    <p className="text-xs text-muted-foreground">{tx.date} • {tx.account}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.category}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
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
