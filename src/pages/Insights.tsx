import { useMemo } from 'react';
import { HealthScore } from '@/components/HealthScore';
import { InsightPanel } from '@/components/InsightPanel';
import { useTransactions } from '@/hooks/useTransactions';
import { useDebts } from '@/hooks/useDebts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';
import {
  calculateHealthScore, generateInsights,
  getMonthlySummary, getCategoryBreakdown, projectCashFlow,
  currentMonth, lastNMonths, fmt,
} from '@/lib/financial';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fmtCompact } from '@/lib/financial';

export default function Insights() {
  const { data: transactions = [] } = useTransactions();
  const { data: debts = [] } = useDebts();
  const { data: cards = [] } = useCreditCards();
  const { data: goals = [] } = useBudgetGoals();

  const month = currentMonth();
  const healthScore = useMemo(() => calculateHealthScore(transactions, debts, cards, goals), [transactions, debts, cards, goals]);
  const insights = useMemo(() => generateInsights(transactions, debts, cards, goals), [transactions, debts, cards, goals]);

  const summary = useMemo(() => getMonthlySummary(transactions, month), [transactions, month]);
  const categories = useMemo(() => getCategoryBreakdown(transactions, month), [transactions, month]);
  const cashFlow = useMemo(() => projectCashFlow(transactions, 3), [transactions]);

  // Month-over-month spending per category (last 3 months)
  const months = lastNMonths(3).reverse();
  const catTrends = useMemo(() => {
    const topCats = categories.slice(0, 5).map(c => c.name);
    return months.map(m => {
      const breakdown = getCategoryBreakdown(transactions, m);
      const row: Record<string, number | string> = {
        month: new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short' }),
      };
      topCats.forEach(cat => {
        row[cat] = breakdown.find(c => c.name === cat)?.amount ?? 0;
      });
      return row;
    });
  }, [transactions, months, categories]);

  const dangerCount = insights.filter(i => i.severity === 'danger').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;
  const successCount = insights.filter(i => i.severity === 'success').length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold">Insights Financeiros</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Análise inteligente da sua situação financeira
        </p>
      </div>

      {/* Insight summary chips */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Alertas Críticos', value: dangerCount, color: 'text-expense', bg: 'bg-expense/10' },
          { label: 'Atenção', value: warningCount, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Positivos', value: successCount, color: 'text-income', bg: 'bg-income/10' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`glass-card rounded-lg p-3 text-center ${bg}`}>
            <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Health Score */}
      <div className="mb-6">
        <HealthScore score={healthScore} />
      </div>

      {/* All Insights */}
      <div className="mb-6">
        <InsightPanel insights={insights} />
      </div>

      {/* Projeção de Caixa */}
      {cashFlow.some(m => m.income > 0 || m.expenses > 0) && (
        <div className="glass-card rounded-lg p-5 mb-6 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-1">Projeção dos Próximos 3 Meses</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Baseado na média dos últimos 3 meses de dados.
          </p>
          <div className="space-y-3">
            {cashFlow.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
                <span className="text-sm font-medium capitalize">{m.month}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-income">{fmt(m.income)}</span>
                  <span className="text-expense">-{fmt(m.expenses)}</span>
                  <span className={`font-semibold ${m.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {m.balance >= 0 ? '+' : ''}{fmt(m.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            * Projeção baseada na média histórica. Resultados reais podem variar.
          </p>
        </div>
      )}

      {/* Análise por categoria — mês a mês */}
      {categories.length > 0 && (
        <div className="glass-card rounded-lg p-5 animate-fade-in">
          <h3 className="font-display font-semibold text-lg mb-1">Tendência por Categoria</h3>
          <p className="text-sm text-muted-foreground mb-4">Top 5 categorias de despesa nos últimos 3 meses.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catTrends} barGap={2}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(215,15%,55%)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215,15%,55%)' }} tickFormatter={fmtCompact} width={52} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220,18%,12%)', border: '1px solid hsl(220,14%,20%)', borderRadius: '8px', fontSize: '13px' }}
                  formatter={(v: number, n: string) => [fmt(v), n]}
                />
                {categories.slice(0, 5).map(cat => (
                  <Bar
                    key={cat.name}
                    dataKey={cat.name}
                    fill={`hsl(215,15%,55%)`}
                    radius={[3, 3, 0, 0]}
                  >
                    {catTrends.map((_, i) => (
                      <Cell key={i} fill={`hsl(${200 + i * 40}, 60%, 50%)`} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
