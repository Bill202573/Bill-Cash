import type { Transaction, Debt, CreditCard, BudgetGoal } from './supabase';

export const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const fmtCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const lastNMonths = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getMonthlySummary(transactions: Transaction[], month: string) {
  const txs = transactions.filter(t => t.date.startsWith(month) && t.type !== 'transfer');
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  return { income, expenses, balance, savingsRate };
}

export function getCategoryBreakdown(transactions: Transaction[], month: string) {
  const txs = transactions.filter(t => t.date.startsWith(month) && t.type === 'expense');
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const map: Record<string, { amount: number; count: number }> = {};
  txs.forEach(t => {
    if (!map[t.category]) map[t.category] = { amount: 0, count: 0 };
    map[t.category].amount += t.amount;
    map[t.category].count  += 1;
  });
  return Object.entries(map)
    .map(([name, { amount, count }]) => ({
      name,
      amount,
      count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

export function getIncomeCategoryBreakdown(transactions: Transaction[], month: string) {
  const txs = transactions.filter(t => t.date.startsWith(month) && t.type === 'income');
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const map: Record<string, { amount: number; count: number }> = {};
  txs.forEach(t => {
    if (!map[t.category]) map[t.category] = { amount: 0, count: 0 };
    map[t.category].amount += t.amount;
    map[t.category].count  += 1;
  });
  return Object.entries(map)
    .map(([name, { amount, count }]) => ({
      name,
      amount,
      count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

export function getMonthlyChartData(transactions: Transaction[]) {
  const months = lastNMonths(6).reverse();
  return months.map(month => {
    const { income, expenses } = getMonthlySummary(transactions, month);
    const date = new Date(month + '-01T12:00:00');
    return {
      month: date.toLocaleDateString('pt-BR', { month: 'short' }),
      receitas: income,
      despesas: expenses,
    };
  });
}

// ─── Health Score (0–100) ─────────────────────────────────────────────────────

export interface HealthScore {
  total: number;
  savingsScore: number;   // 0-30
  debtScore: number;      // 0-25
  creditScore: number;    // 0-20
  budgetScore: number;    // 0-25
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  color: string;
}

export function calculateHealthScore(
  transactions: Transaction[],
  debts: Debt[],
  creditCards: CreditCard[],
  budgetGoals: BudgetGoal[],
): HealthScore {
  const month = currentMonth();
  const { income, expenses } = getMonthlySummary(transactions, month);

  // 1. Taxa de poupança (0–30)
  let savingsScore = 0;
  if (income > 0) {
    const rate = (income - expenses) / income;
    if (rate >= 0.2) savingsScore = 30;
    else if (rate >= 0.1) savingsScore = 20;
    else if (rate >= 0) savingsScore = 10;
  }

  // 2. Razão dívida/renda (0–25)
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  let debtScore = 25;
  if (income > 0 && totalDebt > 0) {
    const ratio = totalDebt / income;
    if (ratio < 3) debtScore = 20;
    else if (ratio < 6) debtScore = 10;
    else debtScore = 0;
  } else if (totalDebt > 0) {
    debtScore = 0;
  }

  // 3. Utilização de crédito (0–20)
  const totalBill = creditCards.reduce((s, c) => s + c.current_bill, 0);
  const totalLimit = creditCards.reduce((s, c) => s + c.credit_limit, 0);
  let creditScore = 20;
  if (totalLimit > 0) {
    const u = totalBill / totalLimit;
    if (u < 0.3) creditScore = 20;
    else if (u < 0.5) creditScore = 15;
    else if (u < 0.7) creditScore = 8;
    else creditScore = 0;
  }

  // 4. Aderência ao orçamento (0–25)
  const monthGoals = budgetGoals.filter(g => g.month === month);
  let budgetScore = 15;
  if (monthGoals.length > 0) {
    const spent = getCategoryBreakdown(transactions, month).reduce(
      (acc, c) => ({ ...acc, [c.name]: c.amount }), {} as Record<string, number>
    );
    const over = monthGoals.filter(g => (spent[g.category] || 0) > g.monthly_limit).length;
    budgetScore = Math.round((1 - over / monthGoals.length) * 25);
  }

  const total = savingsScore + debtScore + creditScore + budgetScore;

  let grade: HealthScore['grade'];
  let label: string;
  let color: string;
  if (total >= 85) { grade = 'A'; label = 'Excelente'; color = 'text-income'; }
  else if (total >= 70) { grade = 'B'; label = 'Boa'; color = 'text-income'; }
  else if (total >= 55) { grade = 'C'; label = 'Regular'; color = 'text-warning'; }
  else if (total >= 40) { grade = 'D'; label = 'Preocupante'; color = 'text-warning'; }
  else { grade = 'F'; label = 'Crítica'; color = 'text-expense'; }

  return { total, savingsScore, debtScore, creditScore, budgetScore, grade, label, color };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export type InsightSeverity = 'danger' | 'warning' | 'success' | 'info';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  action?: string;
}

export function generateInsights(
  transactions: Transaction[],
  debts: Debt[],
  creditCards: CreditCard[],
  budgetGoals: BudgetGoal[],
): Insight[] {
  const insights: Insight[] = [];
  const month = currentMonth();
  const prevMonth = lastNMonths(2)[1];

  const { income, expenses, savingsRate } = getMonthlySummary(transactions, month);
  const prevSummary = getMonthlySummary(transactions, prevMonth);

  // Poupança negativa
  if (income > 0 && expenses > income) {
    const diff = fmt(expenses - income);
    insights.push({
      id: 'savings-negative',
      severity: 'danger',
      title: 'Você está gastando mais do que ganha',
      description: `Suas despesas superaram a renda em ${diff} este mês. Isso está corroendo sua reserva.`,
      action: 'Corte gastos não essenciais imediatamente',
    });
  } else if (income > 0 && savingsRate < 10) {
    insights.push({
      id: 'savings-low',
      severity: 'warning',
      title: 'Taxa de poupança muito baixa',
      description: `Você está poupando apenas ${savingsRate.toFixed(1)}% da renda. O ideal é pelo menos 20%.`,
      action: 'Revise seus gastos por categoria no Orçamento',
    });
  } else if (income > 0 && savingsRate >= 20) {
    insights.push({
      id: 'savings-good',
      severity: 'success',
      title: `Taxa de poupança de ${savingsRate.toFixed(0)}% — Excelente!`,
      description: 'Você está poupando acima do recomendado. Continue assim e acelere o pagamento de dívidas.',
    });
  }

  // Comparação mês anterior
  if (prevSummary.expenses > 0 && expenses > 0) {
    const change = ((expenses - prevSummary.expenses) / prevSummary.expenses) * 100;
    if (change > 20) {
      insights.push({
        id: 'expenses-rising',
        severity: 'warning',
        title: `Gastos subiram ${change.toFixed(0)}% este mês`,
        description: `Em ${fmt(expenses)} este mês contra ${fmt(prevSummary.expenses)} no mês passado.`,
        action: 'Identifique categorias fora do controle',
      });
    } else if (change < -10) {
      insights.push({
        id: 'expenses-falling',
        severity: 'success',
        title: `Você reduziu os gastos em ${Math.abs(change).toFixed(0)}%`,
        description: `Ótima evolução: ${fmt(prevSummary.expenses)} → ${fmt(expenses)}. Mantenha o ritmo!`,
      });
    }
  }

  // Moradia acima de 30%
  if (income > 0) {
    const cats = getCategoryBreakdown(transactions, month);
    const moradia = cats.find(c => c.name === 'Moradia');
    if (moradia && moradia.percentage > 30) {
      insights.push({
        id: 'housing-high',
        severity: 'warning',
        title: `Moradia consome ${moradia.percentage.toFixed(0)}% da renda`,
        description: `O recomendado é até 30%. Você está gastando ${fmt(moradia.amount)} com moradia.`,
      });
    }

    // Alimentação acima de 20%
    const alim = cats.find(c => c.name === 'Alimentação');
    if (alim && alim.percentage > 20) {
      insights.push({
        id: 'food-high',
        severity: 'info',
        title: `Alimentação usa ${alim.percentage.toFixed(0)}% da renda`,
        description: `${fmt(alim.amount)} em alimentação este mês. Cozinhar mais em casa pode reduzir isso.`,
        action: 'Defina uma meta no Orçamento para Alimentação',
      });
    }
  }

  // Dívidas com juros altos
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  if (totalDebt > 0) {
    const highInterest = debts.filter(d => d.interest_rate > 5);
    if (highInterest.length > 0) {
      const avgRate = highInterest.reduce((s, d) => s + d.interest_rate, 0) / highInterest.length;
      insights.push({
        id: 'high-interest-debt',
        severity: 'danger',
        title: `${highInterest.length} dívida(s) com juros altos (${avgRate.toFixed(1)}% a.m.)`,
        description: `Total em dívidas: ${fmt(totalDebt)}. Juros compostos estão aumentando sua dívida a cada mês.`,
        action: 'Use o Planejador de Dívidas para criar sua estratégia de quitação',
      });
    } else {
      insights.push({
        id: 'debt-exists',
        severity: 'info',
        title: `Total em dívidas: ${fmt(totalDebt)}`,
        description: `Juros médios de ${(debts.reduce((s, d) => s + d.interest_rate, 0) / debts.length).toFixed(2)}% ao mês.`,
        action: 'Acesse o Planejador de Dívidas para simular a quitação',
      });
    }
  } else if (debts.length === 0) {
    insights.push({
      id: 'no-debt',
      severity: 'success',
      title: 'Livre de dívidas!',
      description: 'Parabéns! Mantenha-se fora das dívidas e direcione o excedente para investimentos.',
    });
  }

  // Cartões com alta utilização
  creditCards
    .filter(c => c.credit_limit > 0 && c.current_bill / c.credit_limit > 0.7)
    .forEach(card => {
      const pct = ((card.current_bill / card.credit_limit) * 100).toFixed(0);
      insights.push({
        id: `card-over-${card.id}`,
        severity: 'warning',
        title: `Cartão ${card.name} com ${pct}% do limite usado`,
        description: `Utilização acima de 70% prejudica sua saúde financeira e pode levar a endividamento.`,
        action: 'Pague parte da fatura para reduzir a utilização',
      });
    });

  // Orçamento estourado
  const catSpent = getCategoryBreakdown(transactions, month)
    .reduce((acc, c) => ({ ...acc, [c.name]: c.amount }), {} as Record<string, number>);

  budgetGoals
    .filter(g => g.month === month && (catSpent[g.category] || 0) > g.monthly_limit)
    .forEach(g => {
      const over = fmt((catSpent[g.category] || 0) - g.monthly_limit);
      insights.push({
        id: `budget-over-${g.category}`,
        severity: 'danger',
        title: `Meta de ${g.category} estourada em ${over}`,
        description: `Você definiu ${fmt(g.monthly_limit)} para ${g.category} mas gastou ${fmt(catSpent[g.category] || 0)}.`,
      });
    });

  // Ordenar: danger → warning → info → success
  const order: InsightSeverity[] = ['danger', 'warning', 'info', 'success'];
  return insights.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

// ─── Cash Flow Projection ─────────────────────────────────────────────────────

export function projectCashFlow(transactions: Transaction[], months = 3) {
  const past = lastNMonths(3);
  const avgIncome = past.reduce((s, m) => s + getMonthlySummary(transactions, m).income, 0) / 3;
  const avgExpenses = past.reduce((s, m) => s + getMonthlySummary(transactions, m).expenses, 0) / 3;

  return Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1);
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      income: avgIncome,
      expenses: avgExpenses,
      balance: avgIncome - avgExpenses,
    };
  });
}
