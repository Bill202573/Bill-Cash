import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddCategory, useUpdateCategory, type Category } from '@/hooks/useCategories';
import { toast } from 'sonner';

interface Props {
  open:        boolean;
  onClose:     () => void;
  category?:   Category;        // se passada → modo edit
  parent?:     Category | null; // se passada → criando subcategoria desse pai
  defaultType?: 'income' | 'expense' | 'both';
}

const TYPE_OPTIONS: Array<{ value: 'income' | 'expense' | 'both'; label: string }> = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income',  label: 'Receita' },
  { value: 'both',    label: 'Ambos'   },
];

export function CategoryForm({ open, onClose, category, parent, defaultType = 'expense' }: Props) {
  const isEditing = !!category;
  const isSubcat  = !!parent;

  const [form, setForm] = useState({
    name: category?.name ?? '',
    type: category?.type ?? (parent?.type ?? defaultType),
  });

  const add    = useAddCategory();
  const update = useUpdateCategory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('Informe o nome');
      return;
    }
    try {
      if (isEditing) {
        await update.mutateAsync({
          id:   category!.id,
          name,
          type: form.type,
        });
        toast.success('Categoria atualizada');
      } else {
        await add.mutateAsync({
          name,
          type:      form.type,
          parent_id: parent?.id ?? null,
        });
        toast.success(isSubcat ? `Subcategoria "${name}" criada` : `Categoria "${name}" criada`);
      }
      onClose();
    } catch (err: any) {
      console.error('[CATEGORY SAVE ERROR]', err);
      toast.error('Erro ao salvar: ' + (err?.message ?? String(err)));
    }
  };

  const title = isEditing
    ? (isSubcat ? 'Editar Subcategoria' : 'Editar Categoria')
    : (isSubcat ? `Nova Subcategoria de "${parent!.name}"` : 'Nova Categoria');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              placeholder={isSubcat ? 'Ex: Restaurante, Mercado, Delivery' : 'Ex: Alimentação, Transporte'}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Tipo só é editável para categoria raiz; subcategorias herdam do pai */}
          {!isSubcat && (
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v: 'income' | 'expense' | 'both') => setForm(f => ({ ...f, type: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Define onde a categoria pode ser usada: em despesas, receitas, ou ambos.
              </p>
            </div>
          )}

          {isSubcat && (
            <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground">
              Esta subcategoria herda o tipo <strong className="text-foreground">{parent!.type}</strong> da categoria pai.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={add.isPending || update.isPending}>
              {(add.isPending || update.isPending) ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
