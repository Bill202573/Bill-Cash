import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddCreditCard, useUpdateCreditCard } from '@/hooks/useCreditCards';
import { useAccounts } from '@/hooks/useAccounts';
import { CARD_COLORS, type CreditCard } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  card?: CreditCard;
}

export function CreditCardForm({ open, onClose, card }: Props) {
  const { data: accounts = [] } = useAccounts();
  const [form, setForm] = useState({
    name:            card?.name            ?? '',
    last_digits:     card?.last_digits     ?? '',
    current_bill:    card?.current_bill?.toString() ?? '0',
    credit_limit:    card?.credit_limit?.toString() ?? '',
    due_date:        card?.due_date        ?? '',
    color:           card?.color           ?? CARD_COLORS[0],
    closing_day:     card?.closing_day?.toString() ?? '',
    due_day:         card?.due_day?.toString()     ?? '',
    payment_account: card?.payment_account ?? '',
    active:          card?.active ?? true,
  });

  const add = useAddCreditCard();
  const update = useUpdateCreditCard();
  const loading = add.isPending || update.isPending;
  const isEditing = !!card;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do cartão'); return; }
    if (!form.credit_limit || isNaN(Number(form.credit_limit))) { toast.error('Informe o limite do cartão'); return; }

    const closingDay = form.closing_day ? parseInt(form.closing_day) : undefined;
    const dueDay     = form.due_day     ? parseInt(form.due_day)     : undefined;
    if (closingDay !== undefined && (closingDay < 1 || closingDay > 31)) {
      toast.error('Dia de fechamento deve ser entre 1 e 31'); return;
    }
    if (dueDay !== undefined && (dueDay < 1 || dueDay > 31)) {
      toast.error('Dia de vencimento deve ser entre 1 e 31'); return;
    }

    try {
      const payload = {
        name:            form.name,
        last_digits:     form.last_digits || undefined,
        current_bill:    parseFloat(form.current_bill || '0'),
        credit_limit:    parseFloat(form.credit_limit),
        due_date:        form.due_date || undefined,
        color:           form.color,
        closing_day:     closingDay,
        due_day:         dueDay,
        payment_account: form.payment_account || undefined,
        active:          form.active,
      };
      if (isEditing) {
        await update.mutateAsync({ id: card.id, ...payload });
        toast.success('Cartão atualizado');
      } else {
        await add.mutateAsync(payload);
        toast.success('Cartão adicionado');
      }
      onClose();
    } catch (err: any) {
      console.error('[CARD SAVE ERROR]', err);
      toast.error('Erro ao salvar cartão: ' + (err?.message ?? String(err)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Novo'} Cartão de Crédito</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome + 4 dígitos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do Cartão</Label>
              <Input
                placeholder="Ex: Nubank, Inter"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Últimos 4 dígitos</Label>
              <Input
                maxLength={4}
                placeholder="0000"
                value={form.last_digits}
                onChange={e => setForm(f => ({ ...f, last_digits: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Limite + Fatura atual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Limite Total (R$)</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0,00"
                value={form.credit_limit}
                onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fatura Atual (R$)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={form.current_bill}
                onChange={e => setForm(f => ({ ...f, current_bill: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Dia fechamento + Dia vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dia de Fechamento</Label>
              <Input
                type="number" min="1" max="31"
                placeholder="Ex: 25"
                value={form.closing_day}
                onChange={e => setForm(f => ({ ...f, closing_day: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Compras após esse dia entram na próxima fatura</p>
            </div>
            <div>
              <Label>Dia de Vencimento</Label>
              <Input
                type="number" min="1" max="31"
                placeholder="Ex: 5"
                value={form.due_day}
                onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Dia do mês em que a fatura vence</p>
            </div>
          </div>

          {/* Conta de pagamento */}
          <div>
            <Label>Conta usada para pagar a fatura</Label>
            <Select
              value={form.payment_account}
              onValueChange={v => setForm(f => ({ ...f, payment_account: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a conta..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Ao conciliar a fatura, será criada uma despesa nesta conta automaticamente.
            </p>
          </div>

          {/* Vencimento próxima fatura (legado — opcional) */}
          <div>
            <Label>Próximo Vencimento (data específica, opcional)</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Color picker */}
          <div>
            <Label>Cor do Cartão</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {CARD_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} transition-transform ${
                    form.color === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-background' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Ativo */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="accent-primary"
              />
              <Label htmlFor="active" className="cursor-pointer">Cartão ativo</Label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
