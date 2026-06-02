import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2 } from 'lucide-react';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import type { Transaction } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';

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
  const del = useDeleteTransaction();

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
      <div className="glass-card rounded-lg p-5 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-4">Transações Recentes</h3>
        <div className="space-y-0.5">
          {items.map(tx => {
            const parsed = parseDescription(tx.description);
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-md hover:bg-secondary/50 transition-colors group"
                title={parsed.bankDetail}
              >
                {/* Ícone */}
                <div className={`p-1.5 rounded-md flex-shrink-0 ${tx.type === 'income' ? 'bg-income/10' : 'bg-expense/10'}`}>
                  {tx.type === 'income'
                    ? <ArrowUpRight className="h-4 w-4 text-income" />
                    : <ArrowDownRight className="h-4 w-4 text-expense" />}
                </div>

                {/* Descrição em até 3 linhas */}
                <div className="flex-1 min-w-0">
                  {/* Linha 1: tipo de operação */}
                  <p className="text-sm font-medium truncate leading-snug">{parsed.type}</p>
                  {/* Linha 2: entidade (pagador/recebedor) */}
                  {parsed.entity && (
                    <p className="text-xs text-foreground/70 truncate leading-snug">{parsed.entity}</p>
                  )}
                  {/* Linha 3: categoria + subcategoria + pessoa */}
                  <p className="text-xs text-muted-foreground leading-snug">
                    {tx.category}
                    {tx.subcategory ? ` › ${tx.subcategory}` : ''}
                    {' · '}{tx.user_label}
                  </p>
                </div>

                {/* Valor + data */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDate(tx.date)}</p>
                </div>

                {/* Ações */}
                {showActions && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => setEditing(tx)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
    </>
  );
}
