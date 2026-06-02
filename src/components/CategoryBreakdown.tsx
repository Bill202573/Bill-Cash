import { CATEGORY_COLORS } from '@/lib/supabase';
import { fmt } from '@/lib/financial';

interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
}

interface Props {
  categories: CategoryData[];
}

export default function CategoryBreakdown({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <div className="glass-card rounded-lg p-5 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-3">Gastos por Categoria</h3>
        <p className="text-sm text-muted-foreground">Nenhuma despesa este mês.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-5 animate-fade-in">
      <h3 className="font-display font-semibold text-lg mb-4">Gastos por Categoria</h3>

      {/* Stacked bar */}
      <div className="flex rounded-full h-3 overflow-hidden mb-5 bg-secondary">
        {categories.map(cat => (
          <div
            key={cat.name}
            className="h-full transition-all duration-500"
            style={{
              width: `${cat.percentage}%`,
              backgroundColor: CATEGORY_COLORS[cat.name] ?? 'hsl(215,15%,55%)',
            }}
          />
        ))}
      </div>

      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat.name] ?? 'hsl(215,15%,55%)' }}
              />
              <span className="text-sm">{cat.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{fmt(cat.amount)}</span>
              <span className="text-xs text-muted-foreground w-8 text-right">
                {cat.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
