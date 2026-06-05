import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddFixedBill, useUpdateFixedBill, type FixedBill } from '@/hooks/useFixedBills';
import { useAccounts } from '@/hooks/useAccounts';
import { EXPENSE_CATEGORIES } from '@/lib/supabase';
import { parseMoney } from '@/lib/financial';
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
    name:                  bill?.name              ?? '',
    category:              bill?.category          ?? 'Utilidades',
    expected_amount:       bill?.expected_amount?.toString() ?? '',
    due_day:               bill?.due_day?.toString() ?? '10',
    due_month_offset:      bill?.due_month_offset   ?? 0,
    competence_month:      bill?.competence_month  ?? new Date().toISOString().slice(0, 7),
    due_date:              bill?.due_date          ?? new Date().toISOString().slice(0, 10),
    account:               bill?.account           ?? '',
    keywords:              bill?.keywords?.join(', ') ?? '',
    notes:                 bill?.notes             ?? '',
    active:                bill?.active            ?? true,
    // Multa e juros (cobrados em caso de atraso)
    late_fee_amount:       bill?.late_fee_amount?.toString()       ?? '',
    late_fee_type:         (bill?.late_fee_type ?? 'fixed') as 'fixed' | 'percentage',
    daily_interest_amount: bill?.daily_interest_amount?.toString() ?? '',
    daily_interest_type:   (bill?.daily_interest_type ?? 'fixed') as 'fixed' | 'percentage',
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
      name:                  form.name.trim(),
      category:              form.category,
      expected_amount:       form.expected_amount ? parseMoney(form.expected_amount) : null,
      active_months,
      due_day:               parseInt(form.due_day || '10', 10),
      due_month_offset:      form.due_month_offset,
      competence_month:      form.competence_month || null,
      due_date:              form.due_date || null,
      account:               form.account || null,
      keywords:              keywords.length ? keywords : null,
      notes:                 form.notes || null,
      active:                form.active,
      sort_order:            bill?.sort_order ?? 99,
      late_fee_amount:       form.late_fee_amount ? parseMoney(form.late_fee_amount) : 0,
      late_fee_type:         form.late_fee_type,
      daily_interest_amount: form.daily_interest_amount ? parseMoney(form.daily_interest_amount) : 0,
      daily_interest_type:   form.daily_interest_type,
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
                type="text" inputMode="decimal"
                placeholder="Ex: 1.610,16"
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

          {/* Multa e juros */}
          <div className="bg-expense/5 border border-expense/20 rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-expense">⚠️ Multa e juros por atraso</p>
            <p className="text-xs text-muted-foreground">
              O sistema calcula automaticamente a multa e os juros diários nas contas em atraso.
            </p>

            {/* Multa única */}
            <div>
              <Label className="text-xs">Multa por atraso (cobrada uma vez)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text" inputMode="decimal"
                  placeholder="Ex: 33,33"
                  value={form.late_fee_amount}
                  onChange={e => setForm(f => ({ ...f, late_fee_amount: e.target.value }))}
                  className="flex-1"
                />
                <Select
                  value={form.late_fee_type}
                  onValueChange={v => setForm(f => ({ ...f, late_fee_type: v as 'fixed' | 'percentage' }))}
                >
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">R$</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Juros diário */}
            <div>
              <Label className="text-xs">Juros por dia de atraso</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text" inputMode="decimal"
                  placeholder="Ex: 0,56"
                  value={form.daily_interest_amount}
                  onChange={e => setForm(f => ({ ...f, daily_interest_amount: e.target.value }))}
                  className="flex-1"
                />
                <Select
                  value={form.daily_interest_type}
                  onValueChange={v => setForm(f => ({ ...f, daily_interest_type: v as 'fixed' | 'percentage' }))}
                >
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">R$/dia</SelectItem>
                    <SelectItem value="percentage">%/dia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Exemplo Protel: multa R$ 33,33 + juros R$ 0,56/dia
              </p>
            </div>
          </div>

          {/* Competência e vencimento real */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-primary">📅 Competência vs Vencimento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mês de competência</Label>
                <Input
                  type="month"
                  value={form.competence_month}
                  onChange={e => setForm(f => ({ ...f, competence_month: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mês a que a conta se refere (Janeiro, Fevereiro, etc.)
                </p>
              </div>
              <div>
                <Label className="text-xs">Data real de vencimento</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quando você efetivamente paga
                </p>
              </div>
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
            <Select value={form.account || '__any__'} onValueChange={v => setForm(f => ({ ...f, account: v === '__any__' ? '' : v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Qualquer conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Qualquer conta</SelectItem>
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
