import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddLifeGoal, useUpdateLifeGoal } from '@/hooks/useLifeGoals';
import { LIFE_GOAL_CATEGORY_LABELS, type LifeGoal, type LifeGoalCategory, type LifeGoalStatus } from '@/lib/supabase';
import { parseMoney } from '@/lib/financial';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  goal?: LifeGoal;
}

const STATUS_LABELS: Record<LifeGoalStatus, string> = {
  planejando:   'Planejando',
  em_andamento: 'Em andamento',
  concluido:    'Concluído',
  cancelado:    'Cancelado',
};

export function LifeGoalForm({ open, onClose, goal }: Props) {
  const [form, setForm] = useState({
    name: goal?.name ?? '',
    category: (goal?.category ?? 'outro') as LifeGoalCategory,
    estimated_cost: goal?.estimated_cost?.toString() ?? '',
    saved_amount: goal?.saved_amount?.toString() ?? '0',
    target_date: goal?.target_date ?? '',
    status: (goal?.status ?? 'planejando') as LifeGoalStatus,
    notes: goal?.notes ?? '',
  });

  const add = useAddLifeGoal();
  const update = useUpdateLifeGoal();
  const loading = add.isPending || update.isPending;
  const isEditing = !!goal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do plano'); return; }
    const cost = parseMoney(form.estimated_cost);
    if (!cost) { toast.error('Informe o custo estimado'); return; }

    try {
      const payload = {
        name: form.name,
        category: form.category,
        estimated_cost: cost,
        saved_amount: parseMoney(form.saved_amount),
        target_date: form.target_date || null,
        status: form.status,
        notes: form.notes || null,
      };
      if (isEditing) {
        await update.mutateAsync({ id: goal.id, ...payload });
        toast.success('Plano atualizado');
      } else {
        await add.mutateAsync(payload);
        toast.success('Plano adicionado');
      }
      onClose();
    } catch {
      toast.error('Erro ao salvar plano');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Novo'} Plano</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome do plano</Label>
            <Input
              placeholder="Ex: Visto americano, Reforma do carro, Viagem de férias"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as LifeGoalCategory }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LIFE_GOAL_CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Custo estimado (R$)</Label>
              <Input
                type="text" inputMode="decimal" placeholder="Ex: 15.000,00"
                value={form.estimated_cost}
                onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Já guardado (R$)</Label>
              <Input
                type="text" inputMode="decimal" placeholder="0,00"
                value={form.saved_amount}
                onChange={e => setForm(f => ({ ...f, saved_amount: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data alvo (opcional)</Label>
              <Input
                type="date"
                value={form.target_date}
                onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as LifeGoalStatus }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="goal-notes">Observação (opcional)</Label>
            <Textarea
              id="goal-notes"
              placeholder="Detalhes, prazo, condições..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1"
              rows={2}
            />
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
