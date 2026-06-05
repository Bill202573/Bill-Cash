import { useState } from 'react';
import { TrendingDown, TrendingUp, ChevronRight, ChevronDown } from 'lucide-react';
import { fmt } from '@/lib/financial';
import { CATEGORY_COLORS } from '@/lib/supabase';

interface SubcategoryItem {
  name:       string;
  amount:     number;
  count:      number;
  percentage: number;          // % dentro da categoria pai
}

interface CategoryItem {
  name:           string;
  amount:         number;
  count:          number;
  percentage:     number;       // % do total
  subcategories?: SubcategoryItem[];
}

interface Props {
  expenses:      CategoryItem[];
  incomes:       CategoryItem[];
  totalExpenses: number;
  totalIncome:   number;
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
  item:  CategoryItem;
  color: string;
  type:  'income' | 'expense';
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubs = (item.subcategories?.length ?? 0) > 0;

  return (
    <div className="border-b border-border/20 last:border-0">
      {/* Linha principal */}
      <div
        className={`flex items-center gap-3 py-2 ${hasSubs ? 'cursor-pointer hover:bg-secondary/30 rounded px-1 -mx-1' : ''}`}
        onClick={hasSubs ? () => setExpanded(v => !v) : undefined}
      >
        {/* Chevron (apenas se tiver subcats) */}
        <div className="w-4 flex-shrink-0">
          {hasSubs && (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Name + amount */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">
              {item.name}
              {hasSubs && (
                <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                  ({item.subcategories!.length} sub)
                </span>
              )}
            </span>
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

      {/* Subcategorias expandidas */}
      {hasSubs && expanded && (
        <div className="pl-7 pb-2 space-y-1">
          {item.subcategories!.map(sub => (
            <div key={sub.name} className="flex items-center gap-3 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate">{sub.name}</span>
                  <span className="text-foreground/80 font-medium flex-shrink-0">
                    {type === 'income' ? '+' : '-'}{fmt(sub.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-0.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${sub.percentage}%`, backgroundColor: color, opacity: 0.6 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-[30px] text-right flex-shrink-0">
                    {sub.percentage.toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {sub.count} tx
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
