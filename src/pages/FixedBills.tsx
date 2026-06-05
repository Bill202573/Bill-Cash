import { useMemo, useState } from 'react';
import {
  Check, X, AlertTriangle, Clock, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, Zap, CalendarCheck, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FixedBillForm } from '@/components/FixedBillForm';
import {
  useFixedBills, useFixedBillPayments,
  useMarkBillPaid, useMarkBillUnpaid, useDeleteFixedBill,
  billAppliesToMonth, getBillCellStatus,
  type FixedBill, type FixedBillPayment, type BillCellStatus,
} from '@/hooks/useFixedBills';
import { useTransactions } from '@/hooks/useTransactions';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';
import type { Transaction } from '@/lib/supabase';

// ─── constants ────────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/** Lista dos últimos 12 meses + próximos 3 (para navegação no modal) */
function buildMonthRange(): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  for (let i = 0; i < 16; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}
const MONTH_RANGE = buildMonthRange();

// ─── reconciliation helper ────────────────────────────────────────────────────

/** Busca transações candidatas em um mês específico (pode ser diferente da competência) */
function findCandidates(
  bill: FixedBill,
  searchMonth: string,
  transactions: Transaction[],
): Transaction[] {
  return transactions.filter(tx => {
    if (tx.type !== 'expense') return false;
    if (!tx.date.startsWith(searchMonth)) return false;
    const desc     = tx.description.toLowerCase();
    const kwMatch  = bill.keywords?.some(k => desc.includes(k.toLowerCase())) ?? false;
    const amtMatch =
      bill.expected_amount != null &&
      Math.abs(tx.amount - bill.expected_amount) / bill.expected_amount < 0.12;
    return kwMatch || amtMatch;
  });
}

/** Para o banner de sugestões: busca no mês da competência E no mês seguinte */
function findCandidatesExtended(
  bill: FixedBill,
  yearMonth: string,
  transactions: Transaction[],
): Transaction[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const next   = new Date(y, m, 1); // mês seguinte
  const nextYM = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  return [
    ...findCandidates(bill, yearMonth, transactions),
    ...findCandidates(bill, nextYM,    transactions),
  ].filter((tx, i, arr) => arr.findIndex(t => t.id === tx.id) === i); // dedup
}

// ─── cell badge ───────────────────────────────────────────────────────────────

function CellBadge({
  status, payment, onClick,
}: {
  status: BillCellStatus;
  payment?: FixedBillPayment;
  onClick?: () => void;
}) {
  if (status === 'na')     return <span className="text-muted-foreground/20 text-xs select-none">—</span>;
  if (status === 'future') return <span className="text-muted-foreground/30 text-base select-none">·</span>;

  if (status === 'paid') {
    const dateStr = new Date(payment!.paid_date + 'T12:00:00').toLocaleDateString('pt-BR');
    return (
      <button
        onClick={onClick}
        title={`Pago: ${fmt(payment!.paid_amount)} em ${dateStr}`}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-income/15 hover:bg-income/25 transition-colors"
      >
        <Check className="h-3.5 w-3.5 text-income" />
      </button>
    );
  }
  if (status === 'overdue') {
    return (
      <button onClick={onClick} title="Em atraso — clique para registrar pagamento"
        className="flex items-center justify-center w-7 h-7 rounded-full bg-expense/15 hover:bg-expense/25 transition-colors animate-pulse">
        <AlertTriangle className="h-3.5 w-3.5 text-expense" />
      </button>
    );
  }
  return (
    <button onClick={onClick} title="Pendente — clique para registrar pagamento"
      className="flex items-center justify-center w-7 h-7 rounded-full bg-warning/15 hover:bg-warning/25 transition-colors">
      <Clock className="h-3.5 w-3.5 text-warning" />
    </button>
  );
}

// ─── pay / detail modal ────────────────────────────────────────────────────────

interface ModalState {
  bill: FixedBill;
  yearMonth: string;   // competência
  status: BillCellStatus;
  payment?: FixedBillPayment;
}

function PayModal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  const { bill, yearMonth, status, payment } = state;

  // Mês onde BUSCAR a transação — pode ser diferente da competência!
  const [searchMonth, setSearchMonth] = useState(yearMonth);

  const [paidAmount, setPaidAmount] = useState(
    payment?.paid_amount?.toString() ?? bill.expected_amount?.toString() ?? '',
  );
  const [paidDate, setPaidDate] = useState(
    payment?.paid_date ?? new Date().toISOString().slice(0, 10),
  );

  const { data: transactions = [] } = useTransactions();
  const markPaid   = useMarkBillPaid();
  const markUnpaid = useMarkBillUnpaid();

  // Candidatos calculados dinamicamente a partir do mês de busca
  const liveCandidates = useMemo(
    () => findCandidates(bill, searchMonth, transactions),
    [bill, searchMonth, transactions],
  );

  const competencyLabel = new Date(yearMonth  + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const searchLabel     = new Date(searchMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const searchIdx = MONTH_RANGE.indexOf(searchMonth);
  const isDifferentMonth = searchMonth !== yearMonth;

  const handlePay = async (txId?: string, txAmount?: number, txDate?: string) => {
    const amount = txAmount != null ? txAmount.toString() : paidAmount;
    const date   = txDate ?? paidDate;
    if (!amount) { toast.error('Informe o valor pago'); return; }
    try {
      await markPaid.mutateAsync({
        bill_id:        bill.id,
        year_month:     yearMonth,   // sempre grava na COMPETÊNCIA
        paid_amount:    parseFloat(amount),
        paid_date:      date,
        transaction_id: txId ?? null,
        notes:          null,
      });
      toast.success(txId ? 'Conciliação confirmada!' : 'Pagamento registrado!');
      onClose();
    } catch {
      toast.error('Erro ao registrar pagamento');
    }
  };

  const handleUnpay = async () => {
    if (!confirm('Desfazer este pagamento?')) return;
    try {
      await markUnpaid.mutateAsync({ bill_id: bill.id, year_month: yearMonth });
      toast.success('Pagamento desfeito');
      onClose();
    } catch { toast.error('Erro'); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            {bill.name}
            <span className="text-muted-foreground font-normal capitalize text-sm">
              — {competencyLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Competência + Vencimento */}
        {(bill.competence_month || bill.due_date) && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1">
            {bill.competence_month && (
              <p>
                <span className="text-muted-foreground">Competência:</span>
                <span className="ml-2 font-medium capitalize">
                  {new Date(bill.competence_month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
              </p>
            )}
            {bill.due_date && (
              <p>
                <span className="text-muted-foreground">Vencimento real:</span>
                <span className="ml-2 font-medium">
                  {new Date(bill.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            status === 'paid'    ? 'bg-income/10  text-income'  :
            status === 'overdue' ? 'bg-expense/10 text-expense' :
                                   'bg-warning/10 text-warning'
          }`}>
            {status === 'paid'    && <><Check          className="h-4 w-4" /> Pago em {new Date(payment!.paid_date + 'T12:00:00').toLocaleDateString('pt-BR')} · {fmt(payment!.paid_amount)}</>}
            {status === 'overdue' && <><AlertTriangle  className="h-4 w-4" /> Em atraso{bill.expected_amount ? ` — esperado ${fmt(bill.expected_amount)}` : ''}</>}
            {status === 'pending' && <><Clock          className="h-4 w-4" /> Pendente · vence dia {bill.due_day}{bill.expected_amount ? ` · ${fmt(bill.expected_amount)}` : ''}</>}
          </div>

          {/* Desfazer pagamento */}
          {status === 'paid' && (
            <Button variant="outline" className="w-full text-expense border-expense/30 hover:bg-expense/10"
              onClick={handleUnpay} disabled={markUnpaid.isPending}>
              <X className="h-4 w-4 mr-2" /> Desfazer pagamento
            </Button>
          )}

          {/* Registrar / conciliar */}
          {status !== 'paid' && (
            <>
              {/* ── Seletor de mês de busca ── */}
              <div className="rounded-lg border border-border/40 p-3 bg-secondary/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Buscar transação em:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => searchIdx > 0 && setSearchMonth(MONTH_RANGE[searchIdx - 1])}
                    disabled={searchIdx <= 0}
                    className="p-1 rounded hover:bg-secondary disabled:opacity-25"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className={`flex-1 text-center text-sm font-semibold capitalize ${
                    isDifferentMonth ? 'text-primary' : 'text-foreground'
                  }`}>
                    {searchLabel}
                  </span>
                  <button
                    onClick={() => searchIdx < MONTH_RANGE.length - 1 && setSearchMonth(MONTH_RANGE[searchIdx + 1])}
                    disabled={searchIdx >= MONTH_RANGE.length - 1}
                    className="p-1 rounded hover:bg-secondary disabled:opacity-25"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {isDifferentMonth && (
                    <button
                      onClick={() => setSearchMonth(yearMonth)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      resetar
                    </button>
                  )}
                </div>
                {isDifferentMonth && (
                  <p className="text-xs text-primary/80 mt-1.5 text-center">
                    Competência: <span className="capitalize font-medium">{competencyLabel}</span> · Pagamento buscado em: <span className="capitalize font-medium">{searchLabel}</span>
                  </p>
                )}
              </div>

              {/* Candidatos do mês de busca */}
              {liveCandidates.length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    {liveCandidates.length} transação(ões) encontrada(s) em{' '}
                    <span className="capitalize">{searchLabel}</span>
                  </p>
                  <div className="space-y-2">
                    {liveCandidates.map(tx => (
                      <div key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-secondary/30">
                        <div className="min-w-0 mr-3">
                          <p className="text-xs font-medium truncate">
                            {tx.description.split(' - ')[0]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {fmt(tx.amount)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePay(tx.id, tx.amount, tx.date)}
                          disabled={markPaid.isPending}
                          className="flex-shrink-0 text-xs h-7"
                        >
                          Confirmar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma transação encontrada em <span className="capitalize">{searchLabel}</span>.
                  Use as setas acima para mudar o mês de busca.
                </p>
              )}

              {/* Registrar manualmente */}
              <div className="space-y-3 border-t border-border/30 pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ou registrar manualmente
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor pago (R$)</Label>
                    <Input type="number" step="0.01" min="0"
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Data do pagamento</Label>
                    <Input type="date"
                      value={paidDate}
                      onChange={e => setPaidDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={() => handlePay()}
                  disabled={markPaid.isPending || !paidAmount}>
                  <Check className="h-4 w-4 mr-2" /> Marcar como pago
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function FixedBills() {
  const today = new Date();
  const [year,     setYear]     = useState(today.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<FixedBill | null>(null);
  const [modal,    setModal]    = useState<ModalState | null>(null);

  const { data: bills        = [] } = useFixedBills();
  const { data: payments     = [] } = useFixedBillPayments(year);
  const { data: transactions = [] } = useTransactions();
  const deleteBill = useDeleteFixedBill();

  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
    [year],
  );

  const paymentMap = useMemo(() => {
    const m: Record<string, FixedBillPayment> = {};
    payments.forEach(p => { m[`${p.bill_id}_${p.year_month}`] = p; });
    return m;
  }, [payments]);

  // Sugestões automáticas: busca no mês da competência E no mês seguinte
  const suggestions = useMemo(() => {
    const result: { bill: FixedBill; yearMonth: string; candidates: Transaction[] }[] = [];
    const curMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    bills.forEach(bill => {
      yearMonths
        .filter(ym => ym <= curMonth)
        .forEach(ym => {
          if (paymentMap[`${bill.id}_${ym}`]) return;
          if (!billAppliesToMonth(bill, ym)) return;
          const cands = findCandidatesExtended(bill, ym, transactions);
          if (cands.length > 0) result.push({ bill, yearMonth: ym, candidates: cands });
        });
    });
    return result;
  }, [bills, yearMonths, paymentMap, transactions]);

  const stats = useMemo(() => {
    let overdue = 0; let paid = 0; let pending = 0;
    const curMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    bills.forEach(bill => {
      yearMonths.filter(ym => ym <= curMonth).forEach(ym => {
        const payment = paymentMap[`${bill.id}_${ym}`];
        const status  = getBillCellStatus(bill, payment, ym, today);
        if (status === 'paid')    paid++;
        if (status === 'overdue') overdue++;
        if (status === 'pending') pending++;
      });
    });
    return { overdue, paid, pending };
  }, [bills, yearMonths, paymentMap]);

  const openModal = (bill: FixedBill, yearMonth: string) => {
    const payment = paymentMap[`${bill.id}_${yearMonth}`];
    const status  = getBillCellStatus(bill, payment, yearMonth, today);
    if (status === 'na' || status === 'future') return;
    setModal({ bill, yearMonth, status, payment });
  };

  const handleDelete = async (bill: FixedBill) => {
    if (!confirm(`Remover "${bill.name}"?`)) return;
    try { await deleteBill.mutateAsync(bill.id); toast.success('Removido'); }
    catch { toast.error('Erro ao remover'); }
  };

  const monthlyBills = bills.filter(
    b => !b.active_months || b.active_months.length === 0,
  );
  const annualBills  = bills.filter(
    b => b.active_months && b.active_months.length > 0,
  );

  const renderGrid = (billList: FixedBill[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-48">Conta</th>
            {MONTH_ABBR.map((m, i) => (
              <th key={i} className={`text-center py-2 px-1 font-medium w-12 ${
                i === today.getMonth() && year === today.getFullYear()
                  ? 'text-primary' : 'text-muted-foreground'
              }`}>{m}</th>
            ))}
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {billList.map(bill => (
            <tr key={bill.id} className="border-b border-border/20 group hover:bg-secondary/20">
              <td className="py-2 pr-3">
                <p className="font-medium text-sm leading-tight">{bill.name}</p>
                {bill.expected_amount && (
                  <p className="text-xs text-muted-foreground">{fmt(bill.expected_amount)}/mês</p>
                )}
              </td>
              {yearMonths.map((ym, mi) => {
                const payment = paymentMap[`${bill.id}_${ym}`];
                const status  = getBillCellStatus(bill, payment, ym, today);
                return (
                  <td key={mi} className="text-center py-1.5 px-1">
                    <div className="flex items-center justify-center">
                      <CellBadge status={status} payment={payment} onClick={() => openModal(bill, ym)} />
                    </div>
                  </td>
                );
              })}
              <td className="py-2">
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end pr-1">
                  <button onClick={() => setEditing(bill)}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(bill)}
                    className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {billList.length === 0 && (
            <tr><td colSpan={14} className="text-center text-sm text-muted-foreground py-6">
              Nenhuma conta cadastrada
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Contas Fixas</h2>
          <div className="flex items-center gap-1 mt-1.5">
            <button onClick={() => setYear(y => y - 1)}
              className="p-1 rounded hover:bg-secondary transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-medium text-muted-foreground w-12 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)}
              className="p-1 rounded hover:bg-secondary transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-card rounded-lg p-4 text-center">
          <p className="text-2xl font-display font-bold text-income">{stats.paid}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pagas</p>
        </div>
        <div className={`glass-card rounded-lg p-4 text-center ${stats.overdue > 0 ? 'ring-1 ring-expense/30' : ''}`}>
          <p className={`text-2xl font-display font-bold ${stats.overdue > 0 ? 'text-expense' : 'text-muted-foreground'}`}>
            {stats.overdue}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Em atraso</p>
        </div>
        <div className="glass-card rounded-lg p-4 text-center">
          <p className="text-2xl font-display font-bold text-warning">{stats.pending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pendentes</p>
        </div>
      </div>

      {/* Suggestions banner */}
      {suggestions.length > 0 && (
        <div className="mb-6 glass-card rounded-xl border border-primary/20 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-primary/10 border-b border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">
              {suggestions.length} sugestão(ões) de conciliação encontrada(s)
            </p>
          </div>
          <div className="divide-y divide-border/20">
            {suggestions.map(({ bill, yearMonth: ym, candidates }) => {
              const ml = new Date(ym + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              return (
                <div key={`${bill.id}_${ym}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">
                      {bill.name}
                      <span className="text-muted-foreground font-normal capitalize"> — {ml}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {candidates.length} transação(ões) · {candidates.map(t => `${fmt(t.amount)} em ${new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR')}`).join(', ')}
                    </p>
                  </div>
                  <Button size="sm" variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary/10 flex-shrink-0 ml-3"
                    onClick={() => openModal(bill, ym)}>
                    Ver e conciliar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly grid */}
      <div className="glass-card rounded-xl p-5 mb-4">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" /> Contas Mensais
        </h3>
        {renderGrid(monthlyBills)}
      </div>

      {/* Annual / tax grid */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-display font-semibold mb-1 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-warning" /> Impostos e Taxas Anuais
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Vencimento em meses específicos do ano</p>
        {renderGrid(annualBills)}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-income" /> Pago</span>
        <span className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-expense" /> Em atraso</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-warning" /> Pendente</span>
        <span className="flex items-center gap-1.5 text-muted-foreground/40">· Futuro</span>
        <span className="flex items-center gap-1.5 text-muted-foreground/30">— N/A</span>
      </div>

      <FixedBillForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && <FixedBillForm open onClose={() => setEditing(null)} bill={editing} />}
      {modal   && <PayModal state={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
