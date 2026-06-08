import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type CardBill } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useFamily } from './useFamily';

/** Lista faturas (opcionalmente filtrada por cartão) */
export function useCardBills(cardId?: string) {
  const { scope } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();

  return useQuery({
    queryKey: ['card_bills', cardId ?? 'all', scope, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let q = supabase.from('card_bills').select('*').order('month_ref', { ascending: false });

      if (cardId) {
        q = q.eq('card_id', cardId);
      } else {
        // Filtro por scope
        if (scope === 'personal') {
          q = q.eq('user_id', user.id);
        } else if (scope === 'family' && family?.members) {
          const memberIds = family.members.map(m => m.user_id);
          q = q.in('user_id', memberIds);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CardBill[];
    },
    enabled: !!user?.id,
  });
}

/** Busca uma única fatura por id */
export function useCardBill(billId: string | undefined) {
  return useQuery({
    queryKey: ['card_bill', billId],
    queryFn: async () => {
      if (!billId) return null;
      const { data, error } = await supabase
        .from('card_bills')
        .select('*')
        .eq('id', billId)
        .maybeSingle();
      if (error) throw error;
      return data as CardBill | null;
    },
    enabled: !!billId,
  });
}

/** Cria/atualiza uma fatura (upsert por card_id + month_ref) */
export function useUpsertCardBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      bill: Omit<CardBill, 'id' | 'created_at'>,
    ): Promise<CardBill> => {
      const { data, error } = await supabase
        .from('card_bills')
        .upsert(bill, { onConflict: 'card_id,month_ref' })
        .select()
        .single();
      if (error) throw error;
      return data as CardBill;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}

export function useUpdateCardBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CardBill> & { id: string }) => {
      const { data, error } = await supabase
        .from('card_bills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CardBill;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['card_bills'] });
      qc.invalidateQueries({ queryKey: ['card_bill', vars.id] });
    },
  });
}

export function useDeleteCardBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete despesas vinculadas primeiro (FK é SET NULL, então não cascateia)
      await supabase.from('card_expenses').delete().eq('bill_id', id);
      // Depois deleta a fatura
      const { error } = await supabase.from('card_bills').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_bills'] });
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
    },
  });
}

/**
 * Reconcilia a fatura:
 *  - Atualiza status para 'reconciled'
 *  - Cria uma transaction de despesa na conta de pagamento do cartão
 *  - Linka payment_tx_id na fatura
 */
export function useReconcileCardBill() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bill,
      cardName,
      paidAmount,
      paymentAccount,
      paymentDate,
      user = 'Você',
    }: {
      bill:            CardBill;
      cardName:        string;
      paidAmount:      number;
      paymentAccount:  string;
      paymentDate:     string;     // YYYY-MM-DD
      user?:           string;
    }) => {
      // Pega o user diretamente do Supabase Auth no momento do insert
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Usuário não autenticado');

      // 1) Criar transação de débito na conta de pagamento
      const desc = `Pagamento fatura ${cardName} ${bill.month_ref}`;
      const { data: tx, error: e1 } = await supabase
        .from('transactions')
        .insert([{
          description: desc,
          amount:      paidAmount,
          type:        'expense',
          category:    'Pagamento Cartão',
          date:        paymentDate,
          account:     paymentAccount,
          user,
          user_id:     authUser.id,  // Usa o user_id real do auth
        }])
        .select()
        .single();
      if (e1) throw e1;

      // 2) Atualizar fatura
      const { data: updated, error: e2 } = await supabase
        .from('card_bills')
        .update({
          status:        'reconciled',
          paid_amount:   paidAmount,
          payment_tx_id: tx.id,
        })
        .eq('id', bill.id)
        .select()
        .single();
      if (e2) throw e2;

      return { bill: updated as CardBill, tx };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_bills'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/** Reverte a conciliação: deleta a transação de pagamento e volta status para 'closed' */
export function useUnreconcileCardBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bill: CardBill) => {
      if (bill.payment_tx_id) {
        await supabase.from('transactions').delete().eq('id', bill.payment_tx_id);
      }
      const { error } = await supabase
        .from('card_bills')
        .update({
          status:        'closed',
          paid_amount:   0,
          payment_tx_id: null,
        })
        .eq('id', bill.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_bills'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
