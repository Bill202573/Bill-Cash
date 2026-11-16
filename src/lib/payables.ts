import type { CardBill, CardExpense, CreditCard, Debt } from './supabase';
import type { FixedBill, FixedBillPayment } from '@/hooks/useFixedBills';
import { billAppliesToMonth, resolveDueDate, isPaymentDone, calculateLateFee } from '@/hooks/useFixedBills';
import type { CardRecurring } from '@/hooks/useCardRecurring';
import { addMonthsToYYYYMM } from './parcelas';

/**
 * Contas a pagar de UM mês (vencimento no mês), juntando contas fixas, faturas de cartão
 * (+ cobranças recorrentes previstas no cartão) e parcelas de dívidas. Função pura: a tela só exibe.
 */
export type PayableKind = 'fixed' | 'card' | 'recurring' | 'debt';
export type PayableStatus = 'paid' | 'overdue' | 'pending' | 'projected';

export interface Payable {
  key: string;
  kind: PayableKind;
  title: string;
  subtitle?: string;
  due: Date | null;           // null = sem dia definido
  amount: number | null;      // null = valor ainda não definido
  paidAmount: number;
  status: PayableStatus;
  /** multa + juros já acumulados (só contas fixas em atraso) */
  extra: number;
  daysLate: number;
  link: { to: string; state?: unknown };
}

export interface PayablesInput {
  month: string;              // YYYY-MM
  today: Date;
  fixedBills: FixedBill[];
  payments: FixedBillPayment[];
  cards: CreditCard[];
  bills: CardBill[];
  cardExpenses: CardExpense[];
  recurring: CardRecurring[];
  debts: Debt[];
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const r2 = (n: number) => Math.round(n * 100) / 100;
const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dateFrom = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00');
const dayInMonth = (ym: string, day: number) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Math.max(day, 1), last), 12);
};

export function buildPayables(inp: PayablesInput): { month: Payable[]; overdue: Payable[] } {
  const { month, today } = inp;
  const curMonth = ymOf(today);
  const startOfMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 0);
  const out: Payable[] = [];
  const overdue: Payable[] = [];
  const payMap = new Map(inp.payments.map(p => [`${p.bill_id}|${p.year_month}`, p]));

  // ── Contas fixas ──
  for (const bill of inp.fixedBills) {
    if (!bill.active) continue;
    // competências cujo vencimento pode cair neste mês (offset) e, no mês atual, as vencidas dos últimos 12 meses
    const first = month === curMonth ? -12 : -1;
    for (let i = first; i <= 1; i++) {
      const ym = addMonthsToYYYYMM(month, i);
      if (!billAppliesToMonth(bill, ym)) continue;
      const p = payMap.get(`${bill.id}|${ym}`);
      const due = resolveDueDate(bill, p, ym);
      const dueYm = ymOf(due);
      const done = isPaymentDone(p);
      const inMonth = dueYm === month;
      const isOld = month === curMonth && due < startOfMonth && !done;
      if (!inMonth && !isOld) continue;
      const base = Number(p?.expected_amount ?? bill.expected_amount ?? 0) || null;
      const late = !done && due < today ? calculateLateFee(bill, p, ym, today) : null;
      const item: Payable = {
        key: `f|${bill.id}|${ym}`,
        kind: 'fixed',
        title: bill.name,
        subtitle: ym !== dueYm ? `ref. ${ym}` : undefined,
        due,
        amount: done ? Number(p!.paid_amount) : base,
        paidAmount: done ? Number(p!.paid_amount) : 0,
        status: done ? 'paid' : due < today ? 'overdue' : 'pending',
        extra: late?.extraCharges ?? 0,
        daysLate: late?.daysLate ?? 0,
        link: { to: '/contas-fixas', state: { billId: bill.id, yearMonth: ym } },
      };
      (isOld ? overdue : out).push(item);
    }
  }

  // ── Faturas de cartão ──
  const cardById = new Map(inp.cards.map(c => [c.id, c]));
  const expByBill = new Map<string, CardExpense[]>();
  for (const e of inp.cardExpenses) if (e.bill_id) (expByBill.get(e.bill_id) ?? expByBill.set(e.bill_id, []).get(e.bill_id)!).push(e);

  const billOfMonth = new Map<string, CardBill>(); // card_id -> fatura que vence neste mês
  for (const b of inp.bills) {
    const card = cardById.get(b.card_id);
    if (!card) continue;
    const due = b.due_date ? dateFrom(b.due_date) : dayInMonth(b.month_ref, card.due_day ?? 10);
    const done = b.status === 'reconciled' || b.status === 'paid';
    const dueYm = ymOf(due);
    if (dueYm === month) billOfMonth.set(b.card_id, b);
    const inMonth = dueYm === month;
    const isOld = month === curMonth && due < startOfMonth && !done;
    if (!inMonth && !isOld) continue;
    const remaining = r2(Math.max(Number(b.total_amount) - Number(b.paid_amount ?? 0), 0));
    const item: Payable = {
      key: `c|${b.id}`,
      kind: 'card',
      title: `Fatura ${card.name}`,
      subtitle: b.status === 'open' ? 'aberta (ainda recebendo compras)' : done ? undefined : 'fechada',
      due,
      amount: done ? Number(b.paid_amount || b.total_amount) : remaining,
      paidAmount: done ? Number(b.paid_amount || b.total_amount) : Number(b.paid_amount ?? 0),
      status: done ? 'paid' : due < today ? 'overdue' : 'pending',
      extra: 0,
      daysLate: !done && due < today ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0,
      link: { to: `/cartoes/${b.card_id}` },
    };
    (isOld ? overdue : out).push(item);
  }

  // ── Cobranças recorrentes previstas no cartão (ex.: Bancorbras) ──
  for (const r of inp.recurring) {
    if (!r.active) continue;
    if (r.active_since && month < r.active_since) continue;
    if (r.active_until && month > r.active_until) continue;
    const card = cardById.get(r.card_id);
    if (!card) continue;
    const bill = billOfMonth.get(r.card_id);
    if (bill && (bill.status === 'reconciled' || bill.status === 'paid')) continue;
    const kw = norm(r.keyword);
    const already = bill && (expByBill.get(bill.id) ?? []).some(e => e.status !== 'refunded' && norm(e.description).includes(kw));
    if (already) continue; // a compra real já está na fatura: a projeção sai de cena
    const due = bill?.due_date ? dateFrom(bill.due_date) : dayInMonth(month, card.due_day ?? 10);
    out.push({
      key: `r|${r.id}|${month}`,
      kind: 'recurring',
      title: r.description,
      subtitle: `previsto na fatura ${card.name}; ainda não apareceu no cartão`,
      due,
      amount: r.amount,
      paidAmount: 0,
      status: 'projected',
      extra: 0,
      daysLate: 0,
      link: { to: `/cartoes/${r.card_id}` },
    });
  }

  // ── Parcelas mínimas de dívidas (sem controle de pagamento: ficam como previstas) ──
  for (const d of inp.debts) {
    const min = Number(d.minimum_payment ?? 0);
    const bal = Number(d.corrected_balance ?? d.balance ?? 0);
    if (min <= 0 || bal <= 0) continue;
    out.push({
      key: `d|${d.id}`,
      kind: 'debt',
      title: `Dívida: ${d.name}`,
      subtitle: 'parcela mínima mensal',
      due: d.due_day ? dayInMonth(month, d.due_day) : null,
      amount: Math.min(min, bal),
      paidAmount: 0,
      status: 'projected',
      extra: 0,
      daysLate: 0,
      link: { to: '/dividas' },
    });
  }

  const byDue = (a: Payable, b: Payable) => (a.due?.getTime() ?? 9e15) - (b.due?.getTime() ?? 9e15);
  return { month: out.sort(byDue), overdue: overdue.sort(byDue) };
}
