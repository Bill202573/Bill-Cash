import { useState, useMemo } from 'react';
import { CheckCircle2, RotateCcw, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useUpdateCardExpense,
  useBulkUpdateCardExpenses,
  useDeleteCardExpense,
  useRecalculateBillTotal,
} from '@/hooks/useCardExpenses';
import { useCategories } from '@/hooks/useCategories';
import { EXPENSE_CATEGORIES, type CardExpense } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { EXPENSE_STATUS_LABEL, EXPENSE_STATUS_COLOR } from '@/lib/cardBills';
import { toast } from 'sonner';

interface Props {
  billId:    string;
  expenses:  CardExpense[];
  onChanged: () => void;
}

const FILTERS = ['all', 'pending', 'confirmed', 'refunded'] as const;
type FilterKey = typeof FILTERS[number];

export function CardExpensesTriage({ billId, expenses, onChanged }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const update = useUpdateCardExpense();
  const bulkUpdate = useBulkUpdateCardExpenses();
  const del = useDeleteCardExpense();
  const recalc = useRecalculateBillTotal();

  const { data: dbCats = [] } = useCategories('expense');
  const rootCats = dbCats.filter(c => c.parent_id === null);
  const allCats  = rootCats.length > 0 ? rootCats.map(c => c.name) : EXPENSE_CATEGORIES;

  const visible = useMemo(
    () => filter === 'all' ? expenses : expenses.filter(e => e.status === filter),
    [expenses, filter],
  );

  const pendingIds = expenses.filter(e => e.status === 'pending').map(e => e.id);

  const handleStatusChange = async (exp: CardExpense, status: 'confirmed' | 'refunded' | 'pending') => {
    try {
      await update.mutateAsync({ id: exp.id, status });
      await recalc.mutateAsync(billId);
      onChanged();
    } catch (e: any) {
      console.error('[STATUS CHANGE ERROR]', e);
      toast.error('Erro: ' + (e?.message ?? String(e)));
    }
  };

  const handleCategoryChange = async (exp: CardExpense, category: string) => {
    try {
      await update.mutateAsync({ id: exp.id, category });
    } catch (e: any) {
      console.error('[CAT CHANGE ERROR]', e);
      toast.error('Erro: ' + (e?.message ?? String(e)));
    }
  };

  const handleConfirmAll = async () => {
    if (pendingIds.length === 0) return;
    if (!confirm(`Confirmar ${pendingIds.length} despesa(s) pendente(s)?`)) return;
    try {
      await bulkUpdate.mutateAsync({ ids: pendingIds, updates: { status: 'confirmed' } });
      await recalc.mutateAsync(billId);
      toast.success(`${pendingIds.length} despesa(s) confirmada(s)`);
      onChanged();
    } catch (e: any) {
      console.error('[BULK CONFIRM ERROR]', e);
      toast.error('Erro: ' + (e?.message ?? String(e)));
    }
  };

  const handleDelete = async (exp: CardExpense) => {
    if (!confirm(`Deletar "${exp.description}"?`)) return;
    try {
      await del.mutateAsync(exp.id);
      await recalc.mutateAsync(billId);
      onChanged();
    } catch (e: any) {
      console.error('[DELETE ERROR]', e);
      toast.error('Erro: ' + (e?.message ?? String(e)));
    }
  };

  return (
    <div className="glass-card rounded-xl p-4">
      {/* Header com filtro + ação em massa */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display font-semibold text-sm">
          Despesas ({visible.length})
        </h3>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v: FilterKey) => setFilter(v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="confirmed">Confirmadas</SelectItem>
              <SelectItem value="refunded">Estornadas</SelectItem>
            </SelectContent>
          </Select>

          {pendingIds.length > 0 && (
            <Button
              onClick={handleConfirmAll}
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={bulkUpdate.isPending}
            >
              <CheckCircle2 className="h-3 w-3" />
              Confirmar todas ({pendingIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {filter === 'all'
            ? 'Nenhuma despesa nesta fatura. Importe um CSV ou adicione manualmente.'
            : `Nenhuma despesa ${EXPENSE_STATUS_LABEL[filter]?.toLowerCase()}.`}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {visible.map(exp => (
            <div
              key={exp.id}
              className="flex items-center gap-2 p-2 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors text-sm"
            >
              {/* Descrição + data */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {exp.description}
                  {exp.total_installments > 1 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({exp.installment}/{exp.total_installments})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {exp.purchase_date}
                  {' • '}
                  <span className={`px-1.5 py-0.5 rounded ${EXPENSE_STATUS_COLOR[exp.status]}`}>
                    {EXPENSE_STATUS_LABEL[exp.status]}
                  </span>
                </p>
              </div>

              {/* Categoria editável */}
              <Select
                value={exp.category ?? ''}
                onValueChange={v => handleCategoryChange(exp, v)}
              >
                <SelectTrigger className="w-32 h-7 text-xs flex-shrink-0">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {allCats.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Valor */}
              <span className="text-sm font-semibold text-expense w-24 text-right flex-shrink-0">
                -{fmt(exp.amount)}
              </span>

              {/* Ações */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {exp.status === 'pending' && (
                  <button
                    onClick={() => handleStatusChange(exp, 'confirmed')}
                    title="Confirmar"
                    className="p-1.5 rounded hover:bg-income/10 text-muted-foreground hover:text-income"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {exp.status === 'confirmed' && (
                  <button
                    onClick={() => handleStatusChange(exp, 'pending')}
                    title="Voltar para pendente"
                    className="p-1.5 rounded hover:bg-warning/10 text-muted-foreground hover:text-warning"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                {exp.status !== 'refunded' ? (
                  <button
                    onClick={() => handleStatusChange(exp, 'refunded')}
                    title="Marcar como estornada"
                    className="p-1.5 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense text-xs font-bold"
                  >
                    ↩
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange(exp, 'confirmed')}
                    title="Desmarcar estorno"
                    className="p-1.5 rounded hover:bg-income/10 text-muted-foreground hover:text-income"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(exp)}
                  title="Deletar"
                  className="p-1.5 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
