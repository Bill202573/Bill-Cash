import type { Transaction, CardBill, CardExpense, CreditCard, Debt } from './supabase';
import type { FixedBill, FixedBillPayment } from '@/hooks/useFixedBills';
import { billAppliesToMonth, resolveDueDate, isPaymentDone } from '@/hooks/useFixedBills';
import { addMonthsToYYYYMM } from './parcelas';

/** Linha da view card_future_installments (parcelas ainda por vencer, por mês de fatura) */
export interface FutureInstallment {
  card_id: string;
  item: string;
  amount: number;
  bill_month: string;
  installment?: number | null;
  total_installments?: number | null;
}

export interface CashFlowInput {
  /** Mês corrente (YYYY-MM): o fluxo começa nele */
  startMonth: string;
  months?: number;
  startingCash: number;
  transactions: Transaction[];
  cards: CreditCard[];
  bills: CardBill[];
  cardExpenses: CardExpense[];
  future: FutureInstallment[];
  fixedBills: FixedBill[];
  payments: FixedBillPayment[];
  debts: Debt[];
  /** Fração (0..1) da receita variável considerada na projeção */
  variableIncomePct: number;
}

export interface FlowLine { label: string; amount: number; note?: string }

export interface MonthFlow {
  month: string;
  incomeRecurring: number;
  incomeVariable: number;
  /** Faturas e parcelas de cartão já assumidas */
  cards: number;
  /** Contas fixas (inclui as em atraso) + parcelas mínimas de dívidas */
  fixed: number;
  /** Despesas que se repetem todo mês (aluguel etc.), detectadas no histórico */
  recurring: number;
  /** Estimativa: gastos variáveis + novas compras no cartão */
  estimated: number;
  totalIn: number;
  totalOut: number;
  net: number;
  balance: number;
  lines: {
    incomeRecurring: FlowLine[];
    incomeVariable: FlowLine[];
    cards: FlowLine[];
    fixed: FlowLine[];
    recurring: FlowLine[];
    estimated: FlowLine[];
  };
}

export interface CashFlowResult {
  months: MonthFlow[];
  notes: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const EXCLUDED_CATEGORIES = new Set(['Pagamento Cartão', 'Investimentos']);
const GENERIC_WORDS = new Set(['mensalidade', 'condominio', 'conta', 'iptu', 'pagamento', 'natura', 'recreio', 'taquara']);
const ADJUSTMENT_LABEL = 'Ajuste de conciliação';

/** Chave estável para agrupar lançamentos do mesmo favorecido ("Transferência enviada pelo Pix - X - ..." → "x") */
function descKey(desc: string): string {
  return norm(desc)
    .replace(/transferencia (enviada|recebida)( pelo pix)?/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const monthOf = (date: string) => date.slice(0, 7);

/** Palavras que identificam uma conta fixa nas descrições do extrato (para não contar duas vezes) */
function fixedBillMatchers(bills: FixedBill[]): RegExp[] {
  const out: RegExp[] = [];
  for (const b of bills) {
    if (!b.active) continue;
    const tokens = [
      ...(b.keywords ?? []).map(norm),
      ...norm(b.name).split(/[^a-z]+/).filter(w => w.length >= 3 && !GENERIC_WORDS.has(w)),
    ].filter(Boolean);
    for (const t of tokens) {
      out.push(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
    }
  }
  return out;
}

interface Pattern {
  type: 'income' | 'expense';
  key: string;
  label: string;
  perMonth: Record<string, number>;
}

export function computeCashFlow(input: CashFlowInput): CashFlowResult {
  const n = input.months ?? 12;
  const start = input.startMonth;
  const horizon = Array.from({ length: n }, (_, i) => addMonthsToYYYYMM(start, i));
  const hist = Array.from({ length: 4 }, (_, i) => addMonthsToYYYYMM(start, -(4 - i)));
  const notes: string[] = [];

  const rows: MonthFlow[] = horizon.map(month => ({
    month,
    incomeRecurring: 0, incomeVariable: 0, cards: 0, fixed: 0, recurring: 0, estimated: 0,
    totalIn: 0, totalOut: 0, net: 0, balance: 0,
    lines: { incomeRecurring: [], incomeVariable: [], cards: [], fixed: [], recurring: [], estimated: [] },
  }));
  const byMonth = new Map(rows.map(r => [r.month, r]));
  const add = (month: string, kind: keyof MonthFlow['lines'], label: string, amount: number, note?: string) => {
    const row = byMonth.get(month);
    if (!row || amount <= 0.004) return;
    const a = r2(amount);
    row.lines[kind].push({ label, amount: a, note });
    row[kind] = r2(row[kind] + a);
  };

  // ─── 1. Cartões: faturas abertas/fechadas + parcelas futuras ──────────────
  const cardName = new Map(input.cards.map(c => [c.id, c.name]));
  const expensesByBill = new Map<string, CardExpense[]>();
  for (const e of input.cardExpenses) {
    if (!e.bill_id) continue;
    (expensesByBill.get(e.bill_id) ?? expensesByBill.set(e.bill_id, []).get(e.bill_id)!).push(e);
  }
  /** Compras "novas" da fatura: à vista ou 1ª parcela (as demais parcelas já são compromisso) */
  const newPurchases = (billId: string) =>
    (expensesByBill.get(billId) ?? [])
      .filter(e => e.status === 'confirmed' && (e.installment ?? 1) <= 1
        && e.category !== 'Juros e Multas' && !e.description.startsWith(ADJUSTMENT_LABEL))
      .reduce((s, e) => s + Number(e.amount), 0);

  for (const card of input.cards) {
    const name = card.name;
    const cardBills = input.bills.filter(b => b.card_id === card.id);
    const billByMonth = new Map(cardBills.map(b => [b.month_ref, b]));

    // Faturas anteriores ao mês corrente ainda não pagas = em atraso, entram no mês 0
    for (const b of cardBills) {
      if (b.month_ref >= start || b.status === 'reconciled' || b.status === 'paid') continue;
      add(start, 'cards', `${name} — fatura ${b.month_ref} em aberto`, Number(b.total_amount) - Number(b.paid_amount ?? 0), 'em atraso');
    }

    const last3 = cardBills.filter(b => b.month_ref < start).sort((a, b) => b.month_ref.localeCompare(a.month_ref)).slice(0, 3);
    const avgNew = last3.length ? last3.reduce((s, b) => s + newPurchases(b.id), 0) / last3.length : 0;

    for (const month of horizon) {
      const bill = billByMonth.get(month);
      if (bill) {
        if (bill.status !== 'reconciled' && bill.status !== 'paid') {
          const remaining = Number(bill.total_amount) - Number(bill.paid_amount ?? 0);
          add(month, 'cards', `${name} — fatura ${bill.status === 'open' ? 'aberta' : 'fechada'}`, remaining);
        }
        if (bill.status === 'open') add(month, 'estimated', `${name} — novas compras até o fechamento`, avgNew - newPurchases(bill.id));
      } else {
        const parcels = input.future.filter(f => f.card_id === card.id && f.bill_month === month);
        const total = parcels.reduce((s, f) => s + Number(f.amount), 0);
        add(month, 'cards', `${name} — ${parcels.length} parcela${parcels.length === 1 ? '' : 's'} já assumida${parcels.length === 1 ? '' : 's'}`, total);
        add(month, 'estimated', `${name} — novas compras (média dos últimos meses)`, avgNew);
      }
    }
  }

  // ─── 2. Contas fixas ───────────────────────────────────────────────────────
  const payKey = (billId: string, ym: string) => `${billId}|${ym}`;
  const payMap = new Map(input.payments.map(p => [payKey(p.bill_id, p.year_month), p]));
  const handled = new Set<string>();

  // Em atraso: competências passadas com valor definido e sem pagamento
  for (const p of input.payments) {
    const bill = input.fixedBills.find(b => b.id === p.bill_id);
    if (!bill || !bill.active || isPaymentDone(p) || p.year_month >= start) continue;
    const amount = Number(p.expected_amount ?? 0);
    if (amount <= 0 || !billAppliesToMonth(bill, p.year_month)) continue;
    handled.add(payKey(bill.id, p.year_month));
    add(start, 'fixed', `${bill.name} — ${p.year_month} em atraso`, amount, 'em atraso');
  }

  for (const bill of input.fixedBills) {
    if (!bill.active) continue;
    const paid = input.payments
      .filter(p => p.bill_id === bill.id && isPaymentDone(p) && p.year_month < start)
      .sort((a, b) => b.year_month.localeCompare(a.year_month))
      .slice(0, 3);
    const avgPaid = paid.length ? paid.reduce((s, p) => s + Number(p.paid_amount), 0) / paid.length : 0;

    for (let i = -1; i <= n; i++) {
      const ym = addMonthsToYYYYMM(start, i);
      if (handled.has(payKey(bill.id, ym)) || !billAppliesToMonth(bill, ym)) continue;
      const p = payMap.get(payKey(bill.id, ym));
      if (isPaymentDone(p)) continue;
      const due = resolveDueDate(bill, p, ym);
      const dueMonth = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
      if (dueMonth < start || !byMonth.has(dueMonth)) continue;
      const explicit = Number(p?.expected_amount ?? bill.expected_amount ?? 0);
      const amount = explicit > 0 ? explicit : avgPaid;
      add(dueMonth, 'fixed', bill.name, amount, explicit > 0 ? undefined : 'média dos últimos pagamentos');
    }
  }

  // ─── 3. Dívidas com parcela mínima definida ────────────────────────────────
  let debtsWithoutPayment = 0;
  for (const d of input.debts) {
    const min = Number(d.minimum_payment ?? 0);
    const balance = Number((d as { corrected_balance?: number | null }).corrected_balance ?? d.balance ?? 0);
    if (balance <= 0) continue;
    if (min <= 0) { debtsWithoutPayment += balance; continue; }
    let left = balance;
    for (const month of horizon) {
      if (left <= 0) break;
      const pay = Math.min(min, left);
      add(month, 'fixed', `Dívida: ${d.name}`, pay);
      left -= pay;
    }
  }
  if (debtsWithoutPayment > 0) {
    notes.push(`Dívidas sem parcela mensal definida somam R$ ${Math.round(debtsWithoutPayment).toLocaleString('pt-BR')} e não entram no fluxo. Defina o valor mensal na tela de Dívidas para incluí-las.`);
  }

  // ─── 4. Recorrentes e variáveis a partir do histórico do extrato ───────────
  const matchers = fixedBillMatchers(input.fixedBills);
  const histSet = new Set(hist);
  const txs = input.transactions.filter(t =>
    (t.type === 'income' || t.type === 'expense')
    && t.reconciliation_status !== 'circular'
    && !EXCLUDED_CATEGORIES.has(t.category));
  const covered = (t: Transaction) => t.type === 'expense' && matchers.some(re => re.test(norm(t.description)));

  const patterns = new Map<string, Pattern>();
  const monthsWithData = { income: new Set<string>(), expense: new Set<string>() };
  for (const t of txs) {
    const m = monthOf(t.date);
    if (!histSet.has(m) || covered(t)) continue;
    monthsWithData[t.type as 'income' | 'expense'].add(m);
    const k = `${t.type}|${descKey(t.description)}`;
    const p = patterns.get(k) ?? { type: t.type as 'income' | 'expense', key: descKey(t.description), label: t.description, perMonth: {} };
    p.perMonth[m] = (p.perMonth[m] ?? 0) + Number(t.amount);
    patterns.set(k, p);
  }

  const recurringKeys = new Set<string>();
  const recurringPatterns: { p: Pattern; amount: number }[] = [];
  for (const [k, p] of patterns) {
    const vals = Object.values(p.perMonth);
    if (vals.length < 3) continue;
    recurringKeys.add(k);
    recurringPatterns.push({ p, amount: median(vals) });
  }

  // Lançamentos do mês corrente (já realizados) para não contar de novo
  const nowKeys = new Set<string>();
  const nowTotals = { income: 0, expense: 0 };
  for (const t of txs) {
    if (monthOf(t.date) !== start || covered(t)) continue;
    const k = `${t.type}|${descKey(t.description)}`;
    if (recurringKeys.has(k)) nowKeys.add(k);
    else nowTotals[t.type as 'income' | 'expense'] += Number(t.amount);
  }

  const cleanLabel = (s: string) => {
    const x = s.replace(/^transfer[êe]ncia (enviada|recebida)( pelo pix)?\s*[-–]?\s*/i, '').split(/\s[-–]\s/)[0].trim();
    return x.length > 38 ? x.slice(0, 38) + '…' : x;
  };

  for (const { p, amount } of recurringPatterns) {
    const k = `${p.type}|${p.key}`;
    for (const month of horizon) {
      if (month === start && nowKeys.has(k)) continue;
      if (p.type === 'income') add(month, 'incomeRecurring', cleanLabel(p.label), amount);
      else add(month, 'recurring', cleanLabel(p.label), amount);
    }
  }

  const avgVariable = (type: 'income' | 'expense') => {
    let total = 0;
    for (const [k, p] of patterns) {
      if (p.type !== type || recurringKeys.has(k)) continue;
      total += Object.values(p.perMonth).reduce((s, v) => s + v, 0);
    }
    return total / Math.max(monthsWithData[type].size, 1);
  };
  const varIncome = avgVariable('income') * input.variableIncomePct;
  const varExpense = avgVariable('expense');
  for (const month of horizon) {
    const done = month === start;
    add(month, 'incomeVariable', `Receitas variáveis (média × ${Math.round(input.variableIncomePct * 100)}%)`,
      done ? Math.max(varIncome - nowTotals.income, 0) : varIncome);
    add(month, 'estimated', 'Gastos variáveis (média do extrato)',
      done ? Math.max(varExpense - nowTotals.expense, 0) : varExpense);
  }

  // ─── Totais e saldo acumulado ──────────────────────────────────────────────
  let balance = input.startingCash;
  for (const row of rows) {
    row.totalIn = r2(row.incomeRecurring + row.incomeVariable);
    row.totalOut = r2(row.cards + row.fixed + row.recurring + row.estimated);
    row.net = r2(row.totalIn - row.totalOut);
    balance = r2(balance + row.net);
    row.balance = balance;
  }

  return { months: rows, notes };
}

/** Parcelas que ainda vão vencer, agrupadas por compra, com o mês em que terminam */
export interface InstallmentEnding {
  card: string;
  item: string;
  monthly: number;
  remaining: number;
  parcels: number;
  endsAt: string;
}

export function installmentEndings(future: FutureInstallment[], cards: CreditCard[]): InstallmentEnding[] {
  const names = new Map(cards.map(c => [c.id, c.name]));
  const groups = new Map<string, InstallmentEnding>();
  for (const f of future) {
    const base = f.item.replace(/\s*-?\s*Parcela\s+\d+\/\d+\s*$/i, '').replace(/\s*\(?\d+\/\d+\)?\s*$/, '').trim();
    const key = `${f.card_id}|${base}`;
    const g = groups.get(key) ?? { card: names.get(f.card_id) ?? '', item: base, monthly: 0, remaining: 0, parcels: 0, endsAt: f.bill_month };
    g.monthly = Math.max(g.monthly, Number(f.amount));
    g.remaining = r2(g.remaining + Number(f.amount));
    g.parcels += 1;
    if (f.bill_month > g.endsAt) g.endsAt = f.bill_month;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.endsAt.localeCompare(b.endsAt) || b.remaining - a.remaining);
}
