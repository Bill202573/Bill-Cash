import { describe, expect, it } from 'vitest';
import { computeCashFlow, installmentEndings } from '@/lib/cashflow';
import type { CardBill, CardExpense, CreditCard, Transaction } from '@/lib/supabase';
import type { FixedBill, FixedBillPayment } from '@/hooks/useFixedBills';

const card = { id: 'c1', name: 'Nubank X', last_digits: '1', current_bill: 0, credit_limit: 0, due_date: '4', color: '' } as CreditCard;
const bill = (month: string, over: Partial<CardBill> = {}) =>
  ({ id: `b-${month}`, card_id: 'c1', month_ref: month, total_amount: 0, paid_amount: 0, status: 'open', ...over }) as CardBill;
const exp = (billMonth: string, amount: number, installment = 1, status: CardExpense['status'] = 'confirmed') =>
  ({ id: Math.random().toString(), bill_id: `b-${billMonth}`, card_id: 'c1', description: 'x', amount, purchase_date: '2026-01-01', installment, status }) as CardExpense;
const tx = (date: string, type: 'income' | 'expense', amount: number, description: string, category = 'Outros') =>
  ({ id: Math.random().toString(), date, type, amount, description, category, account: 'A', user: 'u' }) as Transaction;

const base = {
  startMonth: '2026-11', months: 4, startingCash: 1000, transactions: [] as Transaction[], cards: [card],
  bills: [] as CardBill[], cardExpenses: [] as CardExpense[], future: [], fixedBills: [] as FixedBill[],
  payments: [] as FixedBillPayment[], debts: [], variableIncomePct: 1,
};

describe('computeCashFlow', () => {
  it('usa o que falta pagar da fatura aberta e as parcelas futuras nos meses seguintes', () => {
    const r = computeCashFlow({
      ...base,
      bills: [bill('2026-11', { total_amount: 1000, paid_amount: 400, status: 'closed' })],
      future: [{ card_id: 'c1', item: 'TV - Parcela 2/3', amount: 300, bill_month: '2026-12' }, { card_id: 'c1', item: 'TV - Parcela 3/3', amount: 300, bill_month: '2027-01' }],
    });
    expect(r.months[0].cards).toBe(600);
    expect(r.months[1].cards).toBe(300);
    expect(r.months[2].cards).toBe(300);
    expect(r.months[3].cards).toBe(0);
  });

  it('fatura conciliada não entra no fluxo', () => {
    const r = computeCashFlow({ ...base, bills: [bill('2026-11', { total_amount: 900, paid_amount: 900, status: 'reconciled' })] });
    expect(r.months[0].cards).toBe(0);
  });

  it('estima novas compras do cartão pela média de compras à vista/1ª parcela, sem contar parcelas antigas', () => {
    const bills = [bill('2026-08'), bill('2026-09'), bill('2026-10')];
    const cardExpenses = [exp('2026-08', 100), exp('2026-08', 500, 3), exp('2026-09', 200), exp('2026-10', 300)];
    const r = computeCashFlow({ ...base, bills, cardExpenses });
    // média = (100 + 200 + 300) / 3 = 200; mês 1 em diante não tem fatura => 200 de novas compras
    expect(r.months[1].lines.estimated.find(l => l.label.includes('novas compras'))?.amount).toBe(200);
  });

  it('inclui conta fixa em atraso no mês atual e a média quando não há valor definido', () => {
    const fixed = [{ id: 'f1', name: 'Light', active: true, expected_amount: null, active_months: null, due_day: 10, due_month_offset: 0, keywords: null, sort_order: 0, category: 'x', account: null, notes: null }] as unknown as FixedBill[];
    const payments = [
      { id: 'p1', bill_id: 'f1', year_month: '2026-10', expected_amount: 267, paid_amount: null, paid_date: null },
      { id: 'p2', bill_id: 'f1', year_month: '2026-09', expected_amount: 200, paid_amount: 200, paid_date: '2026-09-10' },
      { id: 'p3', bill_id: 'f1', year_month: '2026-08', expected_amount: 300, paid_amount: 300, paid_date: '2026-08-10' },
    ] as FixedBillPayment[];
    const r = computeCashFlow({ ...base, fixedBills: fixed, payments });
    const lines = r.months[0].lines.fixed;
    expect(lines.some(l => l.note === 'em atraso' && l.amount === 267)).toBe(true);
    expect(lines.some(l => l.label === 'Light' && l.amount === 250)).toBe(true); // média 200/300
  });

  it('conta com competência passada mas vencimento futuro entra no mês do vencimento, sem ser atraso', () => {
    const fixed = [{ id: 'f1', name: 'Light', active: true, expected_amount: null, active_months: null, due_day: 23, due_month_offset: 1, keywords: null, sort_order: 0, category: 'x', account: null, notes: null }] as unknown as FixedBill[];
    const payments = [{ id: 'p1', bill_id: 'f1', year_month: '2026-10', expected_amount: 267.11, due_date: '2026-11-23', paid_amount: null, paid_date: null }] as FixedBillPayment[];
    const r = computeCashFlow({ ...base, fixedBills: fixed, payments });
    const line = r.months[0].lines.fixed.find(l => l.amount === 267.11);
    expect(line).toBeDefined();
    expect(line?.note).toBeUndefined();
  });

  it('conta fixa com active_until (parcelas) não projeta meses depois da última parcela', () => {
    const fixed = [{ id: 'f1', name: 'R&S', active: true, expected_amount: 88.84, active_months: null, active_since: '2026-11', active_until: '2027-05', due_day: 6, due_month_offset: 0, keywords: null, sort_order: 0, category: 'Serviços', account: null, notes: null }] as unknown as FixedBill[];
    const r = computeCashFlow({ ...base, months: 12, fixedBills: fixed });
    const meses = r.months.filter(m => m.lines.fixed.some(l => l.label === 'R&S')).map(m => m.month);
    expect(meses).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05']);
  });

  it('parcela mínima de dívida entra mês a mês até quitar', () => {
    const debts = [{ id: 'd1', name: 'Parcelamento CEG', balance: 980.28, minimum_payment: 108.92 }] as never[];
    const r = computeCashFlow({ ...base, months: 12, debts });
    const total = r.months.reduce((s, m) => s + m.lines.fixed.filter(l => l.label.startsWith('Dívida')).reduce((a, l) => a + l.amount, 0), 0);
    expect(total).toBeCloseTo(980.28, 2);
    expect(r.months[8].lines.fixed.some(l => l.label.startsWith('Dívida'))).toBe(true);
    expect(r.months[9].lines.fixed.some(l => l.label.startsWith('Dívida'))).toBe(false);
  });

  it('detecta recorrentes (3 de 4 meses) e separa o resto como variável', () => {
    const t = [
      ...['2026-07', '2026-08', '2026-09', '2026-10'].flatMap((m, i) => [
        tx(`${m}-05`, 'expense', 3000, 'Transferência enviada pelo Pix - ALUGUEL DONO - 123', 'Moradia'),
        tx(`${m}-20`, 'expense', 400, ['Alfa', 'Beta', 'Gama', 'Delta'][i]), // lojas diferentes = variável
      ]),
      tx('2026-10-15', 'income', 5000, 'Transferência recebida - CLIENTE FIXO'),
      tx('2026-09-15', 'income', 5000, 'Transferência recebida - CLIENTE FIXO'),
      tx('2026-08-15', 'income', 5000, 'Transferência recebida - CLIENTE FIXO'),
    ];
    const r = computeCashFlow({ ...base, transactions: t });
    expect(r.months[1].recurring).toBe(3000);
    expect(r.months[1].incomeRecurring).toBe(5000);
    expect(r.months[1].estimated).toBeCloseTo(400, 0);
  });

  it('ignora Pagamento Cartão e transferências no histórico (evita dupla contagem com o cartão)', () => {
    const t = ['2026-08', '2026-09', '2026-10'].map(m => tx(`${m}-10`, 'expense', 2000, 'Pagamento de fatura', 'Pagamento Cartão'));
    const r = computeCashFlow({ ...base, transactions: t });
    expect(r.months[1].estimated).toBe(0);
  });

  it('saldo acumulado parte do saldo atual', () => {
    const r = computeCashFlow({ ...base, startingCash: 500, bills: [bill('2026-11', { total_amount: 800, status: 'closed' })] });
    expect(r.months[0].balance).toBe(-300);
  });
});

describe('installmentEndings', () => {
  it('agrupa parcelas da mesma compra e informa quando terminam', () => {
    const e = installmentEndings([
      { card_id: 'c1', item: 'Leve Saude - Parcela 2/4', amount: 100, bill_month: '2026-12' },
      { card_id: 'c1', item: 'Leve Saude - Parcela 3/4', amount: 100, bill_month: '2027-01' },
      { card_id: 'c1', item: 'Leve Saude - Parcela 4/4', amount: 100, bill_month: '2027-02' },
      { card_id: 'c1', item: 'TV - Parcela 2/2', amount: 50, bill_month: '2026-12' },
    ], [card]);
    expect(e[0]).toMatchObject({ item: 'TV', endsAt: '2026-12', parcels: 1 });
    expect(e[1]).toMatchObject({ item: 'Leve Saude', endsAt: '2027-02', parcels: 3, remaining: 300, monthly: 100 });
  });
});
