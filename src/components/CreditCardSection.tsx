import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useDeleteCreditCard } from '@/hooks/useCreditCards';
import { CreditCardForm } from './CreditCardForm';
import type { CreditCard } from '@/lib/supabase';
import { fmt } from '@/lib/financial';
import { toast } from 'sonner';

const fmtDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

interface Props {
  cards: CreditCard[];
}

export default function CreditCardSection({ cards }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const del = useDeleteCreditCard();

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cartão?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Cartão removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <>
      <div className="glass-card rounded-lg p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">Cartões de Crédito</h3>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {cards.map(card => {
              const usagePct = card.credit_limit > 0
                ? (card.current_bill / card.credit_limit) * 100
                : 0;
              const barColor =
                usagePct > 80 ? 'hsl(var(--expense))' :
                usagePct > 50 ? 'hsl(var(--warning))' :
                'hsl(var(--primary))';

              return (
                <div
                  key={card.id}
                  className="p-4 rounded-lg bg-secondary/50 border border-border/30 group relative"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-sm">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.last_digits ? `•••• ${card.last_digits}` : 'Sem dígitos'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-warning">{fmt(card.current_bill)}</p>
                      <p className="text-xs text-muted-foreground">Vence {fmtDate(card.due_date)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(usagePct, 100)}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {usagePct.toFixed(0)}% do limite de {fmt(card.credit_limit)}
                  </p>

                  {/* Actions */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(card)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreditCardForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && <CreditCardForm open onClose={() => setEditing(null)} card={editing} />}
    </>
  );
}
