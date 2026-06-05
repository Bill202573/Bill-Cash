import { CreditCard, Info } from 'lucide-react';
import { useIncludeCardExpensesFlag } from '@/hooks/useUnifiedTransactions';

interface Props {
  compact?: boolean;       // versão menor (para topo de tela com pouco espaço)
}

export function IncludeCardsToggle({ compact = false }: Props) {
  const [include, setInclude] = useIncludeCardExpensesFlag();

  if (compact) {
    return (
      <label className="flex items-center gap-2 cursor-pointer text-xs bg-secondary/40 hover:bg-secondary/60 rounded-md px-2.5 py-1.5 transition-colors">
        <CreditCard className="h-3 w-3 text-muted-foreground" />
        <input
          type="checkbox"
          checked={include}
          onChange={e => setInclude(e.target.checked)}
          className="accent-primary"
        />
        <span className="font-medium">Incluir despesas de cartão por categoria</span>
      </label>
    );
  }

  return (
    <div className="glass-card rounded-lg p-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={include}
          onChange={e => setInclude(e.target.checked)}
          className="accent-primary mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-medium">Incluir despesas de cartão por categoria</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {include
              ? 'Despesas confirmadas dos cartões aparecem nos gráficos com sua categoria original (iFood = Alimentação, Uber = Transporte). O lump-sum "Pagamento Cartão" é excluído para não duplicar.'
              : 'Apenas transações bancárias. O pagamento da fatura aparece como uma única despesa de "Pagamento Cartão".'}
          </p>
        </div>
        <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
      </label>
    </div>
  );
}
