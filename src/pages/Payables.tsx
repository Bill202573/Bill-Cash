import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, CheckCircle2, Clock, CalendarCheck, Plus, Trash2, Info, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFixedBills, useFixedBillPayments } from '@/hooks/useFixedBills';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCardBills } from '@/hooks/useCardBills';
import { useCardExpenses } from '@/hooks/useCardExpenses';
import { useDebts } from '@/hooks/useDebts';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useInternalTransfers } from '@/hooks/useInternalTransfers';
import { useCardRecurring, useAddCardRecurring, useDeleteCardRecurring } from '@/hooks/useCardRecurring';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from '@/hooks/useAuth';
import { computeFinancialSnapshot } from '@/lib/balances';
import { buildPayables, type Payable } from '@/lib/payables';
import { addMonthsToYYYYMM } from '@/lib/parcelas';
import { currentMonth, fmt } from '@/lib/financial';
import { toast } from 'sonner';

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const monthName = (ym: string) => new Date(ym + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const dayLabel = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem dia');
const KIND_LABEL: Record<Payable['kind'], string> = { fixed: 'Conta fixa', card: 'Cartão', recurring: 'Cartão (previsto)', debt: 'Dívida' };

function StatusChip({ p }: { p: Payable }) {
  if (p.status === 'paid') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-income/15 text-income"><CheckCircle2 className="h-3 w-3" />Pago</span>;
  if (p.status === 'overdue') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-expense/15 text-expense"><AlertTriangle className="h-3 w-3" />{p.daysLate}d atraso</span>;
  if (p.status === 'projected') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"><Info className="h-3 w-3" />Previsto</span>;
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning"><Clock className="h-3 w-3" />A vencer</span>;
}

export default function Payables() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getDisplayName, getFilterUserId } = useFamilyScope();
  const [month, setMonth] = useState(currentMonth());
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const today = useMemo(() => new Date(), []);

  const { data: fixedBills = [], isLoading: l1 } = useFixedBills();
  const { data: cards = [], isLoading: l2 } = useCreditCards();
  const { data: allBills = [], isLoading: l3 } = useCardBills();
  const { data: allExpenses = [], isLoading: l4 } = useCardExpenses();
  const { data: debts = [], isLoading: l5 } = useDebts();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: transfers = [] } = useInternalTransfers();
  const { data: recurringAll = [] } = useCardRecurring();
  const addRec = useAddCardRecurring();
  const delRec = useDeleteCardRecurring();
  const year = Number(month.slice(0, 4));
  const { data: pay0 = [] } = useFixedBillPayments(year - 1);
  const { data: pay1 = [] } = useFixedBillPayments(year);
  const { data: pay2 = [] } = useFixedBillPayments(year + 1);
  const loading = l1 || l2 || l3 || l4 || l5;

  const cardIds = useMemo(() => new Set(cards.map(c => c.id)), [cards]);
  const recurring = useMemo(() => recurringAll.filter(r => cardIds.has(r.card_id)), [recurringAll, cardIds]);

  const { month: items, overdue } = useMemo(() => buildPayables({
    month, today, fixedBills, payments: [...pay0, ...pay1, ...pay2], cards,
    bills: allBills.filter(b => cardIds.has(b.card_id)),
    cardExpenses: allExpenses.filter(e => cardIds.has(e.card_id)),
    recurring, debts,
  }), [month, today, fixedBills, pay0, pay1, pay2, cards, allBills, allExpenses, cardIds, recurring, debts]);

  const cash = useMemo(() => {
    const checking = accounts.filter(a => a.type === 'checking');
    return computeFinancialSnapshot(checking, transactions, transfers, [], [], [], []).totalCash;
  }, [accounts, transactions, transfers]);

  const isCurrent = month === currentMonth();
  const sum = (arr: Payable[], f: (p: Payable) => number) => arr.reduce((s, p) => s + f(p), 0);
  const toPay = (p: Payable) => (p.status === 'paid' ? 0 : (p.amount ?? 0) + p.extra);
  const monthPaid = sum(items, p => (p.status === 'paid' ? p.paidAmount : 0));
  const monthRemaining = sum(items, toPay);
  const overdueTotal = sum(overdue, toPay);
  const overdueExtra = sum(overdue, p => p.extra);
  const needNow = isCurrent ? monthRemaining + overdueTotal : monthRemaining;
  const noValue = [...items, ...overdue].filter(p => p.status !== 'paid' && p.amount == null);
  const next7 = isCurrent
    ? items.filter(p => p.status !== 'paid' && p.due && p.due >= today && p.due.getTime() - today.getTime() <= 7 * 86400000)
    : [];
  const next7Total = sum(next7, toPay);
  const projected = sum(items.filter(p => p.status === 'projected'), p => p.amount ?? 0);

  // ── Atenções (regras simples, em linguagem direta) ──
  const alerts: { tone: 'bad' | 'warn' | 'info'; text: string }[] = [];
  if (isCurrent && overdue.length > 0) alerts.push({ tone: 'bad', text: `${overdue.length} conta(s) de meses anteriores sem pagamento, somando ${fmt(overdueTotal)}${overdueExtra > 0 ? ` (inclui ${fmt(overdueExtra)} de multa e juros)` : ''}. Se já foram pagas, dê baixa; se não, priorize as que cobram mais juros.` });
  if (isCurrent && needNow > cash) alerts.push({ tone: 'bad', text: `O saldo em conta (${fmt(cash)}) não cobre tudo o que está pendente (${fmt(needNow)}). Faltam ${fmt(needNow - cash)}.` });
  else if (isCurrent && next7Total > 0 && next7Total > cash) alerts.push({ tone: 'warn', text: `Nos próximos 7 dias vencem ${fmt(next7Total)} e o saldo em conta é ${fmt(cash)}.` });
  if (noValue.length > 0) alerts.push({ tone: 'warn', text: `${noValue.length} conta(s) sem valor definido (${noValue.slice(0, 3).map(p => p.title).join(', ')}${noValue.length > 3 ? '...' : ''}). Defina um valor para o total ficar certo.` });
  if (projected > 0) alerts.push({ tone: 'info', text: `${fmt(projected)} deste mês são previsões (cobranças recorrentes de cartão e parcelas de dívidas) que ainda não viraram lançamento.` });
  const lateCards = overdue.filter(p => p.kind === 'card');
  if (lateCards.length > 0) alerts.push({ tone: 'bad', text: `Fatura de cartão atrasada: ${lateCards.map(p => p.title).join(', ')}. Cartão atrasado cobra juros de rotativo muito altos.` });

  // ── Formulário de cobrança recorrente no cartão ──
  const [rCard, setRCard] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rKey, setRKey] = useState('');
  const [rAmount, setRAmount] = useState('');
  const [rSince, setRSince] = useState(addMonthsToYYYYMM(currentMonth(), 1));
  const addRecurring = async () => {
    const amount = parseFloat(rAmount.replace(',', '.'));
    const card = cards.find(c => c.id === rCard);
    if (!card || !rDesc.trim() || !rKey.trim() || !(amount > 0)) { toast.error('Preencha cartão, descrição, palavra que aparece na fatura e valor'); return; }
    try {
      await addRec.mutateAsync({
        user_id: card.user_id ?? getFilterUserId() ?? user?.id ?? null, card_id: card.id, description: rDesc.trim(), keyword: rKey.trim(),
        amount, category: null, active_since: rSince || null, active_until: null, notes: null,
      });
      toast.success('Cobrança recorrente adicionada');
      setRDesc(''); setRKey(''); setRAmount('');
    } catch (e) { toast.error('Não consegui salvar: ' + String((e as Error).message ?? e)); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Montando as contas do mês...</div>;
  }

  const Row = ({ p }: { p: Payable }) => (
    <button
      onClick={() => navigate(p.link.to, p.link.state ? { state: p.link.state } : undefined)}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors"
    >
      <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{dayLabel(p.due)}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{p.title}</span>
        <span className="block text-xs text-muted-foreground truncate">{KIND_LABEL[p.kind]}{p.subtitle ? ` · ${p.subtitle}` : ''}</span>
      </span>
      <StatusChip p={p} />
      <span className="w-28 shrink-0 text-right">
        <span className={`block text-sm font-semibold tabular-nums ${p.status === 'paid' ? 'text-income' : p.status === 'overdue' ? 'text-expense' : ''}`}>
          {p.amount == null ? 'definir valor' : fmt(p.amount)}
        </span>
        {p.extra > 0 && <span className="block text-[11px] text-expense">+{fmt(p.extra)} multa/juros</span>}
      </span>
    </button>
  );

  const shownOverdue = showAllOverdue ? overdue : overdue.slice(0, 6);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"><CalendarCheck className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h2 className="text-2xl font-display font-bold">Contas a Pagar</h2>
            <p className="text-sm text-muted-foreground">Tudo que vence no mês, em ordem de data — {getDisplayName()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(addMonthsToYYYYMM(month, -1))} className="p-1.5 rounded hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthName(month)}</span>
          <button onClick={() => setMonth(addMonthsToYYYYMM(month, 1))} className="p-1.5 rounded hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
          {!isCurrent && <button onClick={() => setMonth(currentMonth())} className="ml-1 text-xs text-primary hover:underline">Mês atual</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-lg p-4"><p className="text-xs text-muted-foreground">A pagar no mês</p><p className="text-xl font-display font-bold">{fmt(monthRemaining)}</p><p className="text-xs text-muted-foreground mt-1">{items.filter(p => p.status !== 'paid').length} conta(s) pendente(s)</p></div>
        <div className="glass-card rounded-lg p-4"><p className="text-xs text-muted-foreground">Já pago no mês</p><p className="text-xl font-display font-bold text-income">{fmt(monthPaid)}</p><p className="text-xs text-muted-foreground mt-1">{items.filter(p => p.status === 'paid').length} conta(s)</p></div>
        <div className="glass-card rounded-lg p-4"><p className="text-xs text-muted-foreground">{isCurrent ? 'Em atraso (meses anteriores)' : 'Total do mês'}</p><p className={`text-xl font-display font-bold ${isCurrent && overdueTotal > 0 ? 'text-expense' : ''}`}>{fmt(isCurrent ? overdueTotal : monthRemaining + monthPaid)}</p><p className="text-xs text-muted-foreground mt-1">{isCurrent ? `${overdue.length} conta(s)` : 'pago + pendente'}</p></div>
        <div className="glass-card rounded-lg p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Saldo em conta hoje</p><p className={`text-xl font-display font-bold ${cash < 0 ? 'text-expense' : ''}`}>{fmt(cash)}</p><p className={`text-xs mt-1 ${isCurrent && cash < needNow ? 'text-expense' : 'text-muted-foreground'}`}>{isCurrent ? (cash >= needNow ? `sobra ${fmt(cash - needNow)} após pagar tudo` : `faltam ${fmt(needNow - cash)}`) : 'contas correntes'}</p></div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${a.tone === 'bad' ? 'border-expense/40 bg-expense/10' : a.tone === 'warn' ? 'border-warning/40 bg-warning/10' : 'border-border bg-secondary/40'}`}>
              {a.tone === 'info' ? <Info className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.tone === 'bad' ? 'text-expense' : 'text-warning'}`} />}
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {isCurrent && overdue.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="font-display font-semibold mb-2 text-expense">Em atraso de meses anteriores</h3>
          {shownOverdue.map(p => <Row key={p.key} p={p} />)}
          {overdue.length > 6 && (
            <button className="text-xs text-primary hover:underline mt-2" onClick={() => setShowAllOverdue(v => !v)}>
              {showAllOverdue ? 'Mostrar menos' : `Ver todas as ${overdue.length}`}
            </button>
          )}
        </div>
      )}

      <div className="glass-card rounded-xl p-4">
        <h3 className="font-display font-semibold mb-2 capitalize">Vencimentos de {monthName(month)}</h3>
        {items.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nada vence neste mês.</p> : items.map(p => <Row key={p.key} p={p} />)}
      </div>

      <div className="glass-card rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-display font-semibold">Cobranças recorrentes no cartão</h3>
          <p className="text-xs text-muted-foreground">
            Para valores que o cartão cobra todo mês (consórcio, assinatura). Entram aqui como previsão e <strong>não alteram a fatura</strong>:
            quando a compra aparecer no cartão, a previsão some sozinha e o total continua batendo com o banco.
          </p>
        </div>
        {recurringAll.length > 0 && (
          <div className="space-y-1">
            {recurringAll.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg bg-secondary/40">
                <span className="min-w-0 truncate">{r.description} — {cards.find(c => c.id === r.card_id)?.name ?? 'cartão'} · a partir de {r.active_since ?? 'já'}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold tabular-nums">{fmt(r.amount)}/mês</span>
                  <button className="text-expense p-1" title="Remover" onClick={() => { if (confirm(`Remover "${r.description}"?`)) delRec.mutate(r.id); }}><Trash2 className="h-4 w-4" /></button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5 md:col-span-1"><Label>Cartão</Label>
            <select className={SELECT_CLS} value={rCard} onChange={e => setRCard(e.target.value)}>
              <option value="">Escolher</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="space-y-1.5 md:col-span-1"><Label>Descrição</Label><Input value={rDesc} onChange={e => setRDesc(e.target.value)} placeholder="Consórcio Bancorbras" /></div>
          <div className="space-y-1.5 md:col-span-1"><Label>Aparece na fatura como</Label><Input value={rKey} onChange={e => setRKey(e.target.value)} placeholder="bancorbras" /></div>
          <div className="space-y-1.5 md:col-span-1"><Label>Valor mensal</Label><Input value={rAmount} onChange={e => setRAmount(e.target.value)} placeholder="350,00" inputMode="decimal" /></div>
          <div className="space-y-1.5 md:col-span-1"><Label>1ª fatura (mês)</Label><Input type="month" value={rSince} onChange={e => setRSince(e.target.value)} /></div>
        </div>
        <Button size="sm" onClick={addRecurring} disabled={addRec.isPending}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>
    </div>
  );
}
