import { TrendingDown, TrendingUp } from 'lucide-react';
import { fmt } from '@/lib/financial';
import { CATEGORY_COLORS } from '@/lib/supabase';

interface CategoryItem {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

interface Props {
  expenses: CategoryItem[];
  incomes: CategoryItem[];
  totalExpenses: number;
  totalIncome: number;
}

const EXPENSE_DEFAULT_COLOR = 'hsl(215,15%,50%)';

const INCOME_COLORS: Record<string, string> = {
  'Salário':       'hsl(152,60%,42%)',
  'Freelance':     'hsl(165,55%,40%)',
  'Investimentos': 'hsl(200,65%,48%)',
  'Aluguel':       'hsl(175,50%,42%)',
  'Bônus':         'hsl(140,65%,38%)',
  'Outros':        'hsl(152,30%,48%)',
};
const INCOME_DEFAULT_COLOR = 'hsl(152,50%,45%)';

function CategoryRow({
  item,
  color,
  type,
}: {
  item: CategoryItem;
  color: string;
  type: 'income' | 'expense';
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
      {/* Color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: color }}
      />

      {/* Name + count */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          <span
            className={`text-sm font-semibold font-display flex-shrink-0 ${
              type === 'income' ? 'text-income' : 'text-foreground'
            }`}
          >
            {type === 'income' ? '+' : '-'}{fmt(item.amount)}
          </span>
        </div>

        {/* Progress bar + percentage */}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${item.percentage}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground w-[30px] text-right flex-shrink-0">
            {item.percentage.toFixed(0)}%
          </span>
          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {item.count} tx
          </span>
        </div>
      </div>
    </div>
  );
}

export function CategoryStatement({ expenses, incomes, totalExpenses, totalIncome }: Props) {
  const balance = totalIncome - totalExpenses;

  const empty = (label: string) => (
    <p className="text-sm text-muted-foreground py-4 text-center">
      Nenhuma {label} no período
    </p>
  );

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <h3 className="font-display font-semibold text-lg mb-5">
        Demonstrativo por Categoria
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Receitas ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-income" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Receitas
              </span>
            </div>
            <span className="text-income font-display font-bold">
              +{fmt(totalIncome)}
            </span>
          </div>

          {/* Stacked bar */}
          {incomes.length > 0 && (
            <div className="flex rounded-full h-2 overflow-hidden mb-3 bg-secondary">
              {incomes.map(cat => (
                <div
                  key={cat.name}
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: INCOME_COLORS[cat.name] ?? INCOME_DEFAULT_COLOR,
                  }}
                />
              ))}
            </div>
          )}

          <div>
            {incomes.length === 0
              ? empty('receita')
              : incomes.map(cat => (
                  <CategoryRow
                    key={cat.name}
                    item={cat}
                    color={INCOME_COLORS[cat.name] ?? INCOME_DEFAULT_COLOR}
                    type="income"
                  />
                ))}
          </div>
        </div>

        {/* ── Despesas ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-expense" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Despesas
              </span>
            </div>
            <span className="text-expense font-display font-bold">
              -{fmt(totalExpenses)}
            </span>
          </div>

          {/* Stacked bar */}
          {expenses.length > 0 && (
            <div className="flex rounded-full h-2 overflow-hidden mb-3 bg-secondary">
              {expenses.map(cat => (
                <div
                  key={cat.name}
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: CATEGORY_COLORS[cat.name] ?? EXPENSE_DEFAULT_COLOR,
                  }}
                />
              ))}
            </div>
          )}

          <div>
            {expenses.length === 0
              ? empty('despesa')
              : expenses.map(cat => (
                  <CategoryRow
                    key={cat.name}
                    item={cat}
                    color={CATEGORY_COLORS[cat.name] ?? EXPENSE_DEFAULT_COLOR}
                    type="expense"
                  />
                ))}
          </div>
        </div>
      </div>

      {/* ── Resultado ── */}
      <div className="mt-5 pt-4 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Resultado do mês
          </span>
          <div className="text-right">
            <span
              className={`font-display font-bold text-xl ${
                balance >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {balance >= 0 ? '+' : ''}{fmt(balance)}
            </span>
            {totalIncome > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {balance >= 0
                  ? `${((balance / totalIncome) * 100).toFixed(1)}% da renda poupada`
                  : `${(Math.abs(balance) / totalIncome * 100).toFixed(1)}% acima da renda`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
