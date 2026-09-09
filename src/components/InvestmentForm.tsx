import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddInvestment, useUpdateInvestment } from '@/hooks/useInvestments';
import { INVESTMENT_TYPE_LABELS, type Investment, type InvestmentType } from '@/lib/supabase';
import { parseMoney } from '@/lib/financial';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  investment?: Investment;
}

export function InvestmentForm({ open, onClose, investment }: Props) {
  const [form, setForm] = useState({
    name: investment?.name ?? '',
    type: (investment?.type ?? 'poupanca') as InvestmentType,
    current_balance: investment?.current_balance?.toString() ?? '',
    target_amount: investment?.target_amount?.toString() ?? '',
    institution: investment?.institution ?? '',
  });

  const add = useAddInvestment();
  const update = useUpdateInvestment();
  const loading = add.isPending || update.isPending;
  const isEditing = !!investment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do investimento'); return; }
    const balance = parseMoney(form.current_balance);
    if (!balance && balance !== 0) { toast.error('Informe o saldo atual'); return; }

    try {
      const payload = {
        name: form.name,
        type: form.type,
        current_balance: balance,
        target_amount: form.target_amount ? parseMoney(form.target_amount) : null,
        institution: form.institution || null,
      };
      if (isEditing) {
        await update.mutateAsync({ id: investment.id, ...payload });
        toast.success('Investimento atualizado');
      } else {
        await add.mutateAsync(payload);
        toast.success('Investimento adicionado');
      }
      onClose();
    } catch {
      toast.error('Erro ao salvar investimento');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Novo'} Investimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              placeholder="Ex: CDB Nubank, Tesouro Selic, Poupança WN"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as InvestmentType }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INVESTMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Saldo atual (R$)</Label>
              <Input
                type="text" inputMode="decimal" placeholder="0,00"
                value={form.current_balance}
                onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Meta (opcional)</Label>
              <Input
                type="text" inputMode="decimal" placeholder="0,00"
                value={form.target_amount}
                onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Instituição (opcional)</Label>
            <Input
              placeholder="Ex: Nubank, XP, Banco Inter"
              value={form.institution}
              onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground">
            O saldo aqui conta como patrimônio positivo no cálculo geral — some junto com o caixa em conta, e não com as dívidas.
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
