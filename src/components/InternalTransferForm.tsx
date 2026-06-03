import { useState } from 'react';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccounts } from '@/hooks/useAccounts';
import { useAddInternalTransfer } from '@/hooks/useInternalTransfers';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function InternalTransferForm({ open, onClose }: Props) {
  const { data: accounts = [] } = useAccounts();
  const add = useAddInternalTransfer();

  const [form, setForm] = useState({
    from_account: '',
    to_account:   '',
    amount:       '',
    date:         new Date().toISOString().slice(0, 10),
    description:  '',
    user:         'Você',
  });

  const fromAcc  = accounts.find(a => a.name === form.from_account);
  const toAcc    = accounts.find(a => a.name === form.to_account);
  const parsedAmt = parseFloat(form.amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.from_account) { toast.error('Selecione a conta de origem');  return; }
    if (!form.to_account)   { toast.error('Selecione a conta de destino'); return; }
    if (form.from_account === form.to_account) { toast.error('Origem e destino não podem ser iguais'); return; }
    if (!parsedAmt || parsedAmt <= 0) { toast.error('Informe um valor válido'); return; }
    if (!form.date) { toast.error('Informe a data'); return; }

    try {
      await add.mutateAsync({ ...form, amount: parsedAmt });
      toast.success(`Transferência de ${fmt(parsedAmt)} registrada com sucesso`);
      setForm({
        from_account: '',
        to_account:   '',
        amount:       '',
        date:         new Date().toISOString().slice(0, 10),
        description:  '',
        user:         'Você',
      });
      onClose();
    } catch (e) {
      toast.error('Erro ao registrar transferência: ' + String(e));
    }
  };

  const availableDestinations = accounts.filter(a => a.name !== form.from_account);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-400" />
            Nova Transferência Interna
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-2">
          Transferências internas <strong>não afetam receitas nem despesas</strong>.
          Apenas os saldos das contas envolvidas são atualizados.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origem → Destino */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <Label>De (origem)</Label>
              <Select value={form.from_account} onValueChange={v => setForm(f => ({ ...f, from_account: v, to_account: f.to_account === v ? '' : f.to_account }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Conta de saída" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fromAcc && (
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo: {fmt(fromAcc.balance)}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center pb-1">
              <ArrowRight className="h-5 w-5 text-blue-400" />
            </div>

            <div>
              <Label>Para (destino)</Label>
              <Select value={form.to_account} onValueChange={v => setForm(f => ({ ...f, to_account: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Conta de entrada" />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {toAcc && (
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo: {fmt(toAcc.balance)}
                </p>
              )}
            </div>
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number" step="0.01" min="0.01"
                placeholder="0,00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="mt-1"
              />
              {parsedAmt > 0 && fromAcc && parsedAmt > fromAcc.balance && (
                <p className="text-xs text-warning mt-1">⚠️ Valor maior que o saldo da origem</p>
              )}
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input
              placeholder={`Ex: Pró-labore ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Pessoa */}
          <div>
            <Label>Responsável</Label>
            <Input
              placeholder="Ex: Você"
              value={form.user}
              onChange={e => setForm(f => ({ ...f, user: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Preview */}
          {parsedAmt > 0 && form.from_account && form.to_account && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-sm">
              <p className="font-medium mb-1 text-blue-400">Resumo da operação:</p>
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">{form.from_account}</span> perde {fmt(parsedAmt)}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">{form.to_account}</span> recebe {fmt(parsedAmt)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Receitas e despesas não são afetadas.</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={add.isPending}>
              {add.isPending ? 'Registrando...' : 'Registrar Transferência'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
