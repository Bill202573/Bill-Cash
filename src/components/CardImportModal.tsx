import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle2, AlertTriangle, Receipt } from 'lucide-react';
import { useAddCardExpense } from '@/hooks/useCardExpenses';
import { parseFile } from '@/lib/importParser';
import { fmt } from '@/lib/financial';
import { EXPENSE_CATEGORIES, type CreditCard } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  open:    boolean;
  onClose: () => void;
  card:    CreditCard;
}

type Step = 'upload' | 'preview' | 'done';

interface PreviewRow {
  description: string;
  amount:      number;
  date:        string;
  category:    string;
  selected:    boolean;
}

/** Gera lista de meses (do mês atual ± 6) para o seletor */
function getMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const opts: Array<{ value: string; label: string }> = [];
  for (let i = 6; i >= -6; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

/** Mês mais frequente entre as datas das despesas (default sugerido) */
function getMostCommonMonth(rows: PreviewRow[]): string | null {
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function CardImportModal({ open, onClose, card }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [billMonth, setBillMonth] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addExpense = useAddCardExpense();
  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Sugere o mês mais comum nas datas como mês padrão da fatura
  useEffect(() => {
    if (rows.length > 0 && !billMonth) {
      const suggested = getMostCommonMonth(rows);
      if (suggested) setBillMonth(suggested);
    }
  }, [rows, billMonth]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const parsed = await parseFile(file, card.name);
      console.log('[CARD IMPORT] Parsed file:', file.name, '→', parsed.length, 'linhas');
      if (parsed.length > 0) console.log('[CARD IMPORT] Sample:', parsed.slice(0, 3));

      if (parsed.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo. Verifique se é OFX, QFX, CSV ou TXT válido.');
        return;
      }

      const onlyExpenses = parsed
        .filter(r => r.type === 'expense')
        .map(r => ({
          description: r.description,
          amount:      r.amount,
          date:        r.date,
          category:    r.category || '',
          selected:    true,
        }));

      if (onlyExpenses.length === 0) {
        toast.error(`O arquivo tem ${parsed.length} linha(s), mas nenhuma é despesa. Pagamentos e estornos não são importados aqui.`, { duration: 8000 });
        return;
      }

      setRows(onlyExpenses);
      setStep('preview');
    } catch (e: any) {
      console.error('[CARD IMPORT PARSE ERROR]', e);
      toast.error('Erro ao ler o arquivo: ' + (e?.message ?? String(e)));
    }
  }, [card.name]);

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
    const allSel = rows.every(r => r.selected);
    setRows(prev => prev.map(r => ({ ...r, selected: !allSel })));
  };

  const updateCategory = (i: number, cat: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, category: cat } : r));
  };

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) {
      toast.error('Selecione pelo menos uma despesa');
      return;
    }
    if (!billMonth) {
      toast.error('Selecione o mês de referência da fatura');
      return;
    }

    setImporting(true);
    let count = 0;
    const errs: string[] = [];

    for (const row of selected) {
      try {
        await addExpense.mutateAsync({
          cardId:            card.id,
          closingDay:        card.closing_day,
          dueDay:            card.due_day,
          description:       row.description,
          amount:            row.amount,
          purchaseDate:      row.date,
          category:          row.category || undefined,
          origin:            'import',
          status:            'pending',
          forceBillMonthRef: billMonth,   // ← força TODAS para a mesma fatura
        });
        count++;
      } catch (e: any) {
        console.error('[CARD IMPORT ROW ERROR]', e);
        errs.push(e?.message ?? String(e));
      }
    }

    setImportedCount(count);
    setErrors(errs);
    setImporting(false);
    setStep('done');
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setBillMonth('');
    setImportedCount(0);
    setErrors([]);
    onClose();
  };

  const selectedCount = rows.filter(r => r.selected).length;
  const totalSelected = rows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'preview' ? 'max-w-4xl max-h-[90vh] flex flex-col' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>
            {step === 'upload'  && `Importar Fatura — ${card.name}`}
            {step === 'preview' && `Revisar ${rows.length} despesa(s) encontrada(s)`}
            {step === 'done'    && 'Importação concluída'}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs space-y-1.5">
              <p className="font-medium text-blue-400">Formatos aceitos: OFX, QFX, CSV, TXT</p>
              <p className="text-muted-foreground">
                <strong>Nubank:</strong> App → Cartão → Faturas → Mês → Exportar → OFX ou CSV
              </p>
              <p className="text-muted-foreground">
                <strong>Outros bancos:</strong> Geralmente exportam fatura em OFX
              </p>
              <p className="text-muted-foreground pt-1">
                Apenas <strong>compras (despesas)</strong> são importadas. Pagamentos e estornos não entram aqui.
              </p>
              <p className="text-muted-foreground">
                Todas vêm como <strong>pendentes</strong> para você revisar.
              </p>
            </div>

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
              <p className="text-xs text-muted-foreground mt-1">OFX, QFX, CSV, TXT</p>
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,.qfx,.csv,.txt"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && (
          <>
            {/* Seletor de mês da fatura — CRÍTICO */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 flex-shrink-0">
              <Label className="text-xs text-primary font-medium flex items-center gap-1">
                <Receipt className="h-3 w-3" /> Mês de referência da fatura
              </Label>
              <Select value={billMonth} onValueChange={setBillMonth}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o mês..." />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                ⚠️ <strong>Todas</strong> as despesas serão lançadas nesta fatura única, mesmo que tenham datas em meses diferentes (faturas de cartão costumam ter compras retroativas do mês anterior por causa do fechamento).
              </p>
            </div>

            <div className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg text-sm flex-shrink-0 flex-wrap">
              <span className="font-medium">{selectedCount} de {rows.length} selecionadas</span>
              <span className="text-expense">Total: -{fmt(totalSelected)}</span>
              <button onClick={toggleAll} className="ml-auto text-xs text-primary hover:underline">
                {rows.every(r => r.selected) ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>

            <div className="overflow-auto flex-1 rounded-lg border border-border/30 mt-2">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border/30">
                  <tr className="text-xs text-muted-foreground">
                    <th className="w-8 p-2 text-center">
                      <input type="checkbox" checked={rows.every(r => r.selected)} onChange={toggleAll} className="accent-primary" />
                    </th>
                    <th className="p-2 text-left w-24">Data compra</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left w-32">Categoria</th>
                    <th className="p-2 text-right w-28">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-border/20 ${row.selected ? '' : 'opacity-40'} hover:bg-secondary/30`}>
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} className="accent-primary" />
                      </td>
                      <td className="p-2 text-muted-foreground">{row.date}</td>
                      <td className="p-2 max-w-xs truncate" title={row.description}>{row.description}</td>
                      <td className="p-2">
                        <Select value={row.category} onValueChange={v => updateCategory(i, v)}>
                          <SelectTrigger className="h-7 text-xs px-2">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-right font-semibold text-expense">-{fmt(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 flex-shrink-0 pt-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">Voltar</Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0 || !billMonth} className="flex-1">
                {importing ? `Importando... (${importedCount})` : `Importar ${selectedCount} para fatura ${billMonth}`}
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 'done' && (
          <div className="text-center py-4 space-y-4">
            {errors.length === 0 ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-income mx-auto" />
                <div>
                  <p className="text-xl font-display font-bold">{importedCount} despesa(s) importada(s)!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Todas vinculadas à fatura <strong>{billMonth}</strong>. Próximo passo: triagem e conciliação.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
                <div>
                  <p className="text-xl font-display font-bold">{importedCount} importadas, {errors.length} com erro</p>
                  <p className="text-sm text-muted-foreground mt-1 max-h-32 overflow-y-auto">
                    {errors[0]}
                  </p>
                </div>
              </>
            )}
            <Button onClick={handleClose} className="w-full">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
