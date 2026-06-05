/**
 * Lógica de qual fatura uma compra pertence, baseado no closing_day do cartão.
 *
 * Regra: compras feitas APÓS o dia de fechamento entram na fatura do MÊS SEGUINTE.
 * Compras feitas ATÉ o dia de fechamento (inclusive) entram na fatura do MÊS CORRENTE.
 *
 * Exemplo: closing_day=5
 *   - Compra dia 03/01 → fatura 2026-01 (fecha 05/01, vence ~10/02)
 *   - Compra dia 05/01 → fatura 2026-01
 *   - Compra dia 06/01 → fatura 2026-02 (fecha 05/02, vence ~10/03)
 */

/** Retorna o month_ref (YYYY-MM) da fatura onde a compra deve cair */
export function getBillMonthForPurchase(
  purchaseDate: string,            // YYYY-MM-DD
  closingDay: number | undefined,
): string {
  // Se o cartão não tem closing_day, cai na fatura do próprio mês da compra
  if (!closingDay) {
    return purchaseDate.slice(0, 7);
  }

  const d = new Date(purchaseDate + 'T12:00:00');
  const day = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth();  // 0-based

  // Se comprou APÓS o dia de fechamento, vai para o mês seguinte
  if (day > closingDay) {
    const next = new Date(year, month + 1, 1, 12, 0, 0);
    return next.toISOString().slice(0, 7);
  }

  return purchaseDate.slice(0, 7);
}

/** Retorna a data de fechamento (closing_date) para um mês de fatura */
export function getClosingDateForBill(
  monthRef: string,                // YYYY-MM
  closingDay: number | undefined,
): string | null {
  if (!closingDay) return null;
  const [y, m] = monthRef.split('-').map(Number);
  // Clamp day to last day of month (caso closing_day=31 em fevereiro)
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(closingDay, lastDay);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Retorna a data de vencimento (due_date) para um mês de fatura.
 *  Geralmente o vencimento é no mês SEGUINTE ao mês_ref (após o fechamento). */
export function getDueDateForBill(
  monthRef: string,                // YYYY-MM
  dueDay: number | undefined,
): string | null {
  if (!dueDay) return null;
  const [y, m] = monthRef.split('-').map(Number);
  // Vencimento é no mês seguinte
  const dueYear  = m === 12 ? y + 1 : y;
  const dueMonth = m === 12 ? 1     : m + 1;
  const lastDay = new Date(dueYear, dueMonth, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Gera as N parcelas de uma compra, distribuídas nas faturas corretas */
export function splitIntoInstallments(
  purchaseDate: string,           // YYYY-MM-DD
  totalAmount: number,
  totalInstallments: number,
  closingDay: number | undefined,
): Array<{ installment: number; monthRef: string; amount: number }> {
  const installmentAmount = Math.round((totalAmount / totalInstallments) * 100) / 100;
  const firstMonthRef = getBillMonthForPurchase(purchaseDate, closingDay);
  const [y, m] = firstMonthRef.split('-').map(Number);

  const out: Array<{ installment: number; monthRef: string; amount: number }> = [];
  for (let i = 0; i < totalInstallments; i++) {
    const year  = m + i > 12 ? y + Math.floor((m - 1 + i) / 12) : y;
    const month = ((m - 1 + i) % 12) + 1;
    out.push({
      installment: i + 1,
      monthRef:    `${year}-${String(month).padStart(2, '0')}`,
      amount:      installmentAmount,
    });
  }

  // Ajuste de centavos na ÚLTIMA parcela para fechar o total exato
  const totalDistributed = installmentAmount * totalInstallments;
  const diff = Math.round((totalAmount - totalDistributed) * 100) / 100;
  if (diff !== 0 && out.length > 0) {
    out[out.length - 1].amount = Math.round((out[out.length - 1].amount + diff) * 100) / 100;
  }

  return out;
}

/** Label legível para status da fatura */
export const BILL_STATUS_LABEL: Record<string, string> = {
  open:       'Aberta',
  closed:     'Fechada',
  paid:       'Paga',
  reconciled: 'Conciliada',
};

/** Cor (Tailwind) para o status */
export const BILL_STATUS_COLOR: Record<string, string> = {
  open:       'text-muted-foreground bg-secondary/40',
  closed:     'text-warning bg-warning/10',
  paid:       'text-income bg-income/10',
  reconciled: 'text-primary bg-primary/10',
};

/** Label legível para status da despesa */
export const EXPENSE_STATUS_LABEL: Record<string, string> = {
  pending:   'Pendente',
  confirmed: 'Confirmada',
  refunded:  'Estornada',
};

export const EXPENSE_STATUS_COLOR: Record<string, string> = {
  pending:   'text-warning bg-warning/10',
  confirmed: 'text-income bg-income/10',
  refunded:  'text-expense bg-expense/10',
};

// ─── Classificação de origem (Oficial/Manual/Projeção/Órfã) ──────────────────

/**
 * Identifica de onde veio uma despesa de cartão:
 *
 * - `official`: importada da fatura do banco e confirmada (status='confirmed' + origin='import')
 *   → o banco já cobrou. Fonte da verdade.
 *
 * - `manual`: lançamento manual do usuário (origin='manual')
 *   → você adicionou na mão, ainda pode estar pending ou já confirmou.
 *
 * - `projection`: parcela projetada de uma compra parcelada (purchase_group_id presente, pending)
 *   → criada automaticamente quando você projetou as N parcelas. Vai virar 'official'
 *     quando a fatura desse mês for importada do banco.
 *
 * - `orphan_projection`: projeção em uma fatura que JÁ DEVERIA TER vindo do banco
 *   → fatura fechada (closing_date passou) e ainda está pending = não foi cobrada.
 *   → talvez a compra foi cancelada, ou você marcou parcelas erradas.
 *   → o sistema avisa para você revisar.
 */
export type ExpenseSource = 'official' | 'manual' | 'projection' | 'orphan_projection';

export interface CardExpenseLike {
  status: string;             // pending | confirmed | refunded
  origin: string;             // import | manual
  purchase_group_id?: string | null;
}

export interface CardBillLike {
  closing_date?: string;      // YYYY-MM-DD
  month_ref?:    string;      // YYYY-MM
}

export function classifyExpenseSource(
  exp:   CardExpenseLike,
  bill?: CardBillLike,
  today: Date = new Date(),
): ExpenseSource {
  // Confirmada + veio do import = oficial do banco
  if (exp.status === 'confirmed' && exp.origin === 'import') {
    return 'official';
  }

  // Pendente + tem purchase_group_id = parcela projetada
  if (exp.status === 'pending' && exp.purchase_group_id) {
    // Se a fatura já fechou e ainda está pending, é órfã
    const closing = bill?.closing_date;
    if (closing) {
      const closingDate = new Date(closing + 'T12:00:00');
      if (closingDate < today) return 'orphan_projection';
    } else if (bill?.month_ref) {
      // Sem closing_date: usa o month_ref para inferir
      // Se o mês já passou completamente, considera órfã
      const [y, m] = bill.month_ref.split('-').map(Number);
      const endOfMonth = new Date(y, m, 0, 23, 59, 59); // último dia do mês
      if (endOfMonth < today) return 'orphan_projection';
    }
    return 'projection';
  }

  // Caso contrário (manual pending, manual confirmed) = manual
  return 'manual';
}

export const EXPENSE_SOURCE_LABEL: Record<ExpenseSource, string> = {
  official:          'Oficial',
  manual:            'Manual',
  projection:        'Projetada',
  orphan_projection: 'Não cobrada',
};

export const EXPENSE_SOURCE_COLOR: Record<ExpenseSource, string> = {
  official:          'text-income bg-income/10',
  manual:            'text-foreground bg-secondary/40',
  projection:        'text-primary bg-primary/10',
  orphan_projection: 'text-warning bg-warning/15 border border-warning/30',
};

export const EXPENSE_SOURCE_ICON: Record<ExpenseSource, string> = {
  official:          '✓',
  manual:            '✎',
  projection:        '🔮',
  orphan_projection: '⚠',
};
