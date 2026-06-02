import type { HealthScore as HS } from '@/lib/financial';

interface Props {
  score: HS;
}

const scoreItems = [
  { key: 'savingsScore', label: 'Taxa de Poupança', max: 30, tip: 'Poupança ≥ 20% da renda = máximo' },
  { key: 'debtScore', label: 'Saúde das Dívidas', max: 25, tip: 'Sem dívidas ou razão dívida/renda < 3x = máximo' },
  { key: 'creditScore', label: 'Utilização de Crédito', max: 20, tip: 'Usar < 30% do limite = máximo' },
  { key: 'budgetScore', label: 'Aderência ao Orçamento', max: 25, tip: 'Nenhuma categoria acima da meta = máximo' },
] as const;

export function HealthScore({ score }: Props) {
  const ringColor =
    score.total >= 70 ? '#38a169' :
    score.total >= 40 ? '#d97706' :
    '#e53e3e';

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score.total / 100) * circumference;

  return (
    <div className="glass-card rounded-lg p-5 animate-fade-in">
      <h3 className="font-display font-semibold text-lg mb-4">Score de Saúde Financeira</h3>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" />
            <circle
              cx="64" cy="64" r="54"
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-display font-bold">{score.total}</span>
            <span className={`text-xs font-semibold ${score.color}`}>{score.grade} — {score.label}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 w-full space-y-3">
          {scoreItems.map(({ key, label, max, tip }) => {
            const val = score[key];
            const pct = (val / max) * 100;
            const color = pct >= 80 ? 'bg-income' : pct >= 50 ? 'bg-warning' : 'bg-expense';
            return (
              <div key={key} title={tip}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{val}/{max}</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full">
                  <div
                    className={`h-1.5 rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
