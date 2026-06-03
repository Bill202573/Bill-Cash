import { useEffect, useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddTransaction, useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useAddImportRecord } from '@/hooks/useImportHistory';
import { useAutoLinkTransfers } from '@/hooks/useInternalTransfers';
import { parseFile, type ParsedRow } from '@/lib/importParser';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const FALLBACK_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'done';

export function ImportModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [account, setAccount] = useState('');
  const [rows, setRows] = useState<(ParsedRow & { selected: boolean })[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const add = useAddTransaction();
  const addImport = useAddImportRecord();
  const autoLink = useAutoLinkTransfers();
  const [fileName, setFileName] = useState('');

  const { data: accounts = [] } = useAccounts();
  const { data: existingTxs = [] } = useTransactions();
  const { data: allCatsRaw = [] } = useCategories();
  const rootCatNames = allCatsRaw.filter(c => c.parent_id === null).map(c => c.name);
  const ALL_CATEGORIES = rootCatNames.length > 0 ? rootCatNames : FALLBACK_CATEGORIES;

  // Default account: Nubank William or first account
  useEffect(() => {
    if (accounts.length > 0 && !account) {
      const def =
        accounts.find(a => a.name.toLowerCase().includes('william'))?.name ??
        accounts[0].name;
      setAccount(def);
    }
  }, [accounts]);

  const handleFile = useCallback(async (file: File) => {
    try {
      setFileName(file.name);
      const parsed = await parseFile(file, account);
      if (parsed.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo. Verifique o formato.');
        return;
      }
      // Check for duplicates against existing transactions
      const dupKey = (r: { description: string; amount: number; date: string; account?: string }) =>
        `${r.description.trim().toLowerCase()}|${r.amount}|${r.date}`;
      const existingKeys = new Set(existingTxs.map(dupKey));
      setRows(parsed.map(r => {
        const isDup = existingKeys.has(dupKey(r));
        return { ...r, selected: !isDup, _isDuplicate: isDup };
      }));
      setStep('preview');
    } catch (e) {
      toast.error('Erro ao ler o arquivo. Verifique se é OFX ou CSV válido.');
    }
  }, [account]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const toggleRow = (i: number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const toggleAll = () => {
    const allSelected = rows.every(r => r.selected);
    setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const updateCategory = (i: number, category: string) => {
    const targetDesc = rows[i].description.toLowerCase();

    // Aplica imediatamente na linha alterada
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, category } : r));

    // Verifica outras linhas com mesmo nome e categoria diferente neste import
    const similar = rows.filter(
      (r, idx) => idx !== i &&
        r.description.toLowerCase() === targetDesc &&
        r.category !== category,
    );

    if (similar.length > 0) {
      toast(`${similar.length} transação(ões) com o mesmo nome neste extrato`, {
        description: `Aplicar "${category}" a todas as linhas com "${rows[i].description}"?`,
        duration: 12000,
        action: {
          label: 'Sim, aplicar a todas',
          onClick: () => {
            setRows(prev =>
              prev.map(r =>
                r.description.toLowerCase() === targetDesc ? { ...r, category } : r,
              ),
            );
            toast.success(`Categoria "${category}" aplicada a ${similar.length + 1} transação(ões)`);
          },
        },
        cancel: { label: 'Não', onClick: () => {} },
      });
    }
  };

  const updateType = (i: number, type: 'income' | 'expense') =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, type } : r));

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) { toast.error('Selecione pelo menos uma transação'); return; }
    setImporting(true);
    let count = 0;
    const errors: string[] = [];
    const imported: ParsedRow[] = [];

    for (const row of selected) {
      try {
        const { _raw, selected: _, ...tx } = row as ParsedRow & { selected: boolean; _raw?: string };
        await add.mutateAsync({ ...tx, account: account || tx.account, user: tx.user || 'Você' });
        count++;
        imported.push(tx);
      } catch (e) {
        errors.push(String(e));
      }
    }

    // Auto-detect and link transfers
    if (imported.length > 0) {
      try {
        const linked = await autoLink.mutateAsync(imported);
        if (linked.length > 0) {
          toast.success(`✓ ${linked.length} transferência(s) interna(s) detectada(s) e vinculada(s) automaticamente`);
          count -= linked.length * 2; // Subtract because we created transfer instead of 2 separate txs
        }
      } catch (e) {
        // Non-critical, transfers can be linked manually
      }
    }

    // Save import history
    try {
      const dates = selected.map(r => r.date).filter(Boolean).sort();
      const month = dates[0]?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
      await addImport.mutateAsync({
        account,
        file_name: fileName || 'extrato',
        month,
        total_rows: selected.length,
        saved_rows: count,
      });
    } catch { /* non-critical */ }

    if (errors.length > 0) {
      toast.warning(`${count} importadas, ${errors.length} ignoradas (duplicatas ou erros)`);
    }
    setImportedCount(count);
    setImporting(false);
    setStep('done');
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    // Reset to default account
    const def =
      accounts.find(a => a.name.toLowerCase().includes('william'))?.name ??
      accounts[0]?.name ?? '';
    setAccount(def);
    setImportedCount(0);
    onClose();
  };

  const selectedCount = rows.filter(r => r.selected).length;
  const totalIncome = rows.filter(r => r.selected && r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = rows.filter(r => r.selected && r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'preview' ? 'max-w-4xl max-h-[90vh] flex flex-col' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Importar Extrato'}
            {step === 'preview' && `Revisar ${rows.length} transações encontradas`}
            {step === 'done' && 'Importação concluída'}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label>Vincular à conta</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Todas as transações importadas serão vinculadas a essa conta.
              </p>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-primary bg-primary/10' : 'border-border/60 hover:border-primary/50 hover:bg-secondary/50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Arraste o arquivo ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: OFX, QFX, CSV, TXT</p>
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,.qfx,.csv,.txt"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {/* Bank instructions */}
            <div className="bg-secondary/40 rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm">Como exportar o extrato:</p>
              <p>🟣 <strong>Nubank:</strong> App → Ícone do perfil → Exportar extrato → CSV</p>
              <p>🟠 <strong>Inter:</strong> App/Site → Extrato → Exportar → CSV</p>
              <p>🔵 <strong>Itaú:</strong> Internet Banking → Extrato → Exportar → OFX</p>
              <p>🔴 <strong>Santander:</strong> Internet Banking → Extrato → Exportar → OFX</p>
              <p>🟤 <strong>Bradesco:</strong> Internet Banking → Extrato → Exportar → OFX</p>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && (
          <>
            {/* Summary bar */}
            {(() => {
              const dupCount = rows.filter(r => (r as typeof r & { _isDuplicate?: boolean })._isDuplicate).length;
              return (
                <div className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg text-sm flex-shrink-0 flex-wrap">
                  <span className="font-medium">{selectedCount} de {rows.length} selecionadas</span>
                  <span className="text-income">+{fmt(totalIncome)}</span>
                  <span className="text-expense">-{fmt(totalExpense)}</span>
                  {dupCount > 0 && (
                    <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full font-medium">
                      ⚠️ {dupCount} possível(is) duplicata(s) desmarcada(s)
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                      {rows.every(r => r.selected) ? 'Desmarcar todas' : 'Marcar todas'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Table */}
            <div className="overflow-auto flex-1 rounded-lg border border-border/30">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border/30">
                  <tr className="text-xs text-muted-foreground">
                    <th className="w-8 p-2 text-center">
                      <input
                        type="checkbox"
                        checked={rows.every(r => r.selected)}
                        onChange={toggleAll}
                        className="accent-primary"
                      />
                    </th>
                    <th className="p-2 text-left w-24">Data</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left w-32">Categoria</th>
                    <th className="p-2 text-left w-20">Tipo</th>
                    <th className="p-2 text-right w-28">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/20 ${
                        (row as typeof row & { _isDuplicate?: boolean })._isDuplicate
                          ? 'bg-warning/5'
                          : row.selected ? '' : 'opacity-40'
                      } hover:bg-secondary/30`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(i)}
                          className="accent-primary"
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{row.date}</td>
                      <td className="p-2 max-w-xs truncate" title={row.description}>
                        {row.description}
                        {(row as typeof row & { _isDuplicate?: boolean })._isDuplicate && (
                          <span className="ml-1 text-xs text-warning" title="Possível duplicata">⚠️ dup</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Select value={row.category} onValueChange={v => updateCategory(i, v)}>
                          <SelectTrigger className="h-7 text-xs px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => updateType(i, row.type === 'income' ? 'expense' : 'income')}
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            row.type === 'income'
                              ? 'bg-income/15 text-income'
                              : 'bg-expense/15 text-expense'
                          }`}
                        >
                          {row.type === 'income' ? '↑ Receita' : '↓ Despesa'}
                        </button>
                      </td>
                      <td className={`p-2 text-right font-semibold ${row.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {row.type === 'income' ? '+' : '-'}{fmt(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-shrink-0 pt-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0} className="flex-1">
                {importing ? `Importando... (${importedCount})` : `Importar ${selectedCount} transações`}
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 'done' && (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-income mx-auto" />
            <div>
              <p className="text-xl font-display font-bold">{importedCount} transações importadas!</p>
              <p className="text-sm text-muted-foreground mt-1">
                O dashboard já foi atualizado com os novos dados.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
