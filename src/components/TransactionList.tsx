import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Pencil, Trash2, Undo2, CreditCard, MoreVertical, StickyNote } from 'lucide-react';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { useFamily } from '@/hooks/useFamily';
import { TransactionForm } from './TransactionForm';
import { MarkAsTransferModal } from './MarkAsTransferModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Transaction } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { getFriendlyName } from '@/lib/importParser';
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
  // Sem separador: a descrição inteira já É o nome da contraparte (varia conforme
  // o extrato do banco trouxe ou não o prefixo "Pagamento de boleto efetuado" etc.)
  if (parts.length === 1) {
    const bare = raw === raw.toUpperCase() ? toTitleCase(raw) : raw;
    return { type: undefined, entity: bare };
  }

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

  // Sem contraparte identificável (ex: "Débito em conta", "Pagamento de fatura"):
  // usa o próprio tipo como nome principal em vez de deixar em branco
  return { type: entity ? type : undefined, entity: entity || type, bankDetail: bankDetail || undefined };
}

/** Paleta estável por pessoa — atribuída por posição (ordenada), garante cores
 *  distintas entre os membros da família em vez de depender de hash (que pode
 *  colidir para duas pessoas quaisquer). */
const MEMBER_COLORS = [
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
];

export default function TransactionList({ transactions, limit, showActions = true }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [marking, setMarking] = useState<Transaction | null>(null);
  const del = useDeleteTransaction();
  const qc = useQueryClient();
  const { data: family } = useFamily();

  // Mapa user_id -> {name, initial, color} — fonte confiável (a coluna "user" é
  // texto livre e inconsistente, ex: "Você" vs "William" para a mesma pessoa)
  const memberById = useMemo(() => {
    const m = new Map<string, { name: string; initial: string; color: string }>();
    const sorted = [...(family?.members ?? [])].sort((a, b) => a.user_id.localeCompare(b.user_id));
    sorted.forEach((mem, i) => {
      const name = mem.full_name?.trim() || mem.email?.split('@')[0] || 'Membro';
      m.set(mem.user_id, {
        name: name.split(' ')[0],
        initial: name[0]?.toUpperCase() ?? '?',
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      });
    });
    return m;
  }, [family]);

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
            const displayName = getFriendlyName(tx.description) ?? parsed.entity;
            // Despesas de cartão vêm com id prefixado "card-" pelo hook
            // useUnifiedTransactions. Elas não são editáveis aqui — devem ser
            // gerenciadas na página de Cartões.
            const isCardExpense = tx.id.startsWith('card-');
            const who = tx.user_id ? memberById.get(tx.user_id) : undefined;
            return (
              <div
                key={tx.id}
                className={`flex items-start gap-3 py-3 lg:py-2.5 px-3 lg:px-2 rounded-lg lg:rounded-md hover:bg-secondary/50 transition-colors group ${
                  isCardExpense ? 'bg-primary/5' : 'border border-border/20'
                }`}
                title={isCardExpense ? 'Despesa de cartão (gerencie em Cartões)' : parsed.bankDetail}
              >
                {/* Ícone + selo de quem fez a movimentação */}
                <div className="relative flex-shrink-0">
                  <div className={`p-2 lg:p-1.5 rounded-lg lg:rounded-md ${
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
                  {who && (
                    <span
                      title={who.name}
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-background ${who.color}`}
                    >
                      {who.initial}
                    </span>
                  )}
                </div>

                {/* Descrição - flex-1 para ocupar espaço */}
                <div className="flex-1 min-w-0">
                  {/* Linha 1: contraparte + valor + data */}
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className={`text-sm font-semibold flex-shrink-0 ${
                      tx.type === 'income'  ? 'text-income'
                    : tx.type === 'expense' ? 'text-expense'
                    :                         'text-primary'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔ '}{fmt(tx.amount)}
                    </p>
                  </div>

                  {/* Linha 2: tipo (Pix, boleto, débito...) */}
                  {parsed.type && (
                    <p className="text-xs text-foreground/70 truncate mb-0.5">{parsed.type}</p>
                  )}

                  {/* Linha 3: categoria + data */}
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="truncate">
                      {tx.category}
                      {tx.subcategory ? ` › ${tx.subcategory}` : ''}
                      {' · '}{fmtDate(tx.date)}
                      {who ? ` · ${who.name}` : ''}
                    </span>
                    {tx.notes && (
                      <StickyNote
                        className="h-3 w-3 text-primary flex-shrink-0"
                        title={tx.notes}
                      />
                    )}
                  </p>
                </div>

                {/* Ações - dropdown menu limpo */}
                {showActions && (
                  <div className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {isCardExpense ? (
                      <span
                        className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium whitespace-nowrap"
                        title="Edite/delete esta despesa em Cartões"
                      >
                        Cartão
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Ações"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditing(tx)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            <span>Editar</span>
                          </DropdownMenuItem>

                          {tx.type === 'transfer' ? (
                            <DropdownMenuItem onClick={() => handleUndoTransfer(tx)}>
                              <Undo2 className="h-4 w-4 mr-2 text-warning" />
                              <span>Reverter Transferência</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setMarking(tx)}>
                              <ArrowLeftRight className="h-4 w-4 mr-2" />
                              <span>Marcar como Transferência</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => handleDelete(tx.id)}
                            className="text-expense hover:text-expense hover:bg-expense/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Deletar</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
