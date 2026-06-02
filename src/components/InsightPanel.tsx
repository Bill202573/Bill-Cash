import type { Insight } from '@/lib/financial';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface Props {
  insights: Insight[];
  maxVisible?: number;
}

const config = {
  danger:  { icon: XCircle,        bg: 'bg-expense/10',  border: 'border-expense/30',  text: 'text-expense',  iconColor: 'text-expense' },
  warning: { icon: AlertTriangle,   bg: 'bg-warning/10',  border: 'border-warning/30',  text: 'text-warning',  iconColor: 'text-warning' },
  success: { icon: CheckCircle2,    bg: 'bg-income/10',   border: 'border-income/30',   text: 'text-income',   iconColor: 'text-income' },
  info:    { icon: Info,            bg: 'bg-primary/10',  border: 'border-primary/30',  text: 'text-primary',  iconColor: 'text-primary' },
};

export function InsightPanel({ insights, maxVisible }: Props) {
  const visible = maxVisible ? insights.slice(0, maxVisible) : insights;

  if (insights.length === 0) {
    return (
      <div className="glass-card rounded-lg p-5 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-3">Insights do Consultor</h3>
        <p className="text-sm text-muted-foreground">
          Adicione transações, dívidas e orçamento para receber análises personalizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-5 animate-fade-in">
      <h3 className="font-display font-semibold text-lg mb-4">
        Insights do Consultor
        <span className="ml-2 text-xs font-normal text-muted-foreground">({insights.length})</span>
      </h3>
      <div className="space-y-3">
        {visible.map(insight => {
          const { icon: Icon, bg, border, iconColor } = config[insight.severity];
          return (
            <div
              key={insight.id}
              className={`flex gap-3 p-3 rounded-lg border ${bg} ${border}`}
            >
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
              <div>
                <p className="text-sm font-medium leading-snug">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                {insight.action && (
                  <p className={`text-xs font-medium mt-1 ${iconColor}`}>→ {insight.action}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
