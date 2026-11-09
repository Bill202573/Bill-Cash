import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type CreditCard } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useCreditCards() {
  const { scope, getFilterUserId } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();
  const filterUserId = getFilterUserId();

  return useQuery({
    queryKey: ['credit_cards', scope, filterUserId, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('credit_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      } else if (scope === 'family' && family?.members) {
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      const cards = (data ?? []) as CreditCard[];
      if (!cards.length) return cards;

      // current_bill (campo antigo) nunca foi mantido pela sincronizacao: o valor real a pagar vem das faturas
      // abertas/fechadas ainda nao quitadas (total - pago), para o painel, os cartoes e os alertas de limite
      const { data: bills } = await supabase
        .from('card_bills')
        .select('card_id,total_amount,paid_amount,status')
        .in('card_id', cards.map(c => c.id))
        .neq('status', 'reconciled');
      const owed = new Map<string, number>();
      for (const b of bills ?? []) {
        const v = Math.max(Number(b.total_amount ?? 0) - Number(b.paid_amount ?? 0), 0);
        owed.set(b.card_id, (owed.get(b.card_id) ?? 0) + v);
      }
      return cards.map(c => ({ ...c, current_bill: Math.round((owed.get(c.id) ?? 0) * 100) / 100 }));
    },
    enabled: !!user?.id,
  });
}

export function useAddCreditCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { getFilterUserId } = useFamilyScope();

  return useMutation({
    mutationFn: async (card: Omit<CreditCard, 'id' | 'created_at'>) => {
      const payload = {
        ...card,
        user_id: getFilterUserId() ?? user?.id,
      };
      const { data, error } = await supabase.from('credit_cards').insert([payload]).select().single();
      if (error) throw error;
      return data as CreditCard;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit_cards'] }),
  });
}

export function useUpdateCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreditCard> & { id: string }) => {
      const { data, error } = await supabase.from('credit_cards').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as CreditCard;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit_cards'] }),
  });
}

export function useDeleteCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('credit_cards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit_cards'] }),
  });
}
