import { useMemo, useState } from 'react';
import {
  Check, X, AlertTriangle, Clock,
  Plus, Pencil, Trash2, CalendarCheck, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FixedBillForm } from '@/components/FixedBillForm';
import {
  useFixedBills, useFixedBillPayments,
  useMarkBillPaid, useMarkBillUnpaid, useDeleteFixedBill,
  useSaveBillEntry,
  billAppliesToMonth, getBillCellStatus, calculateLateFee,
  type FixedBill, type FixedBillPayment, type BillCellStatus,
} from '@/hooks/useFixedBills';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';

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

// ─── (conciliação automática será implementada em versão futura) ────────────────

// ─── cell badge ───────────────────────────────────────────────────────────────

function CellBadge({
  status, payment, onClick,
}: {
  status: BillCellStatus;
  payment?: FixedBillPayment;
  onClick?: () => void;
}) {
  if (status === 'na') return <span className="text-muted-foreground/20 text-xs select-none">—</span>;
  if (status === 'future') {
    return (
      <button onClick={onClick} title="Cadastrar conta deste mês"
        className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-secondary/40 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
        <span className="text-base">·</span>
      </button>
    );
  }

  if (status === 'paid' && payment?.paid_date && payment?.paid_amount != null) {
    const dateStr = new Date(payment.paid_date + 'T12:00:00').toLocaleDateString('pt-BR');
    return (
      <button
        onClick={onClick}
        title={`Pago: ${fmt(payment.paid_amount)} em ${dateStr}`}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-income/15 hover:bg-income/25 transition-colors"
      >
        <Check className="h-3.5 w-3.5 text-income" />
      </button>
    );
  }
  if (status === 'overdue') {
    const dueStr = payment?.due_date
      ? ` (venceu ${new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR')})`
      : '';
    return (
      <button onClick={onClick} title={`Em atraso${dueStr}`}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-expense/15 hover:bg-expense/25 transition-colors animate-pulse">
        <AlertTriangle className="h-3.5 w-3.5 text-expense" />
      </button>
    );
  }
  const dueStr = payment?.due_date
    ? ` (vence ${new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR')})`
    : '';
  return (
    <button onClick={onClick} title={`A vencer${dueStr}`}
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
  const { bill, yearMonth: initialYearMonth, status, payment } = state;

  // Competência que o usuário escolhe para registrar — pode ser diferente de initialYearMonth!
  const [yearMonth, setYearMonth] = useState(initialYearMonth);

  // === Dados da conta (cadastro/edição em aberto) ===
  const [expectedAmount, setExpectedAmount] = useState(
    payment?.expected_amount?.toString() ?? bill.expected_amount?.toString() ?? '',
  );
  // Default: dia do template + offset
  const defaultDueDate = useMemo(() => {
    if (payment?.due_date) return payment.due_date;
    const [y, mo] = initialYearMonth.split('-').map(Number);
    const offset  = bill.due_month_offset ?? 0;
    const due     = new Date(y, mo - 1 + offset, bill.due_day || 10);
    return due.toISOString().slice(0, 10);
  }, [payment?.due_date, initialYearMonth, bill]);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  // === Dados do pagamento (só se quiser marcar como pago) ===
  const [showPayForm, setShowPayForm] = useState(status === 'paid');
  const [paidAmount, setPaidAmount] = useState(
    payment?.paid_amount?.toString() ?? '',
  );
  const [paidDate, setPaidDate] = useState(
    payment?.paid_date ?? new Date().toISOString().slice(0, 10),
  );

  const saveEntry  = useSaveBillEntry();
  const markPaid   = useMarkBillPaid();
  const markUnpaid = useMarkBillUnpaid();

  const competencyLabel = new Date(yearMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  /** Salva o cadastro da conta SEM pagamento (apenas valor + vencimento) */
  const handleSaveEntry = async () => {
    if (!expectedAmount) { toast.error('Informe o valor da conta'); return; }
    if (!dueDate)        { toast.error('Informe a data de vencimento'); return; }
    try {
      await saveEntry.mutateAsync({
        bill_id:         bill.id,
        year_month:      yearMonth,
        expected_amount: parseFloat(expectedAmount),
        due_date:        dueDate,
      });
      toast.success('Conta salva!');
      onClose();
    } catch {
      toast.error('Erro ao salvar conta');
    }
  };

  /** Marca como pago — preserva expected_amount e due_date se já cadastrados */
  const handlePay = async () => {
    if (!paidAmount) { toast.error('Informe o valor pago'); return; }
    try {
      await markPaid.mutateAsync({
        bill_id:         bill.id,
        year_month:      yearMonth,
        expected_amount: expectedAmount ? parseFloat(expectedAmount) : null,
        due_date:        dueDate || null,
        paid_amount:     parseFloat(paidAmount),
        paid_date:       paidDate,
        transaction_id:  null,
        notes:           null,
      });
      toast.success('Pagamento registrado!');
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

  const isPaid = status === 'paid';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            {bill.name}
            <span className="text-muted-foreground font-normal capitalize text-sm">
              — {competencyLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status atual */}
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            status === 'paid'    ? 'bg-income/10  text-income'  :
            status === 'overdue' ? 'bg-expense/10 text-expense' :
                                   'bg-warning/10 text-warning'
          }`}>
            {isPaid && (
              <><Check className="h-4 w-4" /> Pago em {new Date(payment!.paid_date! + 'T12:00:00').toLocaleDateString('pt-BR')} · {fmt(payment!.paid_amount!)}</>
            )}
            {status === 'overdue' && (
              <><AlertTriangle className="h-4 w-4" /> Em atraso{payment?.due_date ? ` — venceu em ${new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}</>
            )}
            {status === 'pending' && (
              <><Clock className="h-4 w-4" /> A vencer{payment?.due_date ? ` em ${new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}</>
            )}
          </div>

          {/* Cálculo de multa e juros — só aparece se em atraso e tem regras configuradas */}
          {status === 'overdue' && (() => {
            const calc = calculateLateFee(bill, payment);
            if (calc.extraCharges <= 0) return null;
            return (
              <div className="bg-expense/5 border border-expense/30 rounded-lg p-3 text-xs space-y-1.5">
                <p className="font-semibold text-expense flex items-center gap-1.5">
                  ⚠️ Atualizado para hoje ({calc.daysLate} {calc.daysLate === 1 ? 'dia' : 'dias'} de atraso)
                </p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor original</span>
                  <span>{fmt(calc.baseAmount)}</span>
                </div>
                {calc.lateFee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Multa</span>
                    <span>{fmt(calc.lateFee)}</span>
                  </div>
                )}
                {calc.interestTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Juros ({fmt(calc.interestPerDay)}/dia × {calc.daysLate})</span>
                    <span>{fmt(calc.interestTotal)}</span>
                  </div>
                )}
                <div className="border-t border-expense/20 pt-1.5 flex justify-between font-bold text-expense">
                  <span>Total a pagar hoje</span>
                  <span>{fmt(calc.totalDue)}</span>
                </div>
                <p className="text-muted-foreground italic">
                  Cobrança extra: <span className="text-expense font-medium">{fmt(calc.extraCharges)}</span>
                </p>
              </div>
            );
          })()}

          {/* === Bloco 1: Dados da conta === */}
          <div className="bg-secondary/30 border border-border/30 rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              📄 Dados da conta
            </p>

            <div>
              <Label className="text-xs">Competência</Label>
              <select
                value={yearMonth}
                onChange={e => setYearMonth(e.target.value)}
                className="w-full h-9 px-2 py-1.5 text-sm rounded-md border border-input bg-background mt-1"
                disabled={isPaid}
              >
                {MONTH_RANGE.map(m => (
                  <option key={m} value={m}>
                    {new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Mês a que a conta se refere
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor da conta (R$)</Label>
                <Input type="number" step="0.01" min="0"
                  value={expectedAmount}
                  onChange={e => setExpectedAmount(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 h-9"
                  disabled={isPaid}
                />
              </div>
              <div>
                <Label className="text-xs">Data de vencimento</Label>
                <Input type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="mt-1 h-9"
                  disabled={isPaid}
                />
              </div>
            </div>

            {!isPaid && (
              <Button
                variant="outline"
                className="w-full h-9 border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleSaveEntry}
                disabled={saveEntry.isPending || !expectedAmount || !dueDate}>
                💾 Salvar conta (sem marcar como pago)
              </Button>
            )}
          </div>

          {/* === Bloco 2: Pagamento === */}
          {isPaid ? (
            <Button variant="outline" className="w-full text-expense border-expense/30 hover:bg-expense/10"
              onClick={handleUnpay} disabled={markUnpaid.isPending}>
              <X className="h-4 w-4 mr-2" /> Desfazer pagamento
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setShowPayForm(!showPayForm)}>
                {showPayForm ? '▼' : '▶'} {showPayForm ? 'Esconder' : 'Marcar como pago'}
              </Button>

              {showPayForm && (
                <div className="bg-income/5 border border-income/20 rounded-lg p-3 space-y-3 animate-in fade-in">
                  <p className="text-xs font-medium text-income uppercase tracking-wide">
                    ✓ Registrar pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Valor pago (R$)</Label>
                      <Input type="number" step="0.01" min="0"
                        value={paidAmount}
                        onChange={e => setPaidAmount(e.target.value)}
                        placeholder="0,00"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data do pagamento</Label>
                      <Input type="date"
                        value={paidDate}
                        onChange={e => setPaidDate(e.target.value)}
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>

                  <Button className="w-full h-9" onClick={handlePay}
                    disabled={markPaid.isPending || !paidAmount}>
                    <Check className="h-4 w-4 mr-2" /> Confirmar pagamento
                  </Button>
                </div>
              )}
            </div>
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

  const { data: bills    = [] } = useFixedBills();
  const { data: payments = [] } = useFixedBillPayments(year);
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
    if (status === 'na') return;
    // Agora abrimos para meses futuros também — usuário pode cadastrar conta antecipadamente
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
          <p className="text-xs text-muted-foreground mt-0.5">A vencer</p>
        </div>
      </div>

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
      <div className="flex items-center gap-4 mt-4 px-1 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-income" /> Pago</span>
        <span className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-expense" /> Em atraso</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-warning" /> A vencer</span>
        <span className="flex items-center gap-1.5 text-muted-foreground/40">· Futuro (cadastrar)</span>
        <span className="flex items-center gap-1.5 text-muted-foreground/30">— N/A</span>
      </div>

      <FixedBillForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && <FixedBillForm open onClose={() => setEditing(null)} bill={editing} />}
      {modal   && <PayModal state={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
