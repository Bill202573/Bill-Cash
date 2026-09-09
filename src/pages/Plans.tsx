import { useState } from 'react';
import { Plus, Pencil, Trash2, Target, TrendingUp, Plane, Car, Home, FileText, Truck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LifeGoalForm } from '@/components/LifeGoalForm';
import { InvestmentForm } from '@/components/InvestmentForm';
import { useLifeGoals, useDeleteLifeGoal } from '@/hooks/useLifeGoals';
import { useInvestments, useDeleteInvestment } from '@/hooks/useInvestments';
import {
  LIFE_GOAL_CATEGORY_LABELS, INVESTMENT_TYPE_LABELS,
  type LifeGoal, type Investment, type LifeGoalCategory, type LifeGoalStatus,
} from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';

const CATEGORY_ICONS: Record<LifeGoalCategory, typeof Plane> = {
  viagem: Plane,
  veiculo: Car,
  imovel: Home,
  documentacao: FileText,
  mudanca: Truck,
  outro: Sparkles,
};

const STATUS_STYLE: Record<LifeGoalStatus, string> = {
  planejando:   'bg-secondary text-muted-foreground',
  em_andamento: 'bg-warning/15 text-warning',
  concluido:    'bg-income/15 text-income',
  cancelado:    'bg-expense/15 text-expense',
};

const STATUS_LABELS: Record<LifeGoalStatus, string> = {
  planejando:   'Planejando',
  em_andamento: 'Em andamento',
  concluido:    'Concluído',
  cancelado:    'Cancelado',
};

export default function Plans() {
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LifeGoal | null>(null);
  const [showInvForm, setShowInvForm] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);

  const { data: goals = [], isLoading: loadingGoals } = useLifeGoals();
  const { data: investments = [], isLoading: loadingInv } = useInvestments();
  const delGoal = useDeleteLifeGoal();
  const delInv = useDeleteInvestment();

  const activeGoals = goals.filter(g => g.status !== 'cancelado');
  const totalEstimated = activeGoals.reduce((s, g) => s + g.estimated_cost, 0);
  const totalSaved = activeGoals.reduce((s, g) => s + g.saved_amount, 0);
  const totalInvested = investments.reduce((s, i) => s + i.current_balance, 0);

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    try { await delGoal.mutateAsync(id); toast.success('Plano removido'); }
    catch { toast.error('Erro ao remover'); }
  };

  const handleDeleteInv = async (id: string) => {
    if (!confirm('Excluir este investimento?')) return;
    try { await delInv.mutateAsync(id); toast.success('Investimento removido'); }
    catch { toast.error('Erro ao remover'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Planos</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Seus projetos futuros e sua carteira de investimentos
          </p>
        </div>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <div className="glass-card rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Custo total dos planos</p>
          <p className="text-base font-display font-bold">{fmt(totalEstimated)}</p>
        </div>
        <div className="glass-card rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Já guardado p/ planos</p>
          <p className="text-base font-display font-bold text-primary">{fmt(totalSaved)}</p>
        </div>
        <div className="glass-card rounded-lg p-3 text-center col-span-2 lg:col-span-1">
          <p className="text-xs text-muted-foreground">Total investido</p>
          <p className="text-base font-display font-bold text-income">{fmt(totalInvested)}</p>
        </div>
      </div>

      {/* ══════════════════ METAS ══════════════════ */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Metas &amp; Planos
        </h3>
        <Button onClick={() => setShowGoalForm(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Novo Plano
        </Button>
      </div>

      {loadingGoals ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground mb-8">Carregando...</div>
      ) : goals.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center mb-8">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Nenhum plano cadastrado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Viagem, visto, reforma, mudança — coloque seus projetos aqui.</p>
        </div>
      ) : (
        <div className="glass-card rounded-lg p-5 mb-8 space-y-3">
          {goals.map(goal => {
            const Icon = CATEGORY_ICONS[goal.category];
            const pct = goal.estimated_cost > 0 ? Math.min(100, (goal.saved_amount / goal.estimated_cost) * 100) : 0;
            return (
              <div key={goal.id} className="p-3 rounded-lg bg-secondary/50 border border-border/30 group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium">{goal.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[goal.status]}`}>
                        {STATUS_LABELS[goal.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {LIFE_GOAL_CATEGORY_LABELS[goal.category]}
                      {goal.target_date ? ` · Alvo: ${new Date(goal.target_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(goal.saved_amount)} / {fmt(goal.estimated_cost)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => setEditingGoal(goal)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteGoal(goal.id)} className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════ INVESTIMENTOS ══════════════════ */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-income" /> Investimentos
        </h3>
        <Button onClick={() => setShowInvForm(true)} size="sm" variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Novo Investimento
        </Button>
      </div>

      {loadingInv ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">Carregando...</div>
      ) : investments.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Nenhum investimento cadastrado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Poupança, CDB, Tesouro Direto — registre onde seu dinheiro está guardado.</p>
        </div>
      ) : (
        <div className="glass-card rounded-lg p-5 space-y-2">
          {investments.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{inv.name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {INVESTMENT_TYPE_LABELS[inv.type]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.institution || 'Sem instituição informada'}
                  {inv.target_amount ? ` · Meta: ${fmt(inv.target_amount)}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-income">{fmt(inv.current_balance)}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditingInv(inv)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDeleteInv(inv.id)} className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LifeGoalForm open={showGoalForm} onClose={() => setShowGoalForm(false)} />
      {editingGoal && <LifeGoalForm open onClose={() => setEditingGoal(null)} goal={editingGoal} />}

      <InvestmentForm open={showInvForm} onClose={() => setShowInvForm(false)} />
      {editingInv && <InvestmentForm open onClose={() => setEditingInv(null)} investment={editingInv} />}
    </div>
  );
}
