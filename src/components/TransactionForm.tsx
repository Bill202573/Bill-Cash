import { useEffect, useMemo, useState } from 'react';
import { Plus, Check, X, ArrowRight } from 'lucide-react';
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
  useTransactions,
} from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories, useAddCategory } from '@/hooks/useCategories';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, supabase, type Transaction } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { fmt } from '@/lib/financial';

interface Props {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction;
}

const TRANSFER_CATEGORY = 'Transferência Interna';

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.abs(Math.round((da - db) / (1000 * 60 * 60 * 24)));
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

  // Transfer-only state
  const [counterpartAccount, setCounterpartAccount] = useState<string>('');
  const [pairedTxId,         setPairedTxId]         = useState<string | null>(null);
  const [savingTransfer,     setSavingTransfer]     = useState(false);

  // Inline add states
  const [addingCat,    setAddingCat]    = useState(false);
  const [newCatName,   setNewCatName]   = useState('');
  const [addingSubcat, setAddingSubcat] = useState(false);
  const [newSubcatName,setNewSubcatName]= useState('');

  const qc             = useQueryClient();
  const add            = useAddTransaction();
  const update         = useUpdateTransaction();
  const bulkCategorize = useBulkCategorize();
  const addCategory    = useAddCategory();
  const isEditing      = !!transaction;
  const loading        = add.isPending || update.isPending || savingTransfer;

  // Accounts and transactions (for transfer candidate search)
  const { data: accounts = [] } = useAccounts();
  const { data: allTxs = [] } = useTransactions();

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
  const catTypeForQuery: 'income' | 'expense' | undefined =
    type === 'transfer' ? undefined : type;
  const { data: allCats = [] } = useCategories(catTypeForQuery);
  const dbRootCats = allCats.filter(c => c.parent_id === null);
  const staticCats = type === 'income'
    ? INCOME_CATEGORIES.map(name => ({ id: name, name, type: 'income' as const, parent_id: null }))
    : type === 'transfer'
    ? [{ id: TRANSFER_CATEGORY, name: TRANSFER_CATEGORY, type: 'both' as const, parent_id: null }]
    : EXPENSE_CATEGORIES.map(name => ({ id: name, name, type: 'expense' as const, parent_id: null }));
  const rootCats     = dbRootCats.length > 0 ? dbRootCats : staticCats;
  const selectedRoot = dbRootCats.find(c => c.name === form.category);
  const subcats      = selectedRoot
    ? allCats.filter(c => c.parent_id === selectedRoot.id)
    : [];

  // ─── TRANSFER MODE: candidates ──────────────────────────────────────────────
  // When marking an existing tx as transfer, look for the counterpart in another account.
  const candidates = useMemo(() => {
    if (type !== 'transfer' || !transaction) return [];
    const amountNum = Number(form.amount);
    if (!amountNum) return [];

    // Looking for the opposite-direction transaction in another account
    const oppositeType =
      transaction.type === 'expense' ? 'income' :
      transaction.type === 'income'  ? 'expense' :
      'transfer'; // already transfer — look for another transfer

    return allTxs
      .filter(t =>
        t.id !== transaction.id &&
        t.amount === amountNum &&
        t.account !== transaction.account &&
        (counterpartAccount ? t.account === counterpartAccount : true) &&
        (t.type === oppositeType || t.type === 'transfer') &&
        daysBetween(t.date, form.date) <= 3,
      )
      .sort((a, b) => daysBetween(a.date, form.date) - daysBetween(b.date, form.date));
  }, [type, transaction, allTxs, counterpartAccount, form.amount, form.date]);

  // Auto-select the only candidate if there's exactly one
  useEffect(() => {
    if (type === 'transfer' && candidates.length === 1 && !pairedTxId) {
      setPairedTxId(candidates[0].id);
    }
  }, [type, candidates, pairedTxId]);

  // Reset paired tx when changing counterpart account
  useEffect(() => {
    setPairedTxId(null);
  }, [counterpartAccount]);

  // Reset subcategory when parent category changes
  const handleCategoryChange = (val: string) => {
    if (val === '__new__') { setAddingCat(true); return; }
    setForm(f => ({ ...f, category: val, subcategory: '' }));
  };

  const handleTypeChange = (newType: 'income' | 'expense' | 'transfer') => {
    setType(newType);
    setForm(f => ({
      ...f,
      // Default category when switching to transfer
      category: newType === 'transfer' ? TRANSFER_CATEGORY : (newType === f.category ? f.category : ''),
      subcategory: '',
    }));
    setPairedTxId(null);
    setCounterpartAccount('');
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    try {
      // categories.type must be 'income' | 'expense' | 'both'
      const dbType: 'income' | 'expense' | 'both' = type === 'transfer' ? 'both' : type;
      await addCategory.mutateAsync({ name, type: dbType, parent_id: null });
      setForm(f => ({ ...f, category: name, subcategory: '' }));
      toast.success(`Categoria "${name}" criada`);
    } catch (e: any) {
      console.error('[ADD CATEGORY ERROR]', e);
      toast.error('Erro ao criar categoria: ' + (e?.message ?? String(e)));
    } finally {
      setAddingCat(false);
      setNewCatName('');
    }
  };

  const handleAddSubcategory = async () => {
    const name = newSubcatName.trim();
    if (!name || !selectedRoot) return;
    try {
      const dbType: 'income' | 'expense' | 'both' = type === 'transfer' ? 'both' : type;
      await addCategory.mutateAsync({ name, type: dbType, parent_id: selectedRoot.id });
      setForm(f => ({ ...f, subcategory: name }));
      toast.success(`Subcategoria "${name}" criada`);
    } catch (e: any) {
      console.error('[ADD SUBCATEGORY ERROR]', e);
      toast.error('Erro ao criar subcategoria: ' + (e?.message ?? String(e)));
    } finally {
      setAddingSubcat(false);
      setNewSubcatName('');
    }
  };

  // ─── TRANSFER SAVE ──────────────────────────────────────────────────────────
  const handleSaveTransfer = async () => {
    if (!transaction) {
      toast.error('A criação de transferência nova ainda não é suportada por este formulário. Use o botão "Transferir" na página de Contas.');
      return;
    }
    if (!pairedTxId) {
      toast.error('Selecione a transação correspondente em outra conta');
      return;
    }
    const pair = allTxs.find(t => t.id === pairedTxId);
    if (!pair) {
      toast.error('Transação correspondente não encontrada');
      return;
    }

    setSavingTransfer(true);
    try {
      // Decide which side is FROM (saída) and which is TO (entrada)
      const sourceWasExpense = transaction.type === 'expense';
      const fromTx = sourceWasExpense ? transaction : pair;
      const toTx   = sourceWasExpense ? pair        : transaction;

      // Use the chosen category (or fallback to TRANSFER_CATEGORY)
      const finalCategory = form.category || TRANSFER_CATEGORY;

      // 1) Update both transactions
      const { error: e1 } = await supabase
        .from('transactions')
        .update({ type: 'transfer', category: finalCategory })
        .in('id', [fromTx.id, toTx.id]);
      if (e1) throw e1;

      // 2) Link in internal_transfers (ignore if a link already exists)
      const { data: existingLinks } = await supabase
        .from('internal_transfers')
        .select('id')
        .or(`from_tx_id.eq.${fromTx.id},to_tx_id.eq.${toTx.id},from_tx_id.eq.${toTx.id},to_tx_id.eq.${fromTx.id}`)
        .limit(1);

      if (!existingLinks || existingLinks.length === 0) {
        const { error: e2 } = await supabase
          .from('internal_transfers')
          .insert([{
            from_account: fromTx.account,
            to_account:   toTx.account,
            amount:       fromTx.amount,
            date:         fromTx.date,
            description:  fromTx.description,
            from_tx_id:   fromTx.id,
            to_tx_id:     toTx.id,
          }]);
        if (e2) throw e2;
      }

      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await qc.invalidateQueries({ queryKey: ['internal_transfers'] });

      toast.success(`Transferência confirmada: ${fromTx.account} → ${toTx.account}`);
      onClose();
    } catch (e: any) {
      console.error('[SAVE TRANSFER ERROR]', e);
      toast.error('Erro ao salvar transferência: ' + (e?.message ?? String(e)));
    } finally {
      setSavingTransfer(false);
    }
  };

  // ─── NORMAL SAVE (income/expense) ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'transfer') {
      // Transfer has its own flow
      await handleSaveTransfer();
      return;
    }

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
    } catch (err: any) {
      console.error('[SAVE TRANSACTION ERROR]', err);
      toast.error('Erro ao salvar transação: ' + (err?.message ?? String(err)));
    }
  };

  // For transfer UI: figure out from/to labels based on source tx type
  const transferLabels = transaction
    ? transaction.type === 'expense'
      ? { current: 'Conta de origem (saída)', counterpart: 'Conta de destino (entrada)' }
      : { current: 'Conta de destino (entrada)', counterpart: 'Conta de origem (saída)' }
    : { current: 'Esta conta', counterpart: 'Outra conta' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                onClick={() => handleTypeChange(value)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  type === value ? active : 'bg-transparent text-muted-foreground hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ─── TRANSFER MODE (existing tx) ──────────────────────────────────── */}
          {type === 'transfer' && isEditing && (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-400 mb-1">Marcar como Transferência Interna</p>
                <p className="text-xs text-muted-foreground">
                  Esta transação ({fmt(Number(form.amount))} • {form.account} • {form.date}) será reclassificada como transferência. Selecione a transação correspondente na outra conta para confirmar.
                </p>
              </div>

              {/* This account (read-only) */}
              <div>
                <Label className="text-xs">{transferLabels.current}</Label>
                <div className="mt-1 px-3 py-2 bg-secondary/50 rounded-md text-sm">
                  <strong>{form.account}</strong> — {transaction.type === 'income' ? 'Entrada' : 'Saída'} de {fmt(Number(form.amount))}
                </div>
              </div>

              <div className="text-center text-muted-foreground">
                <ArrowRight className="h-4 w-4 inline" />
              </div>

              {/* Counterpart account selector */}
              <div>
                <Label>{transferLabels.counterpart}</Label>
                <Select value={counterpartAccount} onValueChange={setCounterpartAccount}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a outra conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.name !== form.account).map(a => (
                      <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Candidates */}
              {counterpartAccount && (
                <div>
                  <Label className="text-xs">
                    Transação correspondente em {counterpartAccount}
                  </Label>
                  {candidates.length === 0 ? (
                    <p className="mt-2 text-xs text-warning bg-warning/10 rounded p-3">
                      ⚠️ Nenhuma transação de R$ {form.amount} encontrada em {counterpartAccount} (até 3 dias da data).
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {candidates.map(c => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${
                            pairedTxId === c.id ? 'border-primary bg-primary/10' : 'border-border/40 hover:bg-secondary/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="pairedTx"
                            checked={pairedTxId === c.id}
                            onChange={() => setPairedTxId(c.id)}
                            className="accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{c.description}</p>
                            <p className="text-muted-foreground">
                              {c.date} • {c.type === 'income' ? 'Recebido' : c.type === 'expense' ? 'Pago' : 'Transferência'}
                              {daysBetween(c.date, form.date) > 0 && (
                                <span className="ml-1 text-warning">
                                  ({daysBetween(c.date, form.date)} dia(s))
                                </span>
                              )}
                            </p>
                          </div>
                          <span className={c.type === 'income' ? 'text-income' : 'text-expense'}>
                            {c.type === 'income' ? '+' : '-'}{fmt(c.amount)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Categoria (opcional para transfer) */}
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
                      <SelectValue placeholder="Transferência Interna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TRANSFER_CATEGORY}>{TRANSFER_CATEGORY}</SelectItem>
                      {rootCats.filter(c => c.name !== TRANSFER_CATEGORY).map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value="__new__" className="text-primary font-medium">
                        ＋ Adicionar nova categoria...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading || !pairedTxId}>
                  {loading ? 'Salvando...' : 'Confirmar Transferência'}
                </Button>
              </div>
            </>
          )}

          {/* ─── NORMAL MODE (income/expense, or new tx) ──────────────────────── */}
          {(type !== 'transfer' || !isEditing) && (
            <>
              {type === 'transfer' && !isEditing && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-muted-foreground">
                  Para criar uma transferência nova, vá em <strong>Contas → Transferir</strong>.
                </div>
              )}

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
                <Button type="submit" className="flex-1" disabled={loading || (type === 'transfer' && !isEditing)}>
                  {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
