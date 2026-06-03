import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAddCardExpense } from '@/hooks/useCardExpenses';
import { useCategories } from '@/hooks/useCategories';
import { EXPENSE_CATEGORIES, type CreditCard, type CardExpense } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open:     boolean;
  onClose:  () => void;
  card:     CreditCard;
  expense?: CardExpense;     // não usado ainda (edit), reservado
}

export function CardExpenseForm({ open, onClose, card }: Props) {
  const [form, setForm] = useState({
    description:        '',
    amount:             '',
    purchase_date:      new Date().toISOString().slice(0, 10),
    category:           '',
    subcategory:        '',
    total_installments: '1',
    notes:              '',
  });

  const add = useAddCardExpense();
  const { data: dbCats = [] } = useCategories('expense');
  const rootCats = dbCats.filter(c => c.parent_id === null);
  const allCats  = rootCats.length > 0 ? rootCats.map(c => c.name) : EXPENSE_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Informe a descrição'); return; }
    const amount = parseFloat(form.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido'); return;
    }
    const totalInstallments = parseInt(form.total_installments) || 1;
    if (totalInstallments < 1 || totalInstallments > 60) {
      toast.error('Parcelas deve estar entre 1 e 60'); return;
    }

    try {
      const created = await add.mutateAsync({
        cardId:             card.id,
        closingDay:         card.closing_day,
        dueDay:             card.due_day,
        description:        form.description.trim(),
        amount,
        purchaseDate:       form.purchase_date,
        category:           form.category || undefined,
        subcategory:        form.subcategory || undefined,
        totalInstallments,
        origin:             'manual',
        status:             'confirmed',  // manual já entra confirmada
        notes:              form.notes || undefined,
      });
      toast.success(
        totalInstallments > 1
          ? `${totalInstallments} parcelas criadas em ${totalInstallments} faturas`
          : 'Despesa adicionada',
      );
      onClose();
    } catch (err: any) {
      console.error('[CARD EXPENSE SAVE ERROR]', err);
      toast.error('Erro ao salvar despesa: ' + (err?.message ?? String(err)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova despesa no {card.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Descrição</Label>
            <Input
              placeholder="Ex: iFood, Posto, Compras..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0,00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Data da compra</Label>
              <Input
                type="date"
                value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parcelas</Label>
              <Input
                type="number" min="1" max="60"
                value={form.total_installments}
                onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {parseInt(form.total_installments) > 1
                  ? `Distribui em ${form.total_installments} faturas`
                  : 'À vista'}
              </p>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {allCats.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Input
              placeholder="Ex: viagem família"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={add.isPending}>
              {add.isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
