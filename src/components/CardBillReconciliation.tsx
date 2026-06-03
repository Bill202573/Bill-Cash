import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useReconcileCardBill } from '@/hooks/useCardBills';
import { useAccounts } from '@/hooks/useAccounts';
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
  const reconcile = useReconcileCardBill();

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

  const handleSubmit = async () => {
    if (!paymentAccount) {
      toast.error('Selecione a conta de pagamento');
      return;
    }
    if (paidNum <= 0) {
      toast.error('Informe o valor pago');
      return;
    }
    if (!canReconcile) {
      toast.error('Há diferença entre fatura e valor pago. Marque o checkbox para confirmar mesmo assim.');
      return;
    }

    try {
      await reconcile.mutateAsync({
        bill,
        cardName:       card.name,
        paidAmount:     paidNum,
        paymentAccount,
        paymentDate,
      });
      toast.success('Fatura conciliada! Pagamento registrado nas transações.');
      onClose();
    } catch (e: any) {
      console.error('[RECONCILE ERROR]', e);
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

          {/* Valor pago */}
          <div>
            <Label>Valor efetivamente pago (R$)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              className="mt-1 text-lg font-semibold"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              O valor que você efetivamente debitou da conta (pode ser diferente do total, se pagou parcial ou usou crédito)
            </p>
          </div>

          {/* Diferença */}
          <div className={`rounded-lg p-3 text-sm ${
            isZeroDiff
              ? 'bg-income/10 text-income'
              : 'bg-warning/10 text-warning'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Diferença</span>
              <span className="font-bold text-base">
                {isZeroDiff ? '✓ Zero' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
              </span>
            </div>
            {!isZeroDiff && (
              <p className="text-xs mt-1">
                {diff > 0
                  ? 'Você pagou MAIS do que o total da fatura'
                  : 'Você pagou MENOS do que o total da fatura'}
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
                <span className="text-xs text-muted-foreground">
                  Ex: pagamento parcial, juros, taxa não lançada
                </span>
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

          {/* O que vai acontecer */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs">
            <p className="font-medium text-blue-400 mb-1">
              <AlertCircle className="h-3 w-3 inline mr-1" /> O que vai acontecer:
            </p>
            <ul className="space-y-0.5 text-muted-foreground ml-3 list-disc">
              <li>Cria uma <strong>despesa</strong> de {fmt(paidNum)} na conta <strong>{paymentAccount || '—'}</strong></li>
              <li>Descrição: "Pagamento fatura {card.name} {bill.month_ref}"</li>
              <li>Marca a fatura como <strong>Conciliada</strong></li>
              <li>O pagamento aparecerá no extrato bancário e nos relatórios</li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 gap-2"
              disabled={reconcile.isPending || !canReconcile || !paymentAccount}
            >
              <CheckCircle2 className="h-4 w-4" />
              {reconcile.isPending ? 'Conciliando...' : 'Confirmar Conciliação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
