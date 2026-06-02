import { TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: 'balance' | 'income' | 'expense' | 'credit';
}

const iconMap = {
  balance: Wallet,
  income: TrendingUp,
  expense: TrendingDown,
  credit: CreditCard,
};

const SummaryCard = ({ title, value, change, changeType = 'neutral', icon }: SummaryCardProps) => {
  const Icon = iconMap[icon];

  return (
    <div className="glass-card rounded-lg p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className={`p-2 rounded-lg ${
          icon === 'income' ? 'bg-income/10' :
          icon === 'expense' ? 'bg-expense/10' :
          icon === 'credit' ? 'bg-warning/10' :
          'bg-primary/10'
        }`}>
          <Icon className={`h-4 w-4 ${
            icon === 'income' ? 'text-income' :
            icon === 'expense' ? 'text-expense' :
            icon === 'credit' ? 'text-warning' :
            'text-primary'
          }`} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
      {change && (
        <p className={`text-xs mt-1 ${
          changeType === 'positive' ? 'text-income' :
          changeType === 'negative' ? 'text-expense' :
          'text-muted-foreground'
        }`}>
          {change}
        </p>
      )}
    </div>
  );
};

export default SummaryCard;
