import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Pencil, Trash2, Undo2, CreditCard } from 'lucide-react';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { MarkAsTransferModal } from './MarkAsTransferModal';
import type { Transaction } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  transactions: Transaction[];
  limit?: number;
  showActions?: boolean;
}

const fmtDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

/** Converte "NOME EM CAPS" → "Nome Em Caps" */
function toTitleCase(str: string) {
  const keep = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'a', 'o', 'para']);
  return str
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || !keep.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

/**
 * Quebra descrições longas de extrato bancário em até 3 partes:
 * - tipo   : "Transferência Recebida"
 * - entity : "Djaleco Uniformes e Confecção"   (sem CNPJ/CPF)
 * - detail : banco/conta (reduzido, só em tooltip)
 */
function parseDescription(raw: string) {
  const parts = raw.split(' - ');
  if (parts.length === 1) return { type: raw, entity: undefined };

  const type   = parts[0].trim();
  let   entity = parts[1]?.trim() ?? '';

  // Remove CNPJ e CPF
  entity = entity
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '')
    .trim();

  // Aplica title case se estiver todo em maiúsculas
  if (entity === entity.toUpperCase()) entity = toTitleCase(entity);

  // Detalhe bancário extra (banco, agência, conta) — disponível no title
  const bankDetail = parts.slice(2).join(' - ').trim();

  return { type, entity: entity || undefined, bankDetail: bankDetail || undefined };
}

export default function TransactionList({ transactions, limit, showActions = true }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [marking, setMarking] = useState<Transaction | null>(null);
  const del = useDeleteTransaction();
  const qc = useQueryClient();

  const items = limit ? transactions.slice(0, limit) : transactions;

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta transação?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Transação excluída');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleUndoTransfer = async (tx: Transaction) => {
    if (!confirm('Reverter esta transferência? As duas transações voltarão a ser receita/despesa normais.')) return;
    try {
      // Find the linked pair in internal_transfers
      const { data: links, error: e0 } = await supabase
        .from('internal_transfers')
        .select('*')
        .or(`from_tx_id.eq.${tx.id},to_tx_id.eq.${tx.id}`)
        .limit(1);
      if (e0) throw e0;

      const link = links?.[0];
      if (!link) {
        // No link record found — just revert this single transaction
        const guessed = tx.account ? 'expense' : 'expense'; // fallback
        await supabase
          .from('transactions')
          .update({ type: guessed })
          .eq('id', tx.id);
        toast.warning('Vínculo não encontrado — apenas esta transação foi revertida.');
      } else {
        // Revert both: from_tx_id → expense, to_tx_id → income
        if (link.from_tx_id) {
          await supabase.from('transactions').update({ type: 'expense' }).eq('id', link.from_tx_id);
        }
        if (link.to_tx_id) {
          await supabase.from('transactions').update({ type: 'income' }).eq('id', link.to_tx_id);
        }
        // Delete the link record
        await supabase.from('internal_transfers').delete().eq('id', link.id);
        toast.success('Transferência revertida — transações voltaram a ser receita/despesa.');
      }

      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await qc.invalidateQueries({ queryKey: ['internal_transfers'] });
    } catch (err: any) {
      console.error('[UNDO TRANSFER ERROR]', err);
      toast.error('Erro ao reverter: ' + (err?.message ?? String(err)));
    }
  };

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-lg p-5 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-3">Transações Recentes</h3>
        <p className="text-sm text-muted-foreground">Nenhuma transação ainda. Adicione a primeira!</p>
      </div>
    );
  }

  return (
    <>
      <div className="glass-card rounded-lg p-4 lg:p-5 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-4">Transações Recentes</h3>
        <div className="space-y-2 lg:space-y-0.5">
          {items.map(tx => {
            const parsed = parseDescription(tx.description);
            // Despesas de cartão vêm com id prefixado "card-" pelo hook
            // useUnifiedTransactions. Elas não são editáveis aqui — devem ser
            // gerenciadas na página de Cartões.
            const isCardExpense = tx.id.startsWith('card-');
            return (
              <div
                key={tx.id}
                className={`flex items-start gap-3 py-3 lg:py-2.5 px-3 lg:px-2 rounded-lg lg:rounded-md hover:bg-secondary/50 transition-colors group ${
                  isCardExpense ? 'bg-primary/5' : 'border border-border/20'
                }`}
                title={isCardExpense ? 'Despesa de cartão (gerencie em Cartões)' : parsed.bankDetail}
              >
                {/* Ícone */}
                <div className={`p-2 lg:p-1.5 rounded-lg lg:rounded-md flex-shrink-0 ${
                  isCardExpense        ? 'bg-primary/10'
                : tx.type === 'income'  ? 'bg-income/10'
                : tx.type === 'expense' ? 'bg-expense/10'
                :                         'bg-primary/10'
                }`}>
                  {isCardExpense
                    ? <CreditCard className="h-4 w-4 text-primary" />
                  : tx.type === 'income'
                    ? <ArrowUpRight className="h-4 w-4 text-income" />
                  : tx.type === 'expense'
                    ? <ArrowDownRight className="h-4 w-4 text-expense" />
                    : <ArrowLeftRight className="h-4 w-4 text-primary" />}
                </div>

                {/* Descrição - flex-1 para ocupar espaço */}
                <div className="flex-1 min-w-0">
                  {/* Linha 1: tipo + valor + data */}
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{parsed.type}</p>
                    <p className={`text-sm font-semibold flex-shrink-0 ${
                      tx.type === 'income'  ? 'text-income'
                    : tx.type === 'expense' ? 'text-expense'
                    :                         'text-primary'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔ '}{fmt(tx.amount)}
                    </p>
                  </div>

                  {/* Linha 2: entidade */}
                  {parsed.entity && (
                    <p className="text-xs text-foreground/70 truncate mb-0.5">{parsed.entity}</p>
                  )}

                  {/* Linha 3: categoria + data */}
                  <p className="text-xs text-muted-foreground">
                    {tx.category}
                    {tx.subcategory ? ` › ${tx.subcategory}` : ''}
                    {' · '}{fmtDate(tx.date)} {' · '}{tx.user_label}
                  </p>
                </div>

                {/* Ações - sempre visíveis em mobile, hover em desktop */}
                {showActions && (
                  <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {isCardExpense ? (
                      <span
                        className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium whitespace-nowrap"
                        title="Edite/delete esta despesa em Cartões"
                      >
                        Cartão
                      </span>
                    ) : (
                      <>
                        {tx.type === 'transfer' ? (
                          <button
                            onClick={() => handleUndoTransfer(tx)}
                            className="p-1 rounded hover:bg-warning/10 text-muted-foreground hover:text-warning transition-colors"
                            title="Reverter transferência"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setMarking(tx)}
                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Marcar como transferência"
                          >
                            <ArrowLeftRight className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(tx)}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <TransactionForm open onClose={() => setEditing(null)} transaction={editing} />
      )}

      {marking && (
        <MarkAsTransferModal open onClose={() => setMarking(null)} source={marking} />
      )}
    </>
  );
}
