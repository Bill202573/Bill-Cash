import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Debt } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useDebts() {
  const { scope, getFilterUserId } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();
  const filterUserId = getFilterUserId();

  return useQuery({
    queryKey: ['debts', scope, filterUserId, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('debts')
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
      return (data ?? []) as Debt[];
    },
    enabled: !!user?.id,
  });
}

export function useAddDebt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { getFilterUserId } = useFamilyScope();
  return useMutation({
    mutationFn: async (debt: Omit<Debt, 'id' | 'created_at'>) => {
      const payload = { ...debt, user_id: debt.user_id ?? getFilterUserId() ?? user?.id };
      const { data, error } = await supabase.from('debts').insert([payload]).select().single();
      if (error) throw error;
      return data as Debt;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Debt> & { id: string }) => {
      const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Debt;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}
