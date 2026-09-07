import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/financial';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string;
  reconciliation_status?: string | null;
}

interface ProtelMonth {
  month: string;
  nominal: number;
  paid?: number;
  paidDate?: string;
  status: 'paid' | 'pending' | 'partial';
}

export function ProtelReconciliationPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  // Buscar transações de Protel não conciliadas
  const { data: protelTxs = [], isLoading } = useQuery({
    queryKey: ['protel_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .ilike('description', '%protel%')
        .or('reconciliation_status.is.null,reconciliation_status.neq.protel_paid')
        .order('date', { ascending: false });

      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!user?.id,
  });

  // Dados nominais esperados
  const nominalData: Record<string, ProtelMonth> = {
    '2026-01': { month: 'Jan/2026', nominal: 1833.07, status: 'pending' },
    '2026-02': { month: 'Fev/2026', nominal: 2003.50, status: 'pending' },
    '2026-03': { month: 'Mar/2026', nominal: 1913.46, status: 'pending' },
    '2026-04': { month: 'Abr/2026', nominal: 1610.16, status: 'pending' },
    '2026-05': { month: 'Mai/2026', nominal: 1610.17, status: 'pending' },
    '2026-06': { month: 'Jun/2026', nominal: 1666.71, status: 'pending' },
    '2026-07': { month: 'Jul/2026', nominal: 1601.04, status: 'pending' },
    '2026-08': { month: 'Ago/2026', nominal: 1533.19, status: 'pending' },
  };

  // Agrupar por mês
  const byMonth: Record<string, Transaction[]> = {};
  protelTxs.forEach(tx => {
    const month = tx.date.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(tx);
  });

  // Reconciliar
  const { mutate: reconcile, isPending } = useMutation({
    mutationFn: async (txIds: string[]) => {
      const { error } = await supabase
        .from('transactions')
        .update({ reconciliation_status: 'protel_paid' })
        .in('id', txIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Protel conciliada!');
      qc.invalidateQueries({ queryKey: ['protel_transactions'] });
      setSelected([]);
    },
    onError: (err: any) => {
      toast.error('Erro: ' + err.message);
    },
  });

  const handleToggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectMonth = (month: string) => {
    const monthTxs = byMonth[month] || [];
    const monthIds = monthTxs.map(t => t.id);
    setSelected(prev => {
      const newSet = new Set(prev);
      monthIds.forEach(id => {
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
      });
      return Array.from(newSet);
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando Protel...</div>;
  }

  if (protelTxs.length === 0) {
    return (
      <div className="glass-card rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-5 w-5 text-income" />
          <h3 className="font-display font-semibold">Protel Conciliada</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          ✅ Todas as transações de Protel foram conciliadas!
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="h-5 w-5 text-warning" />
        <h3 className="font-display font-semibold">Encontro de Contas - Protel</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Marque as transações que foram efetivamente pagas e desaparecerao da lista.
      </p>

      <div className="space-y-4">
        {Object.entries(byMonth)
          .sort(([m1], [m2]) => m2.localeCompare(m1))
          .map(([month, txs]) => {
            const nominal = nominalData[month];
            const totalPaid = txs.reduce((s, t) => s + t.amount, 0);
            const difference = totalPaid - (nominal?.nominal || 0);
            const allSelected = txs.every(t => selected.includes(t.id));

            return (
              <div key={month} className="border border-border/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{nominal?.month || month}</h4>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>
                        Nominal: <span className="font-semibold text-foreground">R$ {fmt(nominal?.nominal || 0)}</span>
                      </p>
                      <p>
                        Pago: <span className="font-semibold text-foreground">R$ {fmt(totalPaid)}</span>
                      </p>
                      {difference !== 0 && (
                        <p className={difference > 0 ? 'text-income' : 'text-expense'}>
                          {difference > 0 ? '+' : ''}R$ {fmt(Math.abs(difference))} {difference > 0 ? '(juros/multas)' : '(falta)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectMonth(month)}
                    className="text-xs"
                  >
                    {allSelected ? 'Desmarcar' : 'Marcar tudo'}
                  </Button>
                </div>

                <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
                  {txs.map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 transition-colors"
                    >
                      <Checkbox
                        checked={selected.includes(tx.id)}
                        onCheckedChange={() => handleToggle(tx.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.date} • {tx.account}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-expense flex-shrink-0">
                        R$ {fmt(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {selected.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3">
            {selected.length} transacao(oes) selecionada(s) para conciliacao
          </p>
          <Button
            size="sm"
            onClick={() => reconcile(selected)}
            disabled={isPending}
            className="w-full"
          >
            Conciliar e remover da lista
          </Button>
        </div>
      )}
    </div>
  );
}
