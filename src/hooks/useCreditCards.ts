import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type CreditCard } from '@/lib/supabase';

export function useCreditCards() {
  return useQuery({
    queryKey: ['credit_cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CreditCard[];
    },
  });
}

export function useAddCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: Omit<CreditCard, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('credit_cards').insert([card]).select().single();
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
