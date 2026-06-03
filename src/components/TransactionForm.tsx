import { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useAddTransaction,
  useUpdateTransaction,
  useBulkCategorize,
  countSimilarTransactions,
} from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories, useAddCategory } from '@/hooks/useCategories';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Transaction } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction;
}

export function TransactionForm({ open, onClose, transaction }: Props) {
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(transaction?.type ?? 'expense');
  const [form, setForm] = useState({
    description:  transaction?.description  ?? '',
    amount:       transaction?.amount?.toString() ?? '',
    category:     transaction?.category     ?? '',
    subcategory:  transaction?.subcategory  ?? '',
    date:         transaction?.date         ?? new Date().toISOString().slice(0, 10),
    account:      transaction?.account      ?? '',
    user:         transaction?.user         ?? 'Você',
    notes:        transaction?.notes        ?? '',
  });

  // Inline add states
  const [addingCat,    setAddingCat]    = useState(false);
  const [newCatName,   setNewCatName]   = useState('');
  const [addingSubcat, setAddingSubcat] = useState(false);
  const [newSubcatName,setNewSubcatName]= useState('');

  const add            = useAddTransaction();
  const update         = useUpdateTransaction();
  const bulkCategorize = useBulkCategorize();
  const addCategory    = useAddCategory();
  const isEditing      = !!transaction;
  const loading        = add.isPending || update.isPending;

  // Accounts
  const { data: accounts = [] } = useAccounts();

  // Set default account (Nubank William or first) when creating new
  useEffect(() => {
    if (!transaction && accounts.length > 0 && !form.account) {
      const def =
        accounts.find(a => a.name.toLowerCase().includes('william'))?.name ??
        accounts[0].name;
      setForm(f => ({ ...f, account: def }));
    }
  }, [accounts, transaction]);

  // Categories — fallback to static list if DB table is empty
  const catType = type === 'transfer' ? undefined : type;
  const { data: allCats = [] } = useCategories(catType);
  const dbRootCats = allCats.filter(c => c.parent_id === null);
  const staticCats = type === 'income'
    ? INCOME_CATEGORIES.map(name => ({ id: name, name, type: 'income' as const, parent_id: null }))
    : type === 'transfer'
    ? [{ id: 'Transferência', name: 'Transferência', type: 'both' as const, parent_id: null }]
    : EXPENSE_CATEGORIES.map(name => ({ id: name, name, type: 'expense' as const, parent_id: null }));
  const rootCats     = dbRootCats.length > 0 ? dbRootCats : staticCats;
  const selectedRoot = dbRootCats.find(c => c.name === form.category);
  const subcats      = selectedRoot
    ? allCats.filter(c => c.parent_id === selectedRoot.id)
    : [];

  // Reset subcategory when parent category changes
  const handleCategoryChange = (val: string) => {
    if (val === '__new__') { setAddingCat(true); return; }
    setForm(f => ({ ...f, category: val, subcategory: '' }));
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    try {
      await addCategory.mutateAsync({ name, type, parent_id: null });
      setForm(f => ({ ...f, category: name, subcategory: '' }));
      toast.success(`Categoria "${name}" criada`);
    } catch {
      toast.error('Erro ao criar categoria');
    } finally {
      setAddingCat(false);
      setNewCatName('');
    }
  };

  const handleAddSubcategory = async () => {
    const name = newSubcatName.trim();
    if (!name || !selectedRoot) return;
    try {
      await addCategory.mutateAsync({ name, type, parent_id: selectedRoot.id });
      setForm(f => ({ ...f, subcategory: name }));
      toast.success(`Subcategoria "${name}" criada`);
    } catch {
      toast.error('Erro ao criar subcategoria');
    } finally {
      setAddingSubcat(false);
      setNewSubcatName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) {
      toast.error('Informe um valor válido'); return;
    }
    if (!form.category) {
      toast.error('Selecione uma categoria'); return;
    }
    try {
      const payload = {
        ...form,
        type,
        amount:     parseFloat(form.amount),
        subcategory: form.subcategory || undefined,
      };
      let savedId: string;

      if (isEditing) {
        const saved = await update.mutateAsync({ id: transaction.id, ...payload });
        savedId = saved.id;
        toast.success('Transação atualizada');
      } else {
        const saved = await add.mutateAsync(payload);
        savedId = saved.id;
        toast.success('Transação adicionada');
      }

      onClose();

      const similarCount = await countSimilarTransactions(form.description, form.category, savedId);
      if (similarCount > 0) {
        toast(`${similarCount} transação(ões) com nome similar`, {
          description: `Outras transações com "${form.description}" estão em categorias diferentes. Aplicar "${form.category}" a todas?`,
          duration: 15000,
          action: {
            label: 'Sim, aplicar',
            onClick: async () => {
              const updated = await bulkCategorize.mutateAsync({
                description: form.description,
                category:    form.category,
                excludeId:   savedId,
              });
              toast.success(`${updated} transação(ões) atualizada(s) para "${form.category}"`);
            },
          },
          cancel: { label: 'Não', onClick: () => {} },
        });
      }
    } catch {
      toast.error('Erro ao salvar transação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nova'} Transação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {([
              { value: 'expense',  label: '↓ Despesa',      active: 'bg-expense text-white' },
              { value: 'income',   label: '↑ Receita',       active: 'bg-income text-white' },
              { value: 'transfer', label: '⇄ Transferência', active: 'bg-blue-600 text-white' },
            ] as const).map(({ value, label, active }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setType(value); setForm(f => ({ ...f, category: value === 'transfer' ? 'Transferência' : '', subcategory: '' })); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  type === value ? active : 'bg-transparent text-muted-foreground hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number" step="0.01" min="0"
                placeholder="0,00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="mt-1"
              />
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

          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Categoria</Label>
              {!addingCat && (
                <button
                  type="button"
                  onClick={() => setAddingCat(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Nova categoria
                </button>
              )}
            </div>

            {addingCat ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Nome da categoria"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  className="flex-1"
                />
                <Button type="button" size="icon" variant="default" onClick={handleAddCategory}
                  disabled={addCategory.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="outline"
                  onClick={() => { setAddingCat(false); setNewCatName(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {rootCats.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-primary font-medium">
                    ＋ Adicionar nova categoria...
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subcategoria — aparece quando categoria selecionada */}
          {form.category && !addingCat && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>
                  Subcategoria
                  <span className="text-muted-foreground text-xs ml-1">(opcional)</span>
                </Label>
                {!addingSubcat && (
                  <button
                    type="button"
                    onClick={() => setAddingSubcat(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Nova
                  </button>
                )}
              </div>

              {addingSubcat ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder={`Ex: Combustível (em ${form.category})`}
                    value={newSubcatName}
                    onChange={e => setNewSubcatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubcategory())}
                    className="flex-1"
                  />
                  <Button type="button" size="icon" variant="default"
                    onClick={handleAddSubcategory} disabled={addCategory.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline"
                    onClick={() => { setAddingSubcat(false); setNewSubcatName(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.subcategory}
                  onValueChange={v => setForm(f => ({ ...f, subcategory: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {subcats.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Conta + Pessoa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta / Cartão</Label>
              <Select
                value={form.account}
                onValueChange={v => setForm(f => ({ ...f, account: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="user">Pessoa</Label>
              <Input
                id="user"
                placeholder="Ex: Você"
                value={form.user}
                onChange={e => setForm(f => ({ ...f, user: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
