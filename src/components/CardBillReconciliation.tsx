import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Search, Zap } from 'lucide-react';
import { useReconcileCardBill, useLinkCardBillPayment } from '@/hooks/useCardBills';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { fmt } from '@/lib/financial';
import type { CardBill, CreditCard } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open:    boolean;
  onClose: () => void;
  bill:    CardBill;
  card:    CreditCard;
}

export function CardBillReconciliation({ open, onClose, bill, card }: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: allTransactions = [] } = useTransactions();
  const reconcile = useReconcileCardBill();
  const linkPayment = useLinkCardBillPayment();

  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [searchTerm, setSearchTerm] = useState('');

  const [paidAmount,     setPaidAmount]     = useState(bill.total_amount.toString());
  const [paymentAccount, setPaymentAccount] = useState(card.payment_account ?? '');
  const [paymentDate,    setPaymentDate]    = useState(
    bill.due_date ?? new Date().toISOString().slice(0, 10),
  );
  const [acceptDiff, setAcceptDiff] = useState(false);

  const paidNum = parseFloat(paidAmount || '0');
  const diff = paidNum - bill.total_amount;
  const diffAbs = Math.abs(diff);
  const isZeroDiff = diffAbs < 0.01;
  const canReconcile = isZeroDiff || acceptDiff;

  // Transações candidatas: busca por texto, exclui as já usadas como pagamento de outra fatura
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    return allTransactions
      .filter(t => t.type === 'expense')
      .filter(t => t.description.toLowerCase().includes(term))
      .slice(0, 15);
  }, [searchTerm, allTransactions]);

  const handleLink = async (tx: { id: string; amount: number }) => {
    try {
      await linkPayment.mutateAsync({ bill, transactionId: tx.id, paidAmount: tx.amount });
      toast.success('Fatura conciliada com a transação real do extrato!');
      onClose();
    } catch (e: any) {
      toast.error('Erro ao vincular: ' + (e?.message ?? String(e)));
    }
  };

  const handleManualSubmit = async () => {
    if (!paymentAccount) { toast.error('Selecione a conta de pagamento'); return; }
    if (paidNum <= 0) { toast.error('Informe o valor pago'); return; }
    if (!canReconcile) {
      toast.error('Há diferença entre fatura e valor pago. Marque o checkbox para confirmar mesmo assim.');
      return;
    }
    try {
      await reconcile.mutateAsync({ bill, cardName: card.name, paidAmount: paidNum, paymentAccount, paymentDate });
      toast.success('Fatura conciliada! Pagamento registrado nas transações.');
      onClose();
    } catch (e: any) {
      toast.error('Erro ao conciliar: ' + (e?.message ?? String(e)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Conciliar Fatura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="glass-card rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cartão</span>
              <span className="font-medium">{card.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fatura</span>
              <span className="font-medium">{bill.month_ref}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/30 pt-2">
              <span className="font-medium">Total das despesas confirmadas</span>
              <span className="font-display font-bold text-lg">{fmt(bill.total_amount)}</span>
            </div>
          </div>

          {/* Modo: buscar vs manual */}
          <div className="flex gap-2 p-1 bg-secondary/40 rounded-lg">
            <button
              onClick={() => setMode('search')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                mode === 'search' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Buscar no extrato
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                mode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Lançar manualmente
            </button>
          </div>

          {mode === 'search' ? (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Busque a transação real já importada do banco. Ao vincular, ela é recategorizada como
                "Pagamento Cartão" — nenhuma transação nova é criada, evitando duplicidade.
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: Pagamento de fatura, Débito..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 pl-9"
                  autoFocus
                />
              </div>
              {searchTerm.trim() && (
                <p className="text-xs text-muted-foreground">
                  {searchResults.length === 0 ? '⚠ Nenhuma transação encontrada' : `${searchResults.length} transação(ões) encontrada(s)`}
                </p>
              )}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {searchResults.map(tx => (
                  <button
                    key={tx.id}
                    onClick={() => handleLink(tx)}
                    disabled={linkPayment.isPending}
                    className="w-full p-2 rounded-md border border-border/40 bg-background/40 hover:bg-primary/10 hover:border-primary/40 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-tight flex-1 min-w-0 break-words">{tx.description}</p>
                      <p className="text-sm font-bold text-expense flex-shrink-0">{fmt(tx.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                        {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {tx.account}
                      </p>
                      <p className="text-xs text-primary flex items-center gap-0.5 flex-shrink-0 font-medium">
                        <Zap className="h-3 w-3" /> Vincular
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-2.5 text-xs text-warning">
                Use apenas quando o pagamento ainda não apareceu no extrato importado (ex: vai pagar agora).
                Isso cria uma transação nova — se depois importar o extrato com esse pagamento, você terá duplicidade.
              </div>

              {/* Valor pago */}
              <div>
                <Label>Valor efetivamente pago (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="mt-1 text-lg font-semibold"
                />
              </div>

              {/* Diferença */}
              <div className={`rounded-lg p-3 text-sm ${isZeroDiff ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Diferença</span>
                  <span className="font-bold text-base">
                    {isZeroDiff ? '✓ Zero' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                  </span>
                </div>
                {!isZeroDiff && (
                  <p className="text-xs mt-1">
                    {diff > 0 ? 'Você pagou MAIS do que o total da fatura' : 'Você pagou MENOS do que o total da fatura'}
                  </p>
                )}
              </div>

              {!isZeroDiff && (
                <label className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={acceptDiff}
                    onChange={e => setAcceptDiff(e.target.checked)}
                    className="accent-primary mt-0.5"
                  />
                  <span>
                    Aceito conciliar mesmo com diferença ({fmt(diffAbs)})
                    <br />
                    <span className="text-xs text-muted-foreground">Ex: pagamento parcial, juros, taxa não lançada</span>
                  </span>
                </label>
              )}

              {/* Conta de pagamento */}
              <div>
                <Label>Pagamento debitado de</Label>
                <Select value={paymentAccount} onValueChange={setPaymentAccount}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data do pagamento */}
              <div>
                <Label>Data do pagamento</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs">
                <p className="font-medium text-blue-400 mb-1">
                  <AlertCircle className="h-3 w-3 inline mr-1" /> O que vai acontecer:
                </p>
                <ul className="space-y-0.5 text-muted-foreground ml-3 list-disc">
                  <li>Cria uma <strong>despesa</strong> de {fmt(paidNum)} na conta <strong>{paymentAccount || '—'}</strong></li>
                  <li>Descrição: "Pagamento fatura {card.name} {bill.month_ref}"</li>
                  <li>Marca a fatura como <strong>Conciliada</strong></li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
                <Button
                  onClick={handleManualSubmit}
                  className="flex-1 gap-2"
                  disabled={reconcile.isPending || !canReconcile || !paymentAccount}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {reconcile.isPending ? 'Conciliando...' : 'Confirmar Conciliação'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
