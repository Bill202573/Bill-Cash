import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddFixedBill, useUpdateFixedBill, type FixedBill } from '@/hooks/useFixedBills';
import { useAccounts } from '@/hooks/useAccounts';
import { EXPENSE_CATEGORIES } from '@/lib/supabase';
import { toast } from 'sonner';

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Props {
  open: boolean;
  onClose: () => void;
  bill?: FixedBill;
}

type Recurrence = 'monthly' | 'custom';

export function FixedBillForm({ open, onClose, bill }: Props) {
  const isEditing = !!bill;

  // Determine initial recurrence from active_months
  const initRecurrence: Recurrence =
    bill?.active_months && bill.active_months.length > 0 ? 'custom' : 'monthly';
  const initMonths: boolean[] = Array.from({ length: 12 }, (_, i) =>
    bill?.active_months ? bill.active_months.includes(i + 1) : true,
  );

  const [form, setForm] = useState({
    name:             bill?.name             ?? '',
    category:         bill?.category         ?? 'Serviços',
    expected_amount:  bill?.expected_amount?.toString() ?? '',
    due_day:          bill?.due_day?.toString() ?? '10',
    due_month_offset: bill?.due_month_offset  ?? 0,
    account:          bill?.account          ?? '',
    keywords:         bill?.keywords?.join(', ') ?? '',
    notes:            bill?.notes            ?? '',
    active:           bill?.active           ?? true,
  });
  const [recurrence, setRecurrence] = useState<Recurrence>(initRecurrence);
  const [months, setMonths] = useState<boolean[]>(initMonths);

  const add    = useAddFixedBill();
  const update = useUpdateFixedBill();
  const { data: accounts = [] } = useAccounts();
  const loading = add.isPending || update.isPending;

  const toggleMonth = (i: number) =>
    setMonths(prev => prev.map((v, idx) => idx === i ? !v : v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome'); return; }

    const active_months =
      recurrence === 'custom'
        ? months.map((on, i) => on ? i + 1 : null).filter(Boolean) as number[]
        : null;

    const keywords = form.keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      name:             form.name.trim(),
      category:         form.category,
      expected_amount:  form.expected_amount ? parseFloat(form.expected_amount) : null,
      active_months,
      due_day:          parseInt(form.due_day || '10', 10),
      due_month_offset: form.due_month_offset,
      account:          form.account || null,
      keywords:         keywords.length ? keywords : null,
      notes:            form.notes || null,
      active:           form.active,
      sort_order:       bill?.sort_order ?? 99,
    };

    try {
      if (isEditing) {
        await update.mutateAsync({ id: bill.id, ...payload });
        toast.success('Conta fixa atualizada');
      } else {
        await add.mutateAsync(payload);
        toast.success('Conta fixa adicionada');
      }
      onClose();
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nova'} Conta Fixa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Light, CEG, Internet"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor + Dia vencimento + Mês de vencimento */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Valor esperado (R$)</Label>
              <Input
                type="number" step="0.01" min="0"
                placeholder="Ex: 350,00"
                value={form.expected_amount}
                onChange={e => setForm(f => ({ ...f, expected_amount: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Deixe vazio se varia</p>
            </div>
            <div>
              <Label>Dia do vencimento</Label>
              <Input
                type="number" min="1" max="31"
                placeholder="10"
                value={form.due_day}
                onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Mês de vencimento</Label>
              <div className="flex gap-1.5 mt-1">
                {([0, 1] as const).map(offset => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, due_month_offset: offset }))}
                    className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                      form.due_month_offset === offset
                        ? 'bg-primary/15 border-primary text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {offset === 0 ? 'Mesmo mês' : 'Mês seguinte'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {form.due_month_offset === 1 ? 'Ex: Light — vence no mês após a competência' : 'Vence no mesmo mês da competência'}
              </p>
            </div>
          </div>

          {/* Recorrência */}
          <div>
            <Label>Recorrência</Label>
            <div className="flex gap-3 mt-2">
              {(['monthly', 'custom'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRecurrence(r);
                    if (r === 'monthly') setMonths(Array(12).fill(true));
                  }}
                  className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                    recurrence === r
                      ? 'bg-primary/15 border-primary text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {r === 'monthly' ? 'Todos os meses' : 'Meses específicos'}
                </button>
              ))}
            </div>

            {recurrence === 'custom' && (
              <div className="flex gap-1.5 flex-wrap mt-3">
                {MONTH_LABELS.map((ml, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleMonth(i)}
                    className={`w-10 h-8 text-xs rounded-md border transition-colors ${
                      months[i]
                        ? 'bg-primary text-white border-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {ml}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conta vinculada */}
          <div>
            <Label>Conta vinculada (para conciliação)</Label>
            <Select value={form.account} onValueChange={v => setForm(f => ({ ...f, account: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Qualquer conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Qualquer conta</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Palavras-chave */}
          <div>
            <Label>Palavras-chave para conciliação automática</Label>
            <Input
              placeholder="Ex: light, enel, energia (separadas por vírgula)"
              value={form.keywords}
              onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              O sistema vai procurar essas palavras nas descrições das transações.
            </p>
          </div>

          {/* Botões */}
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
