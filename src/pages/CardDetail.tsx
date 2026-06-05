import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Upload, Plus, FileText, CheckCircle2, Receipt, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCardBills, useUpsertCardBill, useDeleteCardBill } from '@/hooks/useCardBills';
import { useCardExpenses } from '@/hooks/useCardExpenses';
import { CardExpensesTriage } from '@/components/CardExpensesTriage';
import { CardBillReconciliation } from '@/components/CardBillReconciliation';
import { CardImportModal } from '@/components/CardImportModal';
import { CardExpenseForm } from '@/components/CardExpenseForm';
import { CardBillEditModal } from '@/components/CardBillEditModal';
import { CardProjectParcelasButton } from '@/components/CardProjectParcelasButton';
import { fmt } from '@/lib/financial';
import {
  BILL_STATUS_LABEL,
  BILL_STATUS_COLOR,
  getClosingDateForBill,
  getDueDateForBill,
} from '@/lib/cardBills';
import { toast } from 'sonner';

export default function CardDetail() {
  const { id: cardId } = useParams<{ id: string }>();
  const { data: cards = [] } = useCreditCards();
  const card = cards.find(c => c.id === cardId);

  const { data: bills = [] } = useCardBills(cardId);
  const { data: allExpenses = [] } = useCardExpenses({ cardId });

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [showImport,     setShowImport]     = useState(false);
  const [showNewExp,     setShowNewExp]     = useState(false);
  const [showReconcile,  setShowReconcile]  = useState(false);
  const [showEditBill,   setShowEditBill]   = useState(false);

  const upsertBill = useUpsertCardBill();
  const deleteBill = useDeleteCardBill();

  const selectedBill = bills.find(b => b.id === selectedBillId) ?? null;
  const selectedBillExpenses = useMemo(
    () => allExpenses.filter(e => e.bill_id === selectedBillId),
    [allExpenses, selectedBillId],
  );

  // Stats da fatura selecionada
  const billStats = useMemo(() => {
    const pending   = selectedBillExpenses.filter(e => e.status === 'pending');
    const confirmed = selectedBillExpenses.filter(e => e.status === 'confirmed');
    const refunded  = selectedBillExpenses.filter(e => e.status === 'refunded');
    const totalPending   = pending.reduce((s, e) => s + Number(e.amount), 0);
    const totalConfirmed = confirmed.reduce((s, e) => s + Number(e.amount), 0);
    const totalRefunded  = refunded.reduce((s, e) => s + Number(e.amount), 0);
    // Bruto = soma de todas as linhas que NÃO foram estornadas (o que a fatura "diz" que devo pagar)
    const totalBruto     = totalPending + totalConfirmed;
    return { pending, confirmed, refunded, totalPending, totalConfirmed, totalRefunded, totalBruto };
  }, [selectedBillExpenses]);

  const handleCreateBill = async (monthRef: string) => {
    if (!card) return;
    try {
      await upsertBill.mutateAsync({
        card_id:      card.id,
        month_ref:    monthRef,
        closing_date: getClosingDateForBill(monthRef, card.closing_day) ?? undefined,
        due_date:     getDueDateForBill(monthRef, card.due_day) ?? undefined,
        total_amount: 0,
        paid_amount:  0,
        status:       'open',
      });
      toast.success(`Fatura ${monthRef} criada`);
    } catch (e: any) {
      console.error('[CREATE BILL ERROR]', e);
      toast.error('Erro ao criar fatura: ' + (e?.message ?? String(e)));
    }
  };

  const handleDeleteBill = async () => {
    if (!selectedBill) return;
    const count = selectedBillExpenses.length;
    const confirmMsg = count > 0
      ? `Esta fatura tem ${count} despesa(s). Ao deletar a fatura, as despesas também serão removidas. Continuar?`
      : `Deletar a fatura ${selectedBill.month_ref}?`;
    if (!confirm(confirmMsg)) return;
    try {
      await deleteBill.mutateAsync(selectedBill.id);
      toast.success('Fatura deletada');
      setSelectedBillId(null);
    } catch (e: any) {
      console.error('[DELETE BILL ERROR]', e);
      toast.error('Erro ao deletar fatura: ' + (e?.message ?? String(e)));
    }
  };

  if (!card) {
    return (
      <div className="glass-card rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Cartão não encontrado.</p>
        <Link to="/cartoes" className="text-primary hover:underline text-sm mt-2 inline-block">
          ← Voltar para Cartões
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/cartoes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">{card.name}</h2>
              <p className="text-sm text-muted-foreground">
                Limite {fmt(card.credit_limit)}
                {card.closing_day && ` • Fecha dia ${card.closing_day}`}
                {card.due_day && ` • Vence dia ${card.due_day}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowNewExp(true)} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Despesa manual</span>
            </Button>
            <Button onClick={() => setShowImport(true)} size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar Fatura CSV</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── Coluna esquerda: lista de faturas ─── */}
        <div className="lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold">Faturas</h3>
            <button
              onClick={() => {
                const m = new Date().toISOString().slice(0, 7);
                handleCreateBill(m);
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Mês atual
            </button>
          </div>

          {bills.length === 0 ? (
            <div className="glass-card rounded-lg p-5 text-center text-sm text-muted-foreground">
              Nenhuma fatura ainda.
              <br />
              Importe uma CSV ou adicione uma despesa manual.
            </div>
          ) : (
            bills.map(bill => {
              const isSelected = bill.id === selectedBillId;
              return (
                <button
                  key={bill.id}
                  onClick={() => setSelectedBillId(bill.id)}
                  className={`w-full glass-card rounded-lg p-3 text-left transition-colors ${
                    isSelected ? 'border-primary ring-1 ring-primary' : 'hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">
                      {new Date(bill.month_ref + '-02T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILL_STATUS_COLOR[bill.status]}`}>
                      {BILL_STATUS_LABEL[bill.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Total: <strong className="text-foreground">{fmt(bill.total_amount)}</strong></span>
                    {bill.due_date && (
                      <span>Vence {new Date(bill.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ─── Coluna direita: detalhes da fatura ─── */}
        <div className="lg:col-span-2">
          {!selectedBill ? (
            <div className="glass-card rounded-xl p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Selecione uma fatura à esquerda para ver as despesas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo da fatura selecionada */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">
                      Fatura {selectedBill.month_ref}
                    </h3>
                    <button
                      onClick={() => setShowEditBill(true)}
                      title="Editar fatura (mês, datas, status)"
                      className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleDeleteBill}
                      title="Deletar fatura (e suas despesas)"
                      className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${BILL_STATUS_COLOR[selectedBill.status]}`}>
                    {BILL_STATUS_LABEL[selectedBill.status]}
                  </span>
                </div>

                {/* Datas e total bruto */}
                <div className="bg-secondary/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {selectedBill.closing_date && (
                        <p>Fecha em <strong className="text-foreground">
                          {new Date(selectedBill.closing_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </strong></p>
                      )}
                      {selectedBill.due_date && (
                        <p>Vence em <strong className="text-foreground">
                          {new Date(selectedBill.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </strong></p>
                      )}
                      {!selectedBill.closing_date && !selectedBill.due_date && (
                        <p className="text-warning">Sem datas — clique no lápis para editar</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total bruto</p>
                      <p className="text-xl font-display font-bold text-expense">
                        {fmt(billStats.totalBruto)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedBillExpenses.length - billStats.refunded.length} despesa(s)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Breakdown por status */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Confirmadas</p>
                    <p className="text-sm font-semibold text-income">
                      {billStats.confirmed.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmt(billStats.totalConfirmed)}
                    </p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="text-sm font-semibold text-warning">
                      {billStats.pending.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmt(billStats.totalPending)}
                    </p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Estornadas</p>
                    <p className="text-sm font-semibold text-expense">
                      {billStats.refunded.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmt(billStats.totalRefunded)}
                    </p>
                  </div>
                </div>

                {/* Botão de projeção retroativa de parcelas */}
                <div className="mt-3">
                  <CardProjectParcelasButton card={card} currentBill={selectedBill} />
                </div>

                {/* Ação de conciliação se fechada */}
                {selectedBill.status !== 'reconciled' && billStats.pending.length === 0 && billStats.confirmed.length > 0 && (
                  <Button
                    onClick={() => setShowReconcile(true)}
                    className="w-full mt-3 gap-2 bg-primary"
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Conciliar Pagamento
                  </Button>
                )}

                {selectedBill.status === 'reconciled' && (
                  <div className="mt-3 bg-primary/10 text-primary text-xs rounded p-2 text-center">
                    ✓ Fatura conciliada — pagamento de {fmt(selectedBill.paid_amount)} registrado nas transações
                  </div>
                )}
              </div>

              {/* Lista de despesas + triagem */}
              <CardExpensesTriage
                billId={selectedBill.id}
                expenses={selectedBillExpenses}
                onChanged={() => { /* React Query auto-invalidates */ }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      {showImport && (
        <CardImportModal
          open
          onClose={() => setShowImport(false)}
          card={card}
        />
      )}
      {showNewExp && (
        <CardExpenseForm
          open
          onClose={() => setShowNewExp(false)}
          card={card}
        />
      )}
      {showReconcile && selectedBill && (
        <CardBillReconciliation
          open
          onClose={() => setShowReconcile(false)}
          bill={selectedBill}
          card={card}
        />
      )}
      {showEditBill && selectedBill && (
        <CardBillEditModal
          open
          onClose={() => setShowEditBill(false)}
          bill={selectedBill}
        />
      )}
    </div>
  );
}
