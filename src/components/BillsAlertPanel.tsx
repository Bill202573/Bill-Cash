import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ChevronRight, TrendingUp } from 'lucide-react';
import {
  useFixedBills, useFixedBillPayments,
  getBillCellStatus, calculateLateFee, billAppliesToMonth,
  type FixedBill, type FixedBillPayment,
} from '@/hooks/useFixedBills';
import { fmt } from '@/lib/financial';

interface BillRow {
  bill: FixedBill;
  payment?: FixedBillPayment;
  yearMonth: string;
  dueDate: string;        // YYYY-MM-DD
  expectedAmount: number;
  // Calculados (só para overdue)
  daysLate: number;
  extraCharges: number;
  totalDue: number;
}

/**
 * Painel no Dashboard mostrando contas a vencer no mês atual + contas em atraso
 * com cálculo automático de multa e juros.
 */
export function BillsAlertPanel() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const curYear  = today.getFullYear();
  const curMonth = `${curYear}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const { data: bills    = [] } = useFixedBills();
  const { data: payments = [] } = useFixedBillPayments(curYear);
  // Também busca o ano anterior para pegar contas em atraso de meses passados
  const { data: prevPayments = [] } = useFixedBillPayments(curYear - 1);
  const allPayments = useMemo(() => [...payments, ...prevPayments], [payments, prevPayments]);

  const paymentMap = useMemo(() => {
    const m: Record<string, FixedBillPayment> = {};
    allPayments.forEach(p => { m[`${p.bill_id}_${p.year_month}`] = p; });
    return m;
  }, [allPayments]);

  const { overdue, upcoming } = useMemo(() => {
    const ovd: BillRow[] = [];
    const upc: BillRow[] = [];

    // Janela: 12 meses atrás até mês atual (para atrasados) + mês atual (para a vencer)
    const months: string[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(curYear, today.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    bills.forEach(bill => {
      months.forEach(ym => {
        if (!bill.active) return;
        if (!billAppliesToMonth(bill, ym)) return;

        const payment = paymentMap[`${bill.id}_${ym}`];
        const status  = getBillCellStatus(bill, payment, ym, today);

        // Pulamos paid, future, na
        if (status !== 'overdue' && status !== 'pending') return;

        const dueDate = payment?.due_date
          ?? `${ym}-${String(bill.due_day || 10).padStart(2, '0')}`;
        const expectedAmount = payment?.expected_amount ?? bill.expected_amount ?? 0;

        const calc = calculateLateFee(bill, payment, today);

        const row: BillRow = {
          bill, payment, yearMonth: ym, dueDate, expectedAmount,
          daysLate:     calc.daysLate,
          extraCharges: calc.extraCharges,
          totalDue:     calc.totalDue > 0 ? calc.totalDue : expectedAmount,
        };

        if (status === 'overdue') ovd.push(row);
        else if (ym === curMonth) upc.push(row); // só "a vencer" do mês atual
      });
    });

    // Ordena: mais atrasados primeiro / próximos do vencimento primeiro
    ovd.sort((a, b) => b.daysLate - a.daysLate);
    upc.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return { overdue: ovd, upcoming: upc };
  }, [bills, paymentMap, today, curMonth, curYear]);

  const totalOverdueBase  = overdue.reduce((s, r) => s + r.expectedAmount, 0);
  const totalOverdueExtra = overdue.reduce((s, r) => s + r.extraCharges, 0);
  const totalOverdueDue   = overdue.reduce((s, r) => s + r.totalDue, 0);
  const totalUpcoming     = upcoming.reduce((s, r) => s + r.expectedAmount, 0);

  if (overdue.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            📋 Contas Fixas
          </h3>
          <p className="text-xs text-muted-foreground">
            Acompanhamento em tempo real de vencimentos e atrasos
          </p>
        </div>
        <button
          onClick={() => navigate('/contas-fixas')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Ver todas <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contas em atraso */}
        {overdue.length > 0 && (
          <div className="bg-expense/5 border border-expense/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-expense">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">
                  {overdue.length} {overdue.length === 1 ? 'conta atrasada' : 'contas atrasadas'}
                </p>
              </div>
              <span className="text-xs text-expense font-bold">{fmt(totalOverdueDue)}</span>
            </div>

            {totalOverdueExtra > 0 && (
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-expense" />
                Cobrança extra:&nbsp;
                <span className="text-expense font-semibold">+{fmt(totalOverdueExtra)}</span>
                <span className="opacity-60">(multa + juros)</span>
              </div>
            )}

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {overdue.map(row => (
                <button
                  key={`${row.bill.id}_${row.yearMonth}`}
                  onClick={() => navigate('/contas-fixas')}
                  className="w-full flex items-center justify-between p-2 rounded-md bg-background/40 hover:bg-background/70 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.daysLate}d atraso · venceu {new Date(row.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-semibold text-expense">{fmt(row.totalDue)}</p>
                    {row.extraCharges > 0 && (
                      <p className="text-xs text-expense/80">+{fmt(row.extraCharges)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-2 pt-2 border-t border-expense/20 flex justify-between text-xs">
              <span className="text-muted-foreground">Valor base original</span>
              <span className="text-muted-foreground">{fmt(totalOverdueBase)}</span>
            </div>
          </div>
        )}

        {/* Contas a vencer no mês atual */}
        {upcoming.length > 0 && (
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-warning">
                <Clock className="h-4 w-4" />
                <p className="text-sm font-semibold">
                  {upcoming.length} {upcoming.length === 1 ? 'a vencer este mês' : 'a vencer este mês'}
                </p>
              </div>
              <span className="text-xs text-warning font-bold">{fmt(totalUpcoming)}</span>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {upcoming.map(row => {
                const due = new Date(row.dueDate + 'T12:00:00');
                const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const urgent = daysUntil <= 3;
                return (
                  <button
                    key={`${row.bill.id}_${row.yearMonth}`}
                    onClick={() => navigate('/contas-fixas')}
                    className="w-full flex items-center justify-between p-2 rounded-md bg-background/40 hover:bg-background/70 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence em {due.toLocaleDateString('pt-BR')}{' '}
                        {daysUntil > 0 && (
                          <span className={urgent ? 'text-warning font-medium' : ''}>
                            (em {daysUntil}d)
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-warning flex-shrink-0 ml-2">
                      {fmt(row.expectedAmount)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
