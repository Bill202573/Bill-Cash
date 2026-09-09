import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type LifeGoal } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useLifeGoals() {
  const { scope, getFilterUserId } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();
  const filterUserId = getFilterUserId();

  return useQuery({
    queryKey: ['life_goals', scope, filterUserId, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('life_goals')
        .select('*')
        .order('target_date', { ascending: true, nullsFirst: false });

      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      } else if (scope === 'family' && family?.members) {
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LifeGoal[];
    },
    enabled: !!user?.id,
  });
}

export function useAddLifeGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { getFilterUserId } = useFamilyScope();

  return useMutation({
    mutationFn: async (goal: Omit<LifeGoal, 'id' | 'created_at'>) => {
      const payload = { ...goal, user_id: getFilterUserId() ?? user?.id };
      const { data, error } = await supabase.from('life_goals').insert([payload]).select().single();
      if (error) throw error;
      return data as LifeGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['life_goals'] }),
  });
}

export function useUpdateLifeGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LifeGoal> & { id: string }) => {
      const { data, error } = await supabase.from('life_goals').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as LifeGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['life_goals'] }),
  });
}

export function useDeleteLifeGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('life_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['life_goals'] }),
  });
}
