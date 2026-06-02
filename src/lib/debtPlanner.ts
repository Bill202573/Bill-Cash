import type { Debt } from './supabase';

export type PlanMethod = 'snowball' | 'avalanche';

export interface DebtPayoff {
  debtId: string;
  name: string;
  paidOffMonth: number;
  totalInterestPaid: number;
}

export interface PlanResult {
  method: PlanMethod;
  totalMonths: number;
  totalInterestPaid: number;
  payoffDateLabel: string;
  debtPayoffs: DebtPayoff[];
  monthlyCost: number; // total minimum payments + extra
}

export function simulatePayoff(
  debts: Debt[],
  extraMonthly: number,
  method: PlanMethod,
): PlanResult {
  if (debts.length === 0) {
    return {
      method,
      totalMonths: 0,
      totalInterestPaid: 0,
      payoffDateLabel: '—',
      debtPayoffs: [],
      monthlyCost: 0,
    };
  }

  // Sort by method
  const sorted = method === 'snowball'
    ? [...debts].sort((a, b) => a.balance - b.balance)
    : [...debts].sort((a, b) => b.interest_rate - a.interest_rate);

  // Simulation state
  const state = sorted.map(d => ({
    id: d.id,
    name: d.name,
    remaining: d.balance,
    interest_rate: d.interest_rate,
    minimum_payment: d.minimum_payment,
    paidInterest: 0,
    paidOffMonth: 0,
    done: false,
  }));

  const totalMinimum = debts.reduce((s, d) => s + d.minimum_payment, 0);
  let month = 0;
  let totalInterest = 0;
  const MAX_MONTHS = 600;

  while (state.some(d => !d.done) && month < MAX_MONTHS) {
    month++;

    // 1. Apply monthly interest to all active debts
    for (const d of state) {
      if (!d.done) {
        const interest = d.remaining * (d.interest_rate / 100);
        d.remaining += interest;
        d.paidInterest += interest;
        totalInterest += interest;
      }
    }

    // 2. Pay minimum on all debts
    let freed = 0;
    for (const d of state) {
      if (!d.done) {
        const pay = Math.min(d.minimum_payment, d.remaining);
        d.remaining -= pay;
        if (d.remaining <= 0.01) {
          freed += Math.abs(d.remaining);
          d.remaining = 0;
          d.done = true;
          d.paidOffMonth = month;
        }
      }
    }

    // 3. Apply extra payment + freed to target debt (first not-done in sorted order)
    let available = extraMonthly + freed;
    for (const d of state) {
      if (!d.done && available > 0.01) {
        const pay = Math.min(available, d.remaining);
        d.remaining -= pay;
        available -= pay;
        if (d.remaining <= 0.01) {
          available += Math.abs(d.remaining);
          d.remaining = 0;
          d.done = true;
          d.paidOffMonth = month;
        }
      }
    }
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + month);
  const payoffDateLabel = payoffDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return {
    method,
    totalMonths: month,
    totalInterestPaid: totalInterest,
    payoffDateLabel,
    debtPayoffs: state.map(d => ({
      debtId: d.id,
      name: d.name,
      paidOffMonth: d.paidOffMonth,
      totalInterestPaid: d.paidInterest,
    })),
    monthlyCost: totalMinimum + extraMonthly,
  };
}

export function compareMethods(debts: Debt[], extraMonthly: number) {
  return {
    snowball: simulatePayoff(debts, extraMonthly, 'snowball'),
    avalanche: simulatePayoff(debts, extraMonthly, 'avalanche'),
  };
}
