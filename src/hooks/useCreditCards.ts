import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type CreditCard } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useCreditCards() {
  const { scope } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();

  return useQuery({
    queryKey: ['credit_cards', scope, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('credit_cards')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtro por scope
      if (scope === 'personal') {
        query = query.eq('user_id', user.id);
      } else if (scope === 'family' && family?.members) {
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CreditCard[];
    },
    enabled: !!user?.id,
  });
}

export function useAddCreditCard() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (card: Omit<CreditCard, 'id' | 'created_at'>) => {
      const payload = {
        ...card,
        user_id: user?.id,
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
