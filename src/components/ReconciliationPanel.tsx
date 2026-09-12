import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, fetchAllPages } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionWithReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  account: string;
  reconciliation_status: string | null;
}

interface ReconciliationGroup {
  type: 'suspicious' | 'circular';
  title: string;
  description: string;
  transactions: TransactionWithReconciliation[];
}

export function ReconciliationPanel() {
  const { user } = useAuth();
  const { getFilterUserId } = useFamilyScope();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const filteredUserId = getFilterUserId();

  // Puxar todas as transações dos últimos 12 meses
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions_reconciliation', filteredUserId],
    queryFn: async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Paginado: a família já passa de 1000 linhas, limite silencioso do Supabase.
      const data = await fetchAllPages<TransactionWithReconciliation>((from, to) => {
        let query = supabase
          .from('transactions')
          .select('*')
          .gte('date', oneYearAgo.toISOString().slice(0, 10))
          .order('date', { ascending: true })
          .range(from, to);

        // filteredUserId é null no modo "família" (mostra de todos os membros)
        if (filteredUserId) query = query.eq('user_id', filteredUserId);

        return query;
      });
      return data;
    },
  });

  // Detectar grupos de reconciliação
  const reconciliationGroups: ReconciliationGroup[] = [];

  // Grupo 1: Transferências circulares (aplicação + saque)
  const circular: TransactionWithReconciliation[] = [];
  const circularSet = new Set<string>();

  for (let i = 0; i < allTransactions.length - 1; i++) {
    const curr = allTransactions[i];
    if (curr.reconciliation_status) continue; // Pular se já reconciliada

    for (let j = i + 1; j < Math.min(i + 30, allTransactions.length); j++) {
      const nxt = allTransactions[j];
      if (nxt.reconciliation_status) continue; // Pular se já reconciliada

      const isInvest = ['aplicação', 'invest', 'cdb', 'rdb', 'depósito'].some(w =>
        curr.description.toLowerCase().includes(w)
      );
      const isWithdraw = ['saque', 'retirada', 'resgate'].some(w =>
        nxt.description.toLowerCase().includes(w)
      );

      if (
        isInvest &&
        curr.type === 'expense' &&
        isWithdraw &&
        nxt.type === 'income'
      ) {
        const days =
          (new Date(nxt.date).getTime() - new Date(curr.date).getTime()) /
          (1000 * 60 * 60 * 24);

        if (days > 0 && days <= 14) {
          if (!circularSet.has(curr.id)) {
            circular.push(curr);
            circularSet.add(curr.id);
          }
          if (!circularSet.has(nxt.id)) {
            circular.push(nxt);
            circularSet.add(nxt.id);
          }
        }
      }
    }
  }

  if (circular.length > 0) {
    reconciliationGroups.push({
      type: 'circular',
      title: 'Transferências Circulares',
      description: 'Aplicações seguidas de saques (não impactam patrimônio)',
      transactions: circular,
    });
  }

  // Grupo 2: Transações suspeitas (valores altos fora do esperado)
  // Moradia fica de fora do critério de "valor alto": aluguel/condomínio são
  // despesas grandes e recorrentes por natureza, não anomalias a investigar.
  const suspicious = allTransactions.filter(
    tx =>
      !tx.reconciliation_status && // Pular se já reconciliada
      tx.category !== 'Moradia' &&
      ((tx.amount > 3000 && tx.type === 'expense') || // Despesas maiores que 3k
        tx.description.toLowerCase().includes('pessoal')) // Nome suspeito
  );

  if (suspicious.length > 0) {
    reconciliationGroups.push({
      type: 'suspicious',
      title: 'Transações Suspeitas',
      description: 'Grandes despesas ou transferências que podem não impactar saldo',
      transactions: suspicious,
    });
  }

  // Mutation para marcar como reconciliado
  const { mutate: reconcile, isPending } = useMutation({
    mutationFn: async (txIds: string[]) => {
      const { error } = await supabase
        .from('transactions')
        .update({ reconciliation_status: 'excluded' })
        .in('id', txIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Transações marcadas como reconciliadas!');
      qc.invalidateQueries({ queryKey: ['transactions_reconciliation'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      setSelected([]);
    },
    onError: (err: any) => {
      toast.error('Erro ao reconciliar: ' + err.message);
    },
  });

  const handleToggleTransaction = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectGroup = (txIds: string[]) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      txIds.forEach(id => {
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
      });
      return Array.from(newSet);
    });
  };

  // Calcular impacto no saldo
  const selectedAmount = allTransactions
    .filter(tx => selected.includes(tx.id))
    .reduce((sum, tx) => {
      if (tx.type === 'income') return sum + tx.amount;
      if (tx.type === 'expense') return sum - tx.amount;
      return sum + tx.amount; // transfer
    }, 0);

  if (!reconciliationGroups.length) {
    return (
      <div className="glass-card rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-5 w-5 text-income" />
          <h3 className="font-display font-semibold">Encontro de Contas</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          ✅ Nenhuma transação suspeita encontrada. Seu saldo está reconciliado!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-warning" />
          <h3 className="font-display font-semibold">Encontro de Contas</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Marque as transações que não devem impactar o saldo (investimentos, transferências circulares, etc).
          O saldo será recalculado automaticamente.
        </p>

        <div className="space-y-6">
          {reconciliationGroups.map((group, idx) => (
            <div key={idx} className="border border-border/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium">{group.title}</h4>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectGroup(group.transactions.map(t => t.id))}
                >
                  {group.transactions.some(t => selected.includes(t.id))
                    ? 'Desselecionar tudo'
                    : 'Selecionar tudo'}
                </Button>
              </div>

              <div className="space-y-2">
                {group.transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Checkbox
                      checked={selected.includes(tx.id)}
                      onCheckedChange={() => handleToggleTransaction(tx.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.date} • {tx.account}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          tx.type === 'income'
                            ? 'text-income'
                            : tx.type === 'expense'
                              ? 'text-expense'
                              : 'text-primary'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔ '}
                        R$ {tx.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border/50 space-y-4">
            {showPreview && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium mb-2">Impacto no Saldo:</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Removendo {selected.length} transação(ões) selecionadas
                </p>
                <p className="text-sm">
                  Valor: <span className="font-semibold">{selectedAmount > 0 ? '+' : ''}{selectedAmount.toFixed(2)}</span>
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Ocultar' : 'Visualizar'} Impacto
              </Button>
              <Button
                size="sm"
                onClick={() => reconcile(selected)}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? 'Reconciliando...' : `Reconciliar ${selected.length} transação(ões)`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
