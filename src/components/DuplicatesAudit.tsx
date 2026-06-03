import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTransactions, useDeleteTransaction } from '@/hooks/useTransactions';
import { fmt } from '@/lib/financial';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DuplicatesAudit({ open, onClose }: Props) {
  const { data: transactions = [] } = useTransactions();
  const deleteTransaction = useDeleteTransaction();
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  // Find duplicates: same description, amount, date
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    transactions.forEach(t => {
      const key = `${t.description.trim().toLowerCase()}|${t.amount}|${t.date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return [...map.values()]
      .filter(g => g.length > 1)
      .sort((a, b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
  }, [transactions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar esta transação duplicada?')) return;
    try {
      await deleteTransaction.mutateAsync(id);
      toast.success('Transação deletada');
    } catch (e) {
      toast.error('Erro ao deletar: ' + String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Auditoria de Transações Duplicadas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {duplicateGroups.length === 0
              ? '✓ Nenhuma duplicata encontrada'
              : `${duplicateGroups.length} grupo(s) de duplicata(s) detectado(s)`}
          </p>

          {duplicateGroups.length > 0 && (
            <div className="space-y-2">
              {duplicateGroups.map((group, gi) => (
                <div key={gi} className="border rounded-lg p-3 bg-warning/5 border-warning/20">
                  {/* Group header */}
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === gi ? null : gi)}
                    className="w-full text-left flex items-center justify-between p-2 hover:bg-secondary/30 rounded"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{group[0].description}</p>
                      <p className="text-xs text-muted-foreground">
                        {group[0].date} • {fmt(group[0].amount)} • {group.length} encontradas
                      </p>
                    </div>
                    <span className="text-xs text-warning font-bold">{group.length}x</span>
                  </button>

                  {/* Expanded details */}
                  {expandedGroup === gi && (
                    <div className="mt-3 space-y-2 border-t border-warning/20 pt-2">
                      {group.map((tx, ti) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-2 bg-secondary/30 rounded text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-muted-foreground">
                              {ti + 1}. {tx.account} • {tx.category}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ID: {tx.id.slice(0, 8)}...
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {ti === 0 && (
                              <span className="text-primary text-xs font-semibold">MANTER</span>
                            )}
                            {ti > 0 && (
                              <button
                                onClick={() => handleDelete(tx.id)}
                                disabled={deleteTransaction.isPending}
                                className="text-expense hover:text-expense/80 p-1.5 rounded hover:bg-expense/10 disabled:opacity-50"
                                title="Remover duplicata"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
