import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Investment } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useInvestments() {
  const { scope, getFilterUserId } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();
  const filterUserId = getFilterUserId();

  return useQuery({
    queryKey: ['investments', scope, filterUserId, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('investments')
        .select('*')
        .order('current_balance', { ascending: false });

      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      } else if (scope === 'family' && family?.members) {
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Investment[];
    },
    enabled: !!user?.id,
  });
}

export function useAddInvestment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { getFilterUserId } = useFamilyScope();

  return useMutation({
    mutationFn: async (investment: Omit<Investment, 'id' | 'created_at'>) => {
      const payload = { ...investment, user_id: getFilterUserId() ?? user?.id };
      const { data, error } = await supabase.from('investments').insert([payload]).select().single();
      if (error) throw error;
      return data as Investment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Investment> & { id: string }) => {
      const { data, error } = await supabase.from('investments').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Investment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  });
}
