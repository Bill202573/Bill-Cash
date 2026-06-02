import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SummaryCard from '@/components/SummaryCard';
import TransactionList from '@/components/TransactionList';
import CategoryBreakdown from '@/components/CategoryBreakdown';
import { CategoryStatement } from '@/components/CategoryStatement';
import CreditCardSection from '@/components/CreditCardSection';
import MonthlyChart from '@/components/MonthlyChart';
import { HealthScore } from '@/components/HealthScore';
import { InsightPanel } from '@/components/InsightPanel';
import { TransactionForm } from '@/components/TransactionForm';
import { useTransactions } from '@/hooks/useTransactions';
import { useDebts } from '@/hooks/useDebts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';
import {
  getMonthlySummary,
  getCategoryBreakdown,
  getIncomeCategoryBreakdown,
  getMonthlyChartData,
  calculateHealthScore,
  generateInsights,
  currentMonth,
  lastNMonths,
  fmt,
} from '@/lib/financial';

// 12 meses disponíveis no seletor (mais antigo → mais recente)
const AVAILABLE_MONTHS = lastNMonths(12).reverse();

function formatMonthLabel(month: string) {
  return new Date(month + '-02').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

export default function Dashboard() {
  const [showForm,      setShowForm]      = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());

  const { data: transactions = [] } = useTransactions();
  const { data: debts        = [] } = useDebts();
  const { data: cards        = [] } = useCreditCards();
  const { data: goals        = [] } = useBudgetGoals();

  // ── Month navigation ──────────────────────────────────────────────────────
  const monthIdx  = AVAILABLE_MONTHS.indexOf(selectedMonth);
  const canGoPrev = monthIdx > 0;
  const canGoNext = monthIdx < AVAILABLE_MONTHS.length - 1;
  const isToday   = selectedMonth === currentMonth();

  const monthLabel = formatMonthLabel(selectedMonth);

  // ── Data derived from selected month ─────────────────────────────────────
  const summary          = useMemo(() => getMonthlySummary(transactions, selectedMonth),         [transactions, selectedMonth]);
  const expenseCategories= useMemo(() => getCategoryBreakdown(transactions, selectedMonth),      [transactions, selectedMonth]);
  const incomeCategories = useMemo(() => getIncomeCategoryBreakdown(transactions, selectedMonth),[transactions, selectedMonth]);
  const monthTxs         = useMemo(() => transactions.filter(t => t.date.startsWith(selectedMonth)), [transactions, selectedMonth]);

  // These always use the current real month (health + chart are "now" metrics)
  const chartData   = useMemo(() => getMonthlyChartData(transactions),                              [transactions]);
  const healthScore = useMemo(() => calculateHealthScore(transactions, debts, cards, goals),         [transactions, debts, cards, goals]);
  const insights    = useMemo(() => generateInsights(transactions, debts, cards, goals),             [transactions, debts, cards, goals]);

  const totalCardBill = cards.reduce((s, c) => s + c.current_bill, 0);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">
            {isToday ? 'Olá! 👋' : 'Histórico'}
          </h2>

          {/* Month navigation */}
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={() => setSelectedMonth(AVAILABLE_MONTHS[monthIdx - 1])}
              disabled={!canGoPrev}
              className="p-1 rounded hover:bg-secondary disabled:opacity-25 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>

            <span className="text-sm font-medium text-muted-foreground capitalize min-w-[150px] text-center">
              {monthLabel}
            </span>

            <button
              onClick={() => setSelectedMonth(AVAILABLE_MONTHS[monthIdx + 1])}
              disabled={!canGoNext}
              className="p-1 rounded hover:bg-secondary disabled:opacity-25 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedMonth(currentMonth())}
                className="ml-1 text-xs text-primary hover:underline font-medium"
              >
                Mês atual
              </button>
            )}
          </div>
        </div>

        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Transação</span>
        </Button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Saldo do Mês"
          value={fmt(summary.balance)}
          change={`${summary.savingsRate >= 0 ? '+' : ''}${summary.savingsRate.toFixed(1)}% de poupança`}
          changeType={summary.balance >= 0 ? 'positive' : 'negative'}
          icon="balance"
        />
        <SummaryCard
          title="Receitas"
          value={fmt(summary.income)}
          change={`${incomeCategories.length} categoria(s)`}
          changeType="positive"
          icon="income"
        />
        <SummaryCard
          title="Despesas"
          value={fmt(summary.expenses)}
          change={`${expenseCategories.length} categoria(s)`}
          changeType={summary.expenses > summary.income ? 'negative' : 'neutral'}
          icon="expense"
        />
        <SummaryCard
          title="Fatura Cartões"
          value={fmt(totalCardBill)}
          change={`${cards.length} cartão(ões) ativo(s)`}
          changeType="neutral"
          icon="credit"
        />
      </div>

      {/* ── Demonstrativo por categoria (full width) ── */}
      <div className="mb-6">
        <CategoryStatement
          expenses={expenseCategories}
          incomes={incomeCategories}
          totalExpenses={summary.expenses}
          totalIncome={summary.income}
        />
      </div>

      {/* ── Health score + Insights (always current month) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <HealthScore score={healthScore} />
        <InsightPanel insights={insights} maxVisible={4} />
      </div>

      {/* ── Monthly trend chart + compact category bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <MonthlyChart data={chartData} />
        <CategoryBreakdown categories={expenseCategories} />
      </div>

      {/* ── Transactions (filtered by month) + Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TransactionList transactions={monthTxs} limit={8} />
        </div>
        <CreditCardSection cards={cards} />
      </div>

      <TransactionForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
