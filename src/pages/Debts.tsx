import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DebtForm } from '@/components/DebtForm';
import { useDebts, useDeleteDebt } from '@/hooks/useDebts';
import { compareMethods } from '@/lib/debtPlanner';
import { DEBT_TYPE_LABELS, type Debt } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';

export default function Debts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [extraPayment, setExtraPayment] = useState('0');

  const { data: debts = [], isLoading } = useDebts();
  const del = useDeleteDebt();

  const extra = parseFloat(extraPayment) || 0;
  const plans = useMemo(() => compareMethods(debts, extra), [debts, extra]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinimum = debts.reduce((s, d) => s + d.minimum_payment, 0);
  const avgRate = debts.length > 0
    ? debts.reduce((s, d) => s + d.interest_rate, 0) / debts.length
    : 0;

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta dívida?')) return;
    try { await del.mutateAsync(id); toast.success('Dívida removida'); }
    catch { toast.error('Erro ao remover'); }
  };

  const badgeColor = (rate: number) =>
    rate > 10 ? 'bg-expense/15 text-expense' :
    rate > 5 ? 'bg-warning/15 text-warning' :
    'bg-income/15 text-income';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Dívidas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {debts.length} dívida(s) · Total: {fmt(totalDebt)}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Dívida
        </Button>
      </div>

      {/* Summary row */}
      {debts.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Devedor', value: fmt(totalDebt), color: 'text-expense' },
            { label: 'Parcelas Mínimas', value: fmt(totalMinimum) + '/mês', color: 'text-warning' },
            { label: 'Juros Médios', value: avgRate.toFixed(2) + '% a.m.', color: avgRate > 5 ? 'text-expense' : 'text-warning' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-base font-display font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Debt list */}
      {isLoading ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">Carregando...</div>
      ) : debts.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center">
          <TrendingDown className="h-10 w-10 text-income mx-auto mb-3" />
          <p className="font-semibold">Você está livre de dívidas!</p>
          <p className="text-sm text-muted-foreground mt-1">Ou adicione suas dívidas para usar o planejador.</p>
        </div>
      ) : (
        <div className="glass-card rounded-lg p-5 mb-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-4">Suas Dívidas</h3>
          <div className="space-y-3">
            {debts.map(debt => {
              return (
                <div
                  key={debt.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50 border border-border/30 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{debt.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeColor(debt.interest_rate)}`}>
                        {debt.interest_rate.toFixed(2)}% a.m.
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {DEBT_TYPE_LABELS[debt.type]}
                      {debt.due_day ? ` · Vence dia ${debt.due_day}` : ''}
                      {debt.minimum_payment > 0 ? ` · Mínimo: ${fmt(debt.minimum_payment)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-expense">{fmt(debt.balance)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(debt)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(debt.id)} className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Planner */}
      {debts.length > 0 && (
        <div className="glass-card rounded-lg p-5 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-1">Planejador de Quitação</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Compare as estratégias Bola de Neve e Avalanche para quitar suas dívidas.
          </p>

          {/* Extra payment input */}
          <div className="mb-5 max-w-xs">
            <Label htmlFor="extra">Pagamento extra por mês (R$)</Label>
            <Input
              id="extra"
              type="number"
              min="0"
              step="50"
              placeholder="Ex: 500"
              value={extraPayment}
              onChange={e => setExtraPayment(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Valor adicional além das parcelas mínimas ({fmt(totalMinimum)}/mês)
            </p>
          </div>

          {/* Comparison table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {(['snowball', 'avalanche'] as const).map(method => {
              const plan = plans[method];
              const isBetter = method === 'avalanche'
                ? plans.avalanche.totalInterestPaid <= plans.snowball.totalInterestPaid
                : plans.snowball.totalMonths <= plans.avalanche.totalMonths;

              return (
                <div
                  key={method}
                  className={`p-4 rounded-lg border ${
                    isBetter ? 'border-primary/40 bg-primary/5' : 'border-border/30 bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">
                        {method === 'snowball' ? '⛄ Bola de Neve' : '🏔 Avalanche'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {method === 'snowball'
                          ? 'Paga a menor dívida primeiro (motivacional)'
                          : 'Paga o maior juro primeiro (economiza mais)'}
                      </p>
                    </div>
                    {isBetter && (
                      <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-medium">
                        {method === 'avalanche' ? 'Economiza mais' : 'Mais rápido'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Prazo total</span>
                      <span className="font-semibold">{plan.totalMonths} meses</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Juros pagos</span>
                      <span className="font-semibold text-expense">{fmt(plan.totalInterestPaid)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quitação prevista</span>
                      <span className="font-semibold">{plan.payoffDateLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gasto mensal total</span>
                      <span className="font-semibold">{fmt(plan.monthlyCost)}</span>
                    </div>
                  </div>

                  {/* Order of payoff */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground mb-2">Ordem de quitação:</p>
                    <div className="space-y-1">
                      {plan.debtPayoffs.map((d, i) => (
                        <div key={d.debtId} className="flex justify-between text-xs">
                          <span>{i + 1}. {d.name}</span>
                          <span className="text-muted-foreground">mês {d.paidOffMonth}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Savings comparison */}
          {plans.avalanche.totalInterestPaid < plans.snowball.totalInterestPaid && (
            <div className="p-3 rounded-lg bg-income/10 border border-income/20 text-sm">
              <p className="font-medium text-income">
                Usando Avalanche, você economiza {fmt(plans.snowball.totalInterestPaid - plans.avalanche.totalInterestPaid)} em juros!
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Em contrapartida, a Bola de Neve pode ser mais motivacional — você vê dívidas sendo eliminadas mais cedo.
              </p>
            </div>
          )}
        </div>
      )}

      <DebtForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && <DebtForm open onClose={() => setEditing(null)} debt={editing} />}
    </div>
  );
}
