import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarRange, ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { fmt, fmtCompact, currentMonth } from '@/lib/financial';
import { computeFinancialSnapshot } from '@/lib/balances';
import { computeCashFlow, installmentEndings, type FutureInstallment } from '@/lib/cashflow';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useInternalTransfers } from '@/hooks/useInternalTransfers';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCardBills } from '@/hooks/useCardBills';
import { useCardExpenses } from '@/hooks/useCardExpenses';
import { useFixedBills, useFixedBillPayments } from '@/hooks/useFixedBills';
import { useDebts } from '@/hooks/useDebts';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (ym: string) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

const COLORS = {
  cards: '#a855f7',
  fixed: '#f59e0b',
  recurring: '#3b82f6',
  estimated: '#94a3b8',
  income: '#22c55e',
  balance: '#38bdf8',
};

const GROUPS = [
  { key: 'cards', label: 'Cartões (já assumido)', color: COLORS.cards },
  { key: 'fixed', label: 'Contas fixas e dívidas', color: COLORS.fixed },
  { key: 'recurring', label: 'Recorrentes (aluguel etc.)', color: COLORS.recurring },
  { key: 'estimated', label: 'Estimado (variável + novas compras)', color: COLORS.estimated },
] as const;

export default function CashFlow() {
  const start = currentMonth();
  const [variablePct, setVariablePct] = useState('0.8');
  const [open, setOpen] = useState<string | null>(null);
  const { getDisplayName } = useFamilyScope();

  const { data: transactions = [], isLoading: l1 } = useTransactions();
  const { data: accounts = [], isLoading: l2 } = useAccounts();
  const { data: transfers = [] } = useInternalTransfers();
  const { data: cards = [], isLoading: l3 } = useCreditCards();
  const { data: bills = [], isLoading: l4 } = useCardBills();
  const { data: allExpenses = [], isLoading: l5 } = useCardExpenses();
  const { data: fixedBills = [], isLoading: l6 } = useFixedBills();
  const year = Number(start.slice(0, 4));
  const { data: pay1 = [] } = useFixedBillPayments(year);
  const { data: pay2 = [] } = useFixedBillPayments(year + 1);
  const { data: debts = [], isLoading: l7 } = useDebts();

  const cardIds = useMemo(() => cards.map(c => c.id), [cards]);
  const { data: future = [], isLoading: l8 } = useQuery({
    queryKey: ['card_future_installments', cardIds],
    enabled: cardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('card_future_installments').select('*').in('card_id', cardIds);
      if (error) throw error;
      return (data ?? []) as FutureInstallment[];
    },
  });

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

  const result = useMemo(() => {
    if (loading) return null;
    const idSet = new Set(cardIds);
    const startingCash = computeFinancialSnapshot(accounts, transactions, transfers, [], [], [], []).totalCash;
    return {
      startingCash,
      ...computeCashFlow({
        startMonth: start,
        startingCash,
        transactions,
        cards,
        bills,
        cardExpenses: allExpenses.filter(e => idSet.has(e.card_id)),
        future,
        fixedBills,
        payments: [...pay1, ...pay2],
        debts,
        variableIncomePct: Number(variablePct),
      }),
    };
  }, [loading, accounts, transactions, transfers, cards, cardIds, bills, allExpenses, future, fixedBills, pay1, pay2, debts, start, variablePct]);

  const endings = useMemo(() => installmentEndings(future, cards), [future, cards]);

  if (!result) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Montando o fluxo de caixa...
      </div>
    );
  }

  const { months, notes, startingCash } = result;
  const committed = months.reduce((s, m) => s + m.cards + m.fixed, 0);
  const lowest = months.reduce((a, b) => (b.balance < a.balance ? b : a), months[0]);
  const negativeMonths = months.filter(m => m.balance < 0);
  const deficitMonths = months.filter(m => m.net < 0);

  const chartData = months.map(m => ({
    month: monthLabel(m.month),
    cards: m.cards,
    fixed: m.fixed,
    recurring: m.recurring,
    estimated: m.estimated,
    receita: m.totalIn,
    saldo: m.balance,
  }));

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <CalendarRange className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">Fluxo de Caixa</h2>
          <p className="text-sm text-muted-foreground">Próximos 12 meses — {getDisplayName()}</p>
        </div>
      </div>

      {negativeMonths.length > 0 ? (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-expense/40 bg-expense/10">
          <AlertTriangle className="h-5 w-5 text-expense mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">O saldo projetado fica negativo em {negativeMonths.length} {negativeMonths.length === 1 ? 'mês' : 'meses'}, começando em {monthLabel(negativeMonths[0].month)}.</p>
            <p className="text-muted-foreground">Menor saldo: {fmt(lowest.balance)} em {monthLabel(lowest.month)}. Veja abaixo quais compromissos pesam mais nesses meses.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-income/40 bg-income/10">
          <Info className="h-5 w-5 text-income mt-0.5 shrink-0" />
          <p className="text-sm">O saldo projetado se mantém positivo nos 12 meses. Menor saldo: {fmt(lowest.balance)} em {monthLabel(lowest.month)}.</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Saldo hoje (contas)" value={fmt(startingCash)} />
        <Stat title="Já assumido em 12 meses" value={fmt(committed)} hint="Cartões + contas fixas + dívidas" />
        <Stat title="Menor saldo projetado" value={fmt(lowest.balance)} tone={lowest.balance < 0 ? 'bad' : undefined} hint={monthLabel(lowest.month)} />
        <Stat title="Meses com resultado negativo" value={`${deficitMonths.length} de ${months.length}`} tone={deficitMonths.length > 0 ? 'bad' : undefined} />
      </div>

      <div className="glass-card rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-semibold text-lg">Para onde vai o dinheiro</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Receita variável considerada:</span>
            <Select value={variablePct} onValueChange={setVariablePct}>
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">50%</SelectItem>
                <SelectItem value="0.8">80%</SelectItem>
                <SelectItem value="1">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 20%)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(215, 15%, 55%)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }} tickFormatter={fmtCompact} width={56} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(220, 18%, 12%)', border: '1px solid hsl(220, 14%, 20%)', borderRadius: 8, fontSize: 13 }}
                formatter={(v: number, name: string) => [fmt(v), name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {GROUPS.map(g => (
                <Bar key={g.key} dataKey={g.key} name={g.label} stackId="saidas" fill={g.color} />
              ))}
              <Line type="monotone" dataKey="receita" name="Receita prevista" stroke={COLORS.income} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="saldo" name="Saldo acumulado" stroke={COLORS.balance} strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          As barras roxa, laranja e azul são compromissos conhecidos. A cinza é estimativa pela média dos últimos 4 meses.
        </p>
      </div>

      <div className="glass-card rounded-lg p-5">
        <h3 className="font-display font-semibold text-lg mb-3">Mês a mês</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="py-2 pr-2 font-medium">Mês</th>
                <th className="py-2 px-2 font-medium text-right">Receita</th>
                {GROUPS.map(g => (
                  <th key={g.key} className="py-2 px-2 font-medium text-right">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: g.color }} />
                    {g.label.split(' (')[0]}
                  </th>
                ))}
                <th className="py-2 px-2 font-medium text-right">Resultado</th>
                <th className="py-2 pl-2 font-medium text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {months.map(m => {
                const isOpen = open === m.month;
                return (
                  <Fragment key={m.month}>
                    <tr
                      className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer"
                      onClick={() => setOpen(isOpen ? null : m.month)}
                    >
                      <td className="py-2 pr-2 font-medium whitespace-nowrap">
                        {isOpen ? <ChevronDown className="inline h-4 w-4 mr-1" /> : <ChevronRight className="inline h-4 w-4 mr-1" />}
                        {monthLabel(m.month)}
                      </td>
                      <td className="py-2 px-2 text-right text-income">{fmt(m.totalIn)}</td>
                      <td className="py-2 px-2 text-right">{fmt(m.cards)}</td>
                      <td className="py-2 px-2 text-right">{fmt(m.fixed)}</td>
                      <td className="py-2 px-2 text-right">{fmt(m.recurring)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmt(m.estimated)}</td>
                      <td className={`py-2 px-2 text-right font-medium ${m.net < 0 ? 'text-expense' : 'text-income'}`}>{fmt(m.net)}</td>
                      <td className={`py-2 pl-2 text-right font-semibold ${m.balance < 0 ? 'text-expense' : ''}`}>{fmt(m.balance)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-secondary/20">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                            <Detail title="Receitas" lines={[...m.lines.incomeRecurring, ...m.lines.incomeVariable]} positive />
                            <Detail title="Cartões" lines={m.lines.cards} />
                            <Detail title="Contas fixas e dívidas" lines={m.lines.fixed} />
                            <Detail title="Recorrentes" lines={m.lines.recurring} />
                            <Detail title="Estimado" lines={m.lines.estimated} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Clique em um mês para ver o detalhe do que compõe cada valor.</p>
      </div>

      {endings.length > 0 && (
        <div className="glass-card rounded-lg p-5">
          <h3 className="font-display font-semibold text-lg mb-1">Quando as parcelas terminam</h3>
          <p className="text-sm text-muted-foreground mb-3">Compras parceladas ainda por vencer, da que acaba primeiro para a que acaba por último.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/50">
                  <th className="py-2 pr-2 font-medium">Compra</th>
                  <th className="py-2 px-2 font-medium">Cartão</th>
                  <th className="py-2 px-2 font-medium text-right">Parcela</th>
                  <th className="py-2 px-2 font-medium text-right">Faltam</th>
                  <th className="py-2 px-2 font-medium text-right">Total a pagar</th>
                  <th className="py-2 pl-2 font-medium text-right">Termina em</th>
                </tr>
              </thead>
              <tbody>
                {endings.slice(0, 30).map(e => (
                  <tr key={`${e.card}|${e.item}`} className="border-b border-border/30">
                    <td className="py-1.5 pr-2">{e.item}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{e.card.replace('Nubank ', '')}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(e.monthly)}</td>
                    <td className="py-1.5 px-2 text-right">{e.parcels}x</td>
                    <td className="py-1.5 px-2 text-right">{fmt(e.remaining)}</td>
                    <td className="py-1.5 pl-2 text-right">{monthLabel(e.endsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass-card rounded-lg p-5 text-sm space-y-2">
        <h3 className="font-display font-semibold text-lg">Como este fluxo é calculado</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong className="text-foreground">Cartões:</strong> o que falta pagar das faturas abertas e fechadas, mais as parcelas já assumidas dos meses seguintes.</li>
          <li><strong className="text-foreground">Contas fixas:</strong> valor definido de cada mês; quando não há, a média dos últimos pagamentos. Contas em atraso entram no mês atual.</li>
          <li><strong className="text-foreground">Recorrentes:</strong> pagamentos e recebimentos que aparecem em pelo menos 3 dos últimos 4 meses (aluguel, repasses etc.), pela mediana.</li>
          <li><strong className="text-foreground">Estimado:</strong> média dos gastos variáveis do extrato e das novas compras no cartão. Você pode reduzir a receita variável considerada no seletor acima.</li>
          {notes.map(n => <li key={n} className="text-warning">{n}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Stat({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: 'bad' }) {
  return (
    <div className="glass-card rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className={`text-xl font-display font-bold ${tone === 'bad' ? 'text-expense' : ''}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function Detail({ title, lines, positive }: { title: string; lines: { label: string; amount: number; note?: string }[]; positive?: boolean }) {
  if (lines.length === 0) return null;
  const sorted = [...lines].sort((a, b) => b.amount - a.amount);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <ul className="space-y-0.5">
        {sorted.map((l, i) => (
          <li key={`${l.label}-${i}`} className="flex justify-between gap-3">
            <span className="truncate">
              {l.label}
              {l.note && <span className="ml-1.5 text-xs text-warning">({l.note})</span>}
            </span>
            <span className={positive ? 'text-income' : ''}>{fmt(l.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
