import { useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgetGoals, useUpsertBudgetGoal, useDeleteBudgetGoal } from '@/hooks/useBudgetGoals';
import { getCategoryBreakdown, currentMonth, fmt } from '@/lib/financial';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Budget() {
  const [month, setMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const { data: transactions = [] } = useTransactions();
  const { data: goals = [] } = useBudgetGoals();
  const upsert = useUpsertBudgetGoal();
  const del = useDeleteBudgetGoal();

  const monthGoals = useMemo(() => goals.filter(g => g.month === month), [goals, month]);
  const spending = useMemo(() => {
    return getCategoryBreakdown(transactions, month).reduce(
      (acc, c) => ({ ...acc, [c.name]: c.amount }),
      {} as Record<string, number>
    );
  }, [transactions, month]);

  // Categories with any activity (spending or goal)
  const allCategories = useMemo(() => {
    const cats = new Set([
      ...monthGoals.map(g => g.category),
      ...Object.keys(spending),
    ]);
    return [...cats].sort();
  }, [monthGoals, spending]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat) { toast.error('Selecione uma categoria'); return; }
    if (!newLimit || isNaN(Number(newLimit))) { toast.error('Informe um valor válido'); return; }
    try {
      await upsert.mutateAsync({ category: newCat, monthly_limit: parseFloat(newLimit), month });
      toast.success('Meta salva');
      setShowForm(false);
      setNewCat('');
      setNewLimit('');
    } catch { toast.error('Erro ao salvar meta'); }
  };

  const handleInlineEdit = async (category: string, value: string) => {
    if (!value || isNaN(Number(value))) return;
    await upsert.mutateAsync({ category, monthly_limit: parseFloat(value), month });
  };

  const monthLabel = new Date(month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Orçamento</h2>
          <p className="text-muted-foreground text-sm mt-1">Metas de gasto por categoria — {monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-auto"
          />
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Meta
          </Button>
        </div>
      </div>

      {allCategories.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center">
          <Target className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="font-semibold">Nenhuma meta ou gasto neste mês</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione metas de gasto por categoria para controlar melhor seu orçamento.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allCategories.map(cat => {
            const goal = monthGoals.find(g => g.category === cat);
            const spent = spending[cat] || 0;
            const limit = goal?.monthly_limit ?? 0;
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const over = limit > 0 && spent > limit;
            const color = CATEGORY_COLORS[cat] ?? 'hsl(215,15%,55%)';
            const barColor = over ? 'hsl(var(--expense))' : pct > 80 ? 'hsl(var(--warning))' : color;

            return (
              <div key={cat} className="glass-card rounded-lg p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium">{cat}</span>
                    {over && (
                      <span className="text-xs bg-expense/15 text-expense px-1.5 py-0.5 rounded font-medium">
                        Estourado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{fmt(spent)}</span>
                    {limit > 0 && (
                      <span className="text-xs text-muted-foreground">/ </span>
                    )}
                    {/* Inline limit editor */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Meta:</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        defaultValue={limit || ''}
                        placeholder="—"
                        onBlur={e => handleInlineEdit(cat, e.target.value)}
                        className="w-24 text-xs bg-secondary border border-border/50 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {goal && (
                      <button
                        onClick={() => del.mutateAsync(goal.id).catch(() => toast.error('Erro'))}
                        className="text-xs text-muted-foreground hover:text-expense"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {limit > 0 && (
                  <>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{pct.toFixed(0)}% usado</span>
                      <span>
                        {over
                          ? `R$ ${(spent - limit).toFixed(2)} acima da meta`
                          : `R$ ${(limit - spent).toFixed(2)} disponível`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add goal modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Meta de Orçamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGoal} className="space-y-4">
            <div>
              <Label>Categoria</Label>
              <Select value={newCat} onValueChange={setNewCat}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Limite Mensal (R$)</Label>
              <Input
                type="number" min="0" step="50" placeholder="Ex: 800"
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={upsert.isPending}>Salvar Meta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
