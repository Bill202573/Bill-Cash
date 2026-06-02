import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddDebt, useUpdateDebt } from '@/hooks/useDebts';
import { DEBT_TYPE_LABELS, type Debt, type DebtType } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  debt?: Debt;
}

export function DebtForm({ open, onClose, debt }: Props) {
  const [form, setForm] = useState({
    name: debt?.name ?? '',
    type: (debt?.type ?? 'loan') as DebtType,
    balance: debt?.balance?.toString() ?? '',
    interest_rate: debt?.interest_rate?.toString() ?? '',
    minimum_payment: debt?.minimum_payment?.toString() ?? '',
    due_day: debt?.due_day?.toString() ?? '',
  });

  const add = useAddDebt();
  const update = useUpdateDebt();
  const loading = add.isPending || update.isPending;
  const isEditing = !!debt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome da dívida'); return; }
    if (!form.balance || isNaN(Number(form.balance))) { toast.error('Informe o saldo devedor'); return; }
    if (!form.interest_rate || isNaN(Number(form.interest_rate))) { toast.error('Informe a taxa de juros'); return; }
    try {
      const payload = {
        name: form.name,
        type: form.type,
        balance: parseFloat(form.balance),
        interest_rate: parseFloat(form.interest_rate),
        minimum_payment: parseFloat(form.minimum_payment || '0'),
        due_day: form.due_day ? parseInt(form.due_day) : undefined,
      };
      if (isEditing) {
        await update.mutateAsync({ id: debt.id, ...payload });
        toast.success('Dívida atualizada');
      } else {
        await add.mutateAsync(payload);
        toast.success('Dívida adicionada');
      }
      onClose();
    } catch {
      toast.error('Erro ao salvar dívida');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nova'} Dívida</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome da dívida</Label>
            <Input
              placeholder="Ex: Cartão Nubank, Empréstimo Caixa"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as DebtType }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DEBT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Saldo Devedor (R$)</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0,00"
                value={form.balance}
                onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Juros ao mês (%)</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="Ex: 12.5"
                value={form.interest_rate}
                onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parcela Mínima (R$)</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0,00"
                value={form.minimum_payment}
                onChange={e => setForm(f => ({ ...f, minimum_payment: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Dia de Vencimento</Label>
              <Input
                type="number" min="1" max="31" placeholder="Ex: 10"
                value={form.due_day}
                onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Dica sobre juros:</p>
            <p>Cartão de crédito rotativo: ~15–20% a.m.</p>
            <p>Cheque especial: ~8–12% a.m. | Empréstimo pessoal: ~3–7% a.m.</p>
          </div>

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
