import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/useTransactions';
import { fmt } from '@/lib/financial';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type Transaction } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onClose: () => void;
  source: Transaction;
}

const fmtDate = (s: string) =>
  new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Differences in days between two YYYY-MM-DD dates */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.abs(Math.round((da - db) / (1000 * 60 * 60 * 24)));
}

export function MarkAsTransferModal({ open, onClose, source }: Props) {
  const qc = useQueryClient();
  const { data: allTransactions = [] } = useTransactions();
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Find candidate pair transactions: same amount, different account, opposite type, date within ±3 days
  const candidates = useMemo(() => {
    if (!source) return [];
    // What we're looking for is the COUNTERPART:
    //   - If source is 'expense' (money out), we need 'income' (money in) in another account
    //   - If source is 'income', we need 'expense'
    //   - If source is already 'transfer', we need another 'transfer' (couldn't be linked yet)
    const oppositeType =
      source.type === 'expense' ? 'income' :
      source.type === 'income'  ? 'expense' :
      'transfer';

    return allTransactions
      .filter(t =>
        t.id !== source.id &&
        t.type === oppositeType &&
        t.amount === source.amount &&
        t.account !== source.account &&
        daysBetween(t.date, source.date) <= 3,
      )
      .sort((a, b) => daysBetween(a.date, source.date) - daysBetween(b.date, source.date));
  }, [allTransactions, source]);

  const selectedPair = candidates.find(c => c.id === selectedPairId) ?? null;

  // Determine which is the origin (expense / saída) and destination (income / entrada)
  const { fromTx, toTx } = useMemo(() => {
    if (!selectedPair) return { fromTx: null, toTx: null };
    if (source.type === 'expense') return { fromTx: source, toTx: selectedPair };
    if (source.type === 'income')  return { fromTx: selectedPair, toTx: source };
    // If source already transfer, fall back to source as origin
    return { fromTx: source, toTx: selectedPair };
  }, [source, selectedPair]);

  const handleConfirm = async () => {
    if (!selectedPair || !fromTx || !toTx) {
      toast.error('Selecione uma transação correspondente');
      return;
    }

    setWorking(true);
    try {
      // 1) Update both transactions: type = 'transfer'. Category is left as-is (user can edit later).
      const { error: e1 } = await supabase
        .from('transactions')
        .update({ type: 'transfer' })
        .in('id', [fromTx.id, toTx.id]);
      if (e1) throw e1;

      // 2) Link in internal_transfers (use the original transaction ids to preserve history)
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

      // Refresh data
      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await qc.invalidateQueries({ queryKey: ['internal_transfers'] });

      toast.success(`Transferência marcada: ${fromTx.account} → ${toTx.account}`);
      setSelectedPairId(null);
      onClose();
    } catch (err: any) {
      console.error('[MARK TRANSFER ERROR]', err);
      toast.error('Erro ao marcar transferência: ' + (err?.message ?? String(err)));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Marcar como Transferência Interna
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source transaction */}
          <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
            <p className="text-xs text-muted-foreground mb-1">Transação selecionada</p>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtDate(source.date)} • <strong>{source.account}</strong> • {source.category}
                </p>
              </div>
              <p className={`text-sm font-semibold ml-3 ${
                source.type === 'income'  ? 'text-income'
              : source.type === 'expense' ? 'text-expense'
              :                              'text-muted-foreground'
              }`}>
                {source.type === 'income' ? '+' : source.type === 'expense' ? '-' : ''}{fmt(source.amount)}
              </p>
            </div>
          </div>

          {/* Candidates */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              {candidates.length === 0
                ? '⚠️ Nenhuma transação correspondente encontrada (mesmo valor, conta diferente, data até 3 dias).'
                : `${candidates.length} transação(ões) candidata(s) — selecione o par correto:`}
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {candidates.map(c => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPairId === c.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/40 hover:bg-secondary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pair"
                    checked={selectedPairId === c.id}
                    onChange={() => setSelectedPairId(c.id)}
                    className="accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(c.date)} • <strong>{c.account}</strong> • {c.category}
                      {daysBetween(c.date, source.date) > 0 && (
                        <span className="ml-1 text-warning">
                          ({daysBetween(c.date, source.date)} dia(s) de diferença)
                        </span>
                      )}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${
                    c.type === 'income' ? 'text-income' : 'text-expense'
                  }`}>
                    {c.type === 'income' ? '+' : '-'}{fmt(c.amount)}
                  </p>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selectedPair && fromTx && toTx && (
            <div className="bg-secondary/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">Confirmar transferência:</p>
              <div className="flex items-center justify-center gap-3 text-sm">
                <span className="font-medium">{fromTx.account}</span>
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="font-medium">{toTx.account}</span>
                <span className="ml-2 font-semibold">{fmt(fromTx.amount)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Ambas serão reclassificadas como <strong>transferência</strong> e deixarão de contar nos totais de receitas/despesas.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleConfirm}
              disabled={!selectedPair || working}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {working ? 'Marcando…' : 'Confirmar Transferência'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
