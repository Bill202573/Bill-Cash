import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CreditCard as CardIcon, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCardBills } from '@/hooks/useCardBills';
import { CreditCardForm } from '@/components/CreditCardForm';
import { fmt } from '@/lib/financial';
import { BILL_STATUS_LABEL, BILL_STATUS_COLOR } from '@/lib/cardBills';
import type { CreditCard } from '@/lib/supabase';

export default function Cards() {
  const { data: cards = [], isLoading } = useCreditCards();
  const { data: allBills = [] } = useCardBills();
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<CreditCard | null>(null);

  const cardsToShow = cards.filter(c => c.active !== false);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Cartões de Crédito</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie cartões, faturas e despesas
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Cartão</span>
        </Button>
      </div>

      {/* Lista de cartões */}
      {isLoading ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">
          Carregando...
        </div>
      ) : cardsToShow.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <CardIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">Nenhum cartão cadastrado ainda</p>
          <p className="text-sm text-muted-foreground mb-4">
            Cadastre seus cartões para começar a controlar faturas e despesas
          </p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Cadastrar primeiro cartão
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cardsToShow.map(card => {
            const cardBills    = allBills.filter(b => b.card_id === card.id);
            const openBill     = cardBills.find(b => b.status === 'open' || b.status === 'closed');
            const lastBill     = cardBills[0]; // já vem ordenado por month_ref desc
            const usedPercent  = card.credit_limit > 0
              ? Math.min(100, (card.current_bill / card.credit_limit) * 100)
              : 0;

            return (
              <div key={card.id} className="glass-card rounded-xl overflow-hidden">
                {/* Card visual (gradient header) */}
                <div className={`bg-gradient-to-br ${card.color} p-5 text-white`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">{card.name}</p>
                      {card.last_digits && (
                        <p className="text-xs opacity-75 mt-0.5">**** {card.last_digits}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditing(card)}
                      className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                      title="Editar cartão"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs opacity-75">Fatura atual</p>
                    <p className="text-2xl font-display font-bold">{fmt(card.current_bill)}</p>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs opacity-90 mb-1">
                      <span>Limite</span>
                      <span>{fmt(card.credit_limit)}</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card details + last bill */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Fechamento</p>
                      <p className="font-medium">
                        {card.closing_day ? `Dia ${card.closing_day}` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vencimento</p>
                      <p className="font-medium">
                        {card.due_day ? `Dia ${card.due_day}` : '—'}
                      </p>
                    </div>
                  </div>

                  {card.payment_account && (
                    <div className="text-xs">
                      <p className="text-muted-foreground">Pago via</p>
                      <p className="font-medium">{card.payment_account}</p>
                    </div>
                  )}

                  {/* Última fatura */}
                  {lastBill && (
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Última fatura</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILL_STATUS_COLOR[lastBill.status]}`}>
                          {BILL_STATUS_LABEL[lastBill.status]}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-medium">{lastBill.month_ref}</p>
                        <p className="text-sm font-semibold">{fmt(lastBill.total_amount)}</p>
                      </div>
                    </div>
                  )}

                  {/* Aviso de configuração incompleta */}
                  {(!card.closing_day || !card.due_day || !card.payment_account) && (
                    <div className="text-xs bg-warning/10 text-warning rounded p-2">
                      ⚠️ Complete o cadastro: dia de fechamento, vencimento e conta de pagamento são necessários para usar faturas.
                    </div>
                  )}

                  {/* Ações */}
                  <Link
                    to={`/cartoes/${card.id}`}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                  >
                    <span>Ver faturas {cardBills.length > 0 && `(${cardBills.length})`}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cartões inativos */}
      {cards.filter(c => c.active === false).length > 0 && (
        <details className="mt-6 glass-card rounded-lg p-4">
          <summary className="text-sm text-muted-foreground cursor-pointer">
            Cartões inativos ({cards.filter(c => c.active === false).length})
          </summary>
          <div className="mt-3 space-y-2">
            {cards.filter(c => c.active === false).map(card => (
              <div key={card.id} className="flex items-center justify-between text-sm opacity-60">
                <span>{card.name}</span>
                <button
                  onClick={() => setEditing(card)}
                  className="text-xs text-primary hover:underline"
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Forms */}
      <CreditCardForm open={showForm} onClose={() => setShowForm(false)} />
      {editing && (
        <CreditCardForm open onClose={() => setEditing(null)} card={editing} />
      )}
    </div>
  );
}
