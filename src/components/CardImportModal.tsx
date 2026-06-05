import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, CheckCircle2, AlertTriangle, Receipt, Layers } from 'lucide-react';
import { useAddCardExpense, useCardExpenses, useProjectInstallments, recalculateManyBills } from '@/hooks/useCardExpenses';
import { parseFile } from '@/lib/importParser';
import { fmt } from '@/lib/financial';
import { EXPENSE_CATEGORIES, supabase, type CreditCard } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { parseParcela } from '@/lib/parcelas';

interface Props {
  open:    boolean;
  onClose: () => void;
  card:    CreditCard;
}

type Step = 'upload' | 'preview' | 'done';

interface PreviewRow {
  description:    string;     // descrição original (como veio do banco)
  amount:         number;
  date:           string;     // purchase_date
  category:       string;
  selected:       boolean;

  // Parcela detectada (se houver)
  parcela?:       { current: number; total: number; baseDescription: string };

  // Status: duplicada (já existe nesta mesma fatura) ou matched (já existe como projeção)
  isDuplicate?:   boolean;
  matchedExpenseId?: string;   // id da despesa já existente (projeção) que deve ser reaproveitada
}

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
  const [projectFutureParcelas, setProjectFutureParcelas] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [projectedCount, setProjectedCount] = useState(0);
  const [skippedDupCount, setSkippedDupCount] = useState(0);
  const [mergedCount, setMergedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addExpense    = useAddCardExpense();
  const projectExp    = useProjectInstallments();
  const monthOptions  = useMemo(() => getMonthOptions(), []);

  // Carrega despesas existentes do MESMO cartão para fazer matching/duplicate-check
  const { data: existingExpenses = [] } = useCardExpenses({ cardId: card.id });

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

      const onlyExpenses: PreviewRow[] = parsed
        .filter(r => r.type === 'expense')
        .map(r => {
          const parcela = parseParcela(r.description);
          return {
            description: r.description,
            amount:      r.amount,
            date:        r.date,
            category:    r.category || '',
            selected:    true,
            parcela:     parcela ?? undefined,
          };
        });

      if (onlyExpenses.length === 0) {
        toast.error(`O arquivo tem ${parsed.length} linha(s), mas nenhuma é despesa.`, { duration: 8000 });
        return;
      }

      setRows(onlyExpenses);
      setStep('preview');
    } catch (e: any) {
      console.error('[CARD IMPORT PARSE ERROR]', e);
      toast.error('Erro ao ler o arquivo: ' + (e?.message ?? String(e)));
    }
  }, [card.name]);

  // Quando billMonth muda OU rows são carregados, recalcula duplicates e matches
  useEffect(() => {
    if (rows.length === 0 || !billMonth) return;

    setRows(prev => prev.map(r => {
      // 1) MATCH (prioritário): existe esta exata parcela já no DB?
      //    Critério: mesma installment + total + amount próximo + baseDescription bate
      let matchedExpenseId: string | undefined;
      if (r.parcela) {
        const base = r.parcela.baseDescription.toLowerCase();
        const m = existingExpenses.find(e => {
          if (e.installment !== r.parcela!.current) return false;
          if (e.total_installments !== r.parcela!.total) return false;
          if (Math.abs(Number(e.amount) - r.amount) > 0.5) return false;
          // Bate descrição: ou o e.description contém a base, ou inversamente
          // (cobre projeções que usam "(1/12)" já no nome)
          const eDesc = e.description.toLowerCase();
          const eDescBase = eDesc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
          return eDesc.includes(base) || base.includes(eDescBase);
        });
        if (m) matchedExpenseId = m.id;
      }

      // 2) DUPLICATE: mesma compra exata já existe no DB para este cartão
      //    Critério: descrição (case insensitive), valor, data
      //    Só marca como dup se NÃO foi marcado como match (match tem prioridade)
      const isDuplicate = !matchedExpenseId && existingExpenses.some(e =>
        e.description.trim().toLowerCase() === r.description.trim().toLowerCase() &&
        Math.abs(Number(e.amount) - r.amount) < 0.01 &&
        e.purchase_date === r.date,
      );

      return { ...r, isDuplicate, matchedExpenseId };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billMonth, existingExpenses.length, rows.length]);

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
    const selected = rows.filter(r => r.selected && !r.isDuplicate);
    const dups = rows.filter(r => r.selected && r.isDuplicate);
    if (selected.length === 0) {
      toast.error('Selecione pelo menos uma despesa não-duplicada');
      return;
    }

    setImporting(true);
    let count = 0;
    let projected = 0;
    let merged = 0;
    const errs: string[] = [];
    const affectedBillIds = new Set<string>();

    for (const row of selected) {
      try {
        // 1) Se é parcela 1/N E o usuário pediu projeção: cria todas as N
        //    A parcela atual entra como CONFIRMED (veio da fatura oficial),
        //    as futuras como PENDING (ainda não foram cobradas)
        if (row.parcela && projectFutureParcelas && !row.matchedExpenseId) {
          const result = await projectExp.mutateAsync({
            cardId:              card.id,
            closingDay:          card.closing_day,
            dueDay:              card.due_day,
            currentBillMonthRef: billMonth,
            baseDescription:     row.parcela.baseDescription,
            installmentAmount:   row.amount,
            currentInstallment:  row.parcela.current,
            totalInstallments:   row.parcela.total,
            purchaseDate:        row.date,
            category:            row.category || undefined,
          });
          // Promove a parcela atual para 'confirmed' (veio da fatura oficial)
          const current = result.expenses.find(e => e.installment === row.parcela!.current);
          if (current) {
            await supabase
              .from('card_expenses')
              .update({ status: 'confirmed', origin: 'import' })
              .eq('id', current.id);
            if (current.bill_id) affectedBillIds.add(current.bill_id);
          }
          // Adiciona todos os bill_ids das parcelas projetadas para recalcular
          result.expenses.forEach(e => { if (e.bill_id) affectedBillIds.add(e.bill_id); });
          count++;                                            // a parcela atual
          projected += (result.expenses.length - 1);          // as futuras
          continue;
        }

        // 2) Se há matching (parcela já existia como projeção):
        //    PROMOVE para 'confirmed' + atualiza dados com os oficiais
        if (row.matchedExpenseId) {
          const { data: updated, error } = await supabase
            .from('card_expenses')
            .update({
              amount:        row.amount,
              description:   row.description,
              purchase_date: row.date,
              category:      row.category || undefined,
              origin:        'import',
              status:        'confirmed',   // ← vem da fatura oficial, está confirmada
            })
            .eq('id', row.matchedExpenseId)
            .select('bill_id')
            .single();
          if (error) throw error;
          if (updated?.bill_id) affectedBillIds.add(updated.bill_id);
          merged++;
          continue;
        }

        // 3) Caso comum: despesa sem parcela ou sem projeção solicitada
        //    Entra como CONFIRMED — veio da fatura oficial do banco
        const inserted = await addExpense.mutateAsync({
          cardId:            card.id,
          closingDay:        card.closing_day,
          dueDay:            card.due_day,
          description:       row.description,
          amount:            row.amount,
          purchaseDate:      row.date,
          category:          row.category || undefined,
          totalInstallments: 1,
          origin:            'import',
          status:            'confirmed',
          forceBillMonthRef: billMonth,
        });
        inserted.forEach(e => { if (e.bill_id) affectedBillIds.add(e.bill_id); });
        count++;
      } catch (e: any) {
        console.error('[CARD IMPORT ROW ERROR]', e);
        errs.push(e?.message ?? String(e));
      }
    }

    // Recalcula total_amount de TODAS as faturas afetadas
    // (garante que o "Total" na sidebar reflete a soma real)
    try {
      await recalculateManyBills([...affectedBillIds]);
    } catch (e) {
      console.error('[RECALC ERROR]', e);
    }

    setImportedCount(count);
    setProjectedCount(projected);
    setMergedCount(merged);
    setSkippedDupCount(dups.length);
    setErrors(errs);
    setImporting(false);
    setStep('done');
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setBillMonth('');
    setImportedCount(0);
    setProjectedCount(0);
    setMergedCount(0);
    setSkippedDupCount(0);
    setErrors([]);
    onClose();
  };

  const selectedCount       = rows.filter(r => r.selected).length;
  const totalSelected       = rows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0);
  const parcelaRowsCount    = rows.filter(r => r.parcela).length;
  const duplicatesCount     = rows.filter(r => r.isDuplicate).length;
  const projectableCount    = rows.filter(r => r.parcela && !r.matchedExpenseId).length;
  const matchingCount       = rows.filter(r => r.matchedExpenseId).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'preview' ? 'max-w-5xl max-h-[90vh] flex flex-col' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>
            {step === 'upload'  && `Importar Fatura — ${card.name}`}
            {step === 'preview' && `Revisar ${rows.length} despesa(s) encontrada(s)`}
            {step === 'done'    && 'Importação concluída'}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs space-y-1.5">
              <p className="font-medium text-blue-400">Formatos aceitos: OFX, QFX, CSV, TXT</p>
              <p className="text-muted-foreground">
                <strong>Nubank:</strong> App → Cartão → Faturas → Mês → Exportar → OFX ou CSV
              </p>
              <p className="text-muted-foreground pt-1">
                Apenas <strong>compras (despesas)</strong> são importadas. Pagamentos e estornos não entram aqui.
              </p>
              <p className="text-muted-foreground">
                Todas vêm como <strong>pendentes</strong> para você revisar.
              </p>
              <p className="text-muted-foreground">
                ⚡ <strong>Parcelas detectadas automaticamente</strong> — você decide se quer projetar as futuras.
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

        {/* STEP 2: Preview */}
        {step === 'preview' && (
          <>
            {/* Painel de controle */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 flex-shrink-0 space-y-3">
              <div>
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
              </div>

              {parcelaRowsCount > 0 && (
                <div className="border-t border-primary/20 pt-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={projectFutureParcelas}
                      onCheckedChange={v => setProjectFutureParcelas(Boolean(v))}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Projetar parcelas futuras
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {projectableCount} compra(s) parcelada(s) detectada(s). Marque para criar as parcelas futuras
                        nas faturas dos próximos meses. Útil para fluxo de caixa.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Status de matching/duplicatas */}
              {(duplicatesCount > 0 || matchingCount > 0) && (
                <div className="border-t border-primary/20 pt-3 text-[11px] space-y-1">
                  {duplicatesCount > 0 && (
                    <p className="text-warning">
                      ⚠️ <strong>{duplicatesCount}</strong> despesa(s) marcada(s) como duplicada(s) — ignoradas no import
                    </p>
                  )}
                  {matchingCount > 0 && (
                    <p className="text-income">
                      ✓ <strong>{matchingCount}</strong> parcela(s) já existem como projeção — serão atualizadas (sem duplicar)
                    </p>
                  )}
                </div>
              )}
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
                    <th className="p-2 text-left w-24">Data</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left w-32">Categoria</th>
                    <th className="p-2 text-right w-28">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/20 ${
                        row.isDuplicate ? 'bg-warning/5' :
                        row.matchedExpenseId ? 'bg-income/5' :
                        row.selected ? '' : 'opacity-40'
                      } hover:bg-secondary/30`}
                    >
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} className="accent-primary" />
                      </td>
                      <td className="p-2 text-muted-foreground">{row.date}</td>
                      <td className="p-2 max-w-xs truncate" title={row.description}>
                        {row.description}
                        {row.parcela && !row.matchedExpenseId && (
                          <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
                            {row.parcela.current}/{row.parcela.total}
                          </span>
                        )}
                        {row.matchedExpenseId && (
                          <span className="ml-1 text-[10px] bg-income/15 text-income px-1.5 py-0.5 rounded font-medium">
                            ✓ já projetada
                          </span>
                        )}
                        {row.isDuplicate && (
                          <span className="ml-1 text-[10px] bg-warning/15 text-warning px-1.5 py-0.5 rounded font-medium">
                            ⚠️ duplicada
                          </span>
                        )}
                      </td>
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
                {importing ? `Importando... (${importedCount})` : `Importar para fatura ${billMonth}`}
              </Button>
            </div>
          </>
        )}

        {/* STEP 3: Done */}
        {step === 'done' && (
          <div className="text-center py-4 space-y-4">
            {errors.length === 0 ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-income mx-auto" />
                <div>
                  <p className="text-xl font-display font-bold">Concluído!</p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-0.5">
                    <li><strong className="text-foreground">{importedCount}</strong> despesa(s) importada(s)</li>
                    {projectedCount > 0 && (
                      <li>+ <strong className="text-primary">{projectedCount}</strong> parcela(s) futura(s) projetada(s)</li>
                    )}
                    {mergedCount > 0 && (
                      <li>↺ <strong className="text-income">{mergedCount}</strong> parcela(s) reaproveitada(s) de projeção</li>
                    )}
                    {skippedDupCount > 0 && (
                      <li>⚠️ <strong className="text-warning">{skippedDupCount}</strong> duplicata(s) ignorada(s)</li>
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
                <div>
                  <p className="text-xl font-display font-bold">{importedCount} importadas, {errors.length} com erro</p>
                  <p className="text-sm text-muted-foreground mt-1 max-h-32 overflow-y-auto">{errors[0]}</p>
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
