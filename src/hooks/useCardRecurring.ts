import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

/**
 * Cobrança mensal recorrente no cartão (ex.: consórcio Bancorbras R$ 350).
 * É só PROJEÇÃO para a tela Contas a Pagar: nunca é gravada como compra da fatura, então a sincronização
 * com o banco continua batendo; quando a compra real aparece na fatura, a projeção some sozinha.
 */
export interface CardRecurring {
  id: string;
  user_id: string | null;
  card_id: string;
  description: string;
  keyword: string;
  amount: number;
  category: string | null;
  active: boolean;
  active_since: string | null; // YYYY-MM (mês de vencimento da 1ª fatura)
  active_until: string | null;
  notes: string | null;
}

export function useCardRecurring() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['card_recurring', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('card_recurring').select('*').order('created_at');
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, amount: Number(r.amount) })) as CardRecurring[];
    },
  });
}

export function useAddCardRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Omit<CardRecurring, 'id' | 'active'> & { active?: boolean }) => {
      const { error } = await supabase.from('card_recurring').insert([{ ...r, active: r.active ?? true }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card_recurring'] }),
  });
}

export function useDeleteCardRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('card_recurring').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card_recurring'] }),
  });
}
