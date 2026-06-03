import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateCardBill } from '@/hooks/useCardBills';
import type { CardBill, CardBillStatus } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open:    boolean;
  onClose: () => void;
  bill:    CardBill;
}

const STATUS_OPTIONS: Array<{ value: CardBillStatus; label: string }> = [
  { value: 'open',       label: 'Aberta' },
  { value: 'closed',     label: 'Fechada' },
  { value: 'paid',       label: 'Paga' },
  { value: 'reconciled', label: 'Conciliada' },
];

export function CardBillEditModal({ open, onClose, bill }: Props) {
  const [form, setForm] = useState({
    month_ref:    bill.month_ref,
    closing_date: bill.closing_date ?? '',
    due_date:     bill.due_date ?? '',
    status:       bill.status,
    notes:        bill.notes ?? '',
  });

  const update = useUpdateCardBill();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(form.month_ref)) {
      toast.error('Mês de referência deve estar no formato YYYY-MM');
      return;
    }
    try {
      await update.mutateAsync({
        id:           bill.id,
        month_ref:    form.month_ref,
        closing_date: form.closing_date || undefined,
        due_date:     form.due_date || undefined,
        status:       form.status,
        notes:        form.notes || undefined,
      });
      toast.success('Fatura atualizada');
      onClose();
    } catch (e: any) {
      console.error('[BILL UPDATE ERROR]', e);
      toast.error('Erro ao atualizar: ' + (e?.message ?? String(e)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Fatura</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mês de referência */}
          <div>
            <Label>Mês de referência</Label>
            <Input
              type="month"
              value={form.month_ref}
              onChange={e => setForm(f => ({ ...f, month_ref: e.target.value }))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use a convenção que preferir — pode ser o mês de fechamento, mês de vencimento, ou outro.
            </p>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de fechamento</Label>
              <Input
                type="date"
                value={form.closing_date}
                onChange={e => setForm(f => ({ ...f, closing_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Data de vencimento</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v: CardBillStatus) => setForm(f => ({ ...f, status: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Geralmente o status muda automaticamente ao conciliar. Edite só se necessário.
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label>Observações (opcional)</Label>
            <Input
              placeholder="Ex: pagamento parcial, juros aplicados..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={update.isPending}>
              {update.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
