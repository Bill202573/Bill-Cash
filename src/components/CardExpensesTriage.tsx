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
import { useCardBill } from '@/hooks/useCardBills';
import { useCategories } from '@/hooks/useCategories';
import { EXPENSE_CATEGORIES, type CardExpense } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import {
  EXPENSE_STATUS_LABEL, EXPENSE_STATUS_COLOR,
  classifyExpenseSource,
  EXPENSE_SOURCE_LABEL, EXPENSE_SOURCE_COLOR, EXPENSE_SOURCE_ICON,
  type ExpenseSource,
} from '@/lib/cardBills';
import { toast } from 'sonner';

interface Props {
  billId:    string;
  expenses:  CardExpense[];
  onChanged: () => void;
}

const FILTERS = ['all', 'official', 'manual', 'projection', 'orphan_projection', 'refunded'] as const;
type FilterKey = typeof FILTERS[number];

const FILTER_LABEL: Record<FilterKey, string> = {
  all:               'Todas',
  official:          '✓ Oficiais (banco)',
  manual:            '✎ Manuais',
  projection:        '🔮 Projetadas',
  orphan_projection: '⚠ Não cobradas',
  refunded:          'Estornadas',
};

export function CardExpensesTriage({ billId, expenses, onChanged }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const update = useUpdateCardExpense();
  const bulkUpdate = useBulkUpdateCardExpenses();
  const del = useDeleteCardExpense();
  const recalc = useRecalculateBillTotal();

  // Pega a fatura para usar closing_date na classificação de órfãs
  const { data: bill } = useCardBill(billId);

  const { data: dbCats = [] } = useCategories('expense');
  const rootCats = dbCats.filter(c => c.parent_id === null);
  const allCats  = rootCats.length > 0 ? rootCats.map(c => c.name) : EXPENSE_CATEGORIES;

  /** Para uma categoria escolhida, retorna as subcategorias disponíveis */
  const subcatsFor = (catName: string | undefined) => {
    if (!catName) return [];
    const parent = rootCats.find(c => c.name === catName);
    if (!parent) return [];
    return dbCats.filter(c => c.parent_id === parent.id);
  };

  // Classifica cada despesa quanto à origem (oficial/manual/projeção/órfã)
  const sourceMap = useMemo(() => {
    const map = new Map<string, ExpenseSource>();
    expenses.forEach(e => {
      map.set(e.id, classifyExpenseSource(e, bill ?? undefined));
    });
    return map;
  }, [expenses, bill]);

  // Contadores por fonte (para mostrar abas/filtros e avisos)
  const sourceCounts = useMemo(() => {
    const counts = { official: 0, manual: 0, projection: 0, orphan_projection: 0, refunded: 0 };
    expenses.forEach(e => {
      if (e.status === 'refunded') {
        counts.refunded++;
        return;
      }
      const src = sourceMap.get(e.id);
      if (src && src !== 'manual') counts[src]++;
      else if (src === 'manual') counts.manual++;
    });
    return counts;
  }, [expenses, sourceMap]);

  const visible = useMemo(() => {
    if (filter === 'all') return expenses;
    if (filter === 'refunded') return expenses.filter(e => e.status === 'refunded');
    return expenses.filter(e => e.status !== 'refunded' && sourceMap.get(e.id) === filter);
  }, [expenses, filter, sourceMap]);

  // Totais da lista visível (footer) — agora reflete o REAL da fatura (exclui só refunded)
  const totals = useMemo(() => {
    const inFatura = visible.filter(e => e.status !== 'refunded');
    const grand     = inFatura.reduce((s, e) => s + Number(e.amount), 0);
    const confirmed = visible.filter(e => e.status === 'confirmed').reduce((s, e) => s + Number(e.amount), 0);
    const pending   = visible.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);
    return { grand, confirmed, pending };
  }, [visible]);

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
      // Trocar categoria limpa a subcategoria (que pode não pertencer mais ao novo pai)
      await update.mutateAsync({ id: exp.id, category, subcategory: undefined });
    } catch (e: any) {
      console.error('[CAT CHANGE ERROR]', e);
      toast.error('Erro: ' + (e?.message ?? String(e)));
    }
  };

  const handleSubcategoryChange = async (exp: CardExpense, subcategory: string) => {
    try {
      await update.mutateAsync({
        id: exp.id,
        subcategory: subcategory === '__none__' ? undefined : subcategory,
      });
    } catch (e: any) {
      console.error('[SUBCAT CHANGE ERROR]', e);
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
            <SelectTrigger className="w-48 h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ({expenses.length})</SelectItem>
              {sourceCounts.official > 0 && (
                <SelectItem value="official">✓ Oficiais ({sourceCounts.official})</SelectItem>
              )}
              {sourceCounts.manual > 0 && (
                <SelectItem value="manual">✎ Manuais ({sourceCounts.manual})</SelectItem>
              )}
              {sourceCounts.projection > 0 && (
                <SelectItem value="projection">🔮 Projetadas ({sourceCounts.projection})</SelectItem>
              )}
              {sourceCounts.orphan_projection > 0 && (
                <SelectItem value="orphan_projection">⚠ Não cobradas ({sourceCounts.orphan_projection})</SelectItem>
              )}
              {sourceCounts.refunded > 0 && (
                <SelectItem value="refunded">Estornadas ({sourceCounts.refunded})</SelectItem>
              )}
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

      {/* Aviso de projeções órfãs */}
      {sourceCounts.orphan_projection > 0 && filter !== 'orphan_projection' && (
        <div className="mb-3 bg-warning/5 border border-warning/30 rounded-lg p-2.5 text-xs">
          <p className="text-warning font-medium flex items-center gap-1.5">
            ⚠ {sourceCounts.orphan_projection} parcela(s) projetada(s) não vieram nesta fatura
          </p>
          <p className="text-muted-foreground mt-1">
            Essas eram parcelas previstas mas não foram cobradas pelo banco. Pode ser estorno, cancelamento ou erro.{' '}
            <button onClick={() => setFilter('orphan_projection')} className="text-warning underline hover:no-underline">
              Ver e revisar →
            </button>
          </p>
        </div>
      )}

      {/* Lista */}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {filter === 'all'
            ? 'Nenhuma despesa nesta fatura. Importe um CSV/OFX ou adicione manualmente.'
            : `Nenhuma despesa ${EXPENSE_STATUS_LABEL[filter]?.toLowerCase()}.`}
        </p>
      ) : (
        <>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {visible.map(exp => {
              const subs = subcatsFor(exp.category);
              const source = sourceMap.get(exp.id) ?? 'manual';
              const isOrphan = source === 'orphan_projection';
              return (
                <div
                  key={exp.id}
                  className={`flex flex-col md:flex-row md:items-center gap-2 p-2 rounded-md transition-colors text-sm ${
                    isOrphan ? 'bg-warning/5 border border-warning/30' : 'bg-secondary/20 hover:bg-secondary/40'
                  }`}
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
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{exp.purchase_date}</span>
                      <span className={`px-1.5 py-0.5 rounded ${EXPENSE_STATUS_COLOR[exp.status]}`}>
                        {EXPENSE_STATUS_LABEL[exp.status]}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${EXPENSE_SOURCE_COLOR[source]}`} title={EXPENSE_SOURCE_LABEL[source]}>
                        {EXPENSE_SOURCE_ICON[source]} {EXPENSE_SOURCE_LABEL[source]}
                      </span>
                    </p>
                  </div>

                  {/* Categoria + Subcategoria */}
                  <div className="flex gap-1 flex-shrink-0">
                    <Select
                      value={exp.category ?? ''}
                      onValueChange={v => handleCategoryChange(exp, v)}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCats.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Só mostra subcat se a categoria atual tem filhos no banco */}
                    {subs.length > 0 && (
                      <Select
                        value={exp.subcategory ?? ''}
                        onValueChange={v => handleSubcategoryChange(exp, v)}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs">
                          <SelectValue placeholder="Subcat." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nenhuma —</SelectItem>
                          {subs.map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

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
              );
            })}
          </div>

          {/* Footer com totais */}
          <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <p className="text-muted-foreground">Total na fatura</p>
              <p className="font-semibold text-sm text-expense">{fmt(totals.grand)}</p>
              <p className="text-muted-foreground text-[10px]">soma exceto estornadas</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Confirmadas</p>
              <p className="font-semibold text-sm text-income">{fmt(totals.confirmed)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Pendentes</p>
              <p className="font-semibold text-sm text-warning">{fmt(totals.pending)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
