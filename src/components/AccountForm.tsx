import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddAccount, useUpdateAccount } from '@/hooks/useAccounts';
import { ACCOUNT_TYPE_LABELS, CARD_COLORS, type Account, type AccountType } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  account?: Account;
}

export function AccountForm({ open, onClose, account }: Props) {
  const [form, setForm] = useState({
    name:                 account?.name                 ?? '',
    bank:                 account?.bank                 ?? '',
    type:                (account?.type                 ?? 'checking') as AccountType,
    balance:              account?.balance?.toString()  ?? '0',
    initial_balance:      account?.initial_balance?.toString() ?? '0',
    initial_balance_date: account?.initial_balance_date ?? new Date().toISOString().slice(0, 10),
    owner:                account?.owner                ?? 'William',
    color:                account?.color                ?? CARD_COLORS[0],
  });

  const add    = useAddAccount();
  const update = useUpdateAccount();
  const loading  = add.isPending || update.isPending;
  const isEditing = !!account;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome da conta'); return; }
    if (!form.bank.trim()) { toast.error('Informe o banco');          return; }
    try {
      const initialBalanceNum = parseFloat(form.initial_balance || '0');
      const payload = {
        name:                  form.name,
        bank:                  form.bank,
        type:                  form.type,
        owner:                 form.owner,
        color:                 form.color,
        // Mantém o `balance` legado em sincronia com o initial_balance (snapshot)
        balance:               initialBalanceNum,
        initial_balance:       initialBalanceNum,
        initial_balance_date:  form.initial_balance_date || null,
      };
      if (isEditing) {
        await update.mutateAsync({ id: account.id, ...payload });
        toast.success('Conta atualizada');
      } else {
        await add.mutateAsync(payload);
        toast.success('Conta adicionada');
      }
      onClose();
    } catch (e: any) {
      console.error('[ACCOUNT SAVE ERROR]', e);
      toast.error('Erro ao salvar conta: ' + (e?.message ?? String(e)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nova'} Conta Bancária</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome da conta</Label>
              <Input
                placeholder="Ex: Nubank William"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Banco</Label>
              <Input
                placeholder="Ex: Nubank, Itaú"
                value={form.bank}
                onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as AccountType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titular</Label>
              <Input
                placeholder="Ex: William, Esposa"
                value={form.owner}
                onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Bloco do saldo inicial — o coração do cálculo dinâmico */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-primary">📌 Saldo de partida</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Saldo inicial (R$)</Label>
                <Input
                  type="number" step="0.01"
                  placeholder="0,00"
                  value={form.initial_balance}
                  onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Data desse saldo</Label>
                <Input
                  type="date"
                  value={form.initial_balance_date}
                  onChange={e => setForm(f => ({ ...f, initial_balance_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              💡 O sistema vai somar/subtrair todas as transações <strong>a partir desta data</strong>
              para mostrar o saldo atual em tempo real. Transações anteriores são ignoradas (já estavam
              embutidas no saldo de partida).
            </p>
          </div>

          {/* Cor */}
          <div>
            <Label>Cor</Label>
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
