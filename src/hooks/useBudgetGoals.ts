import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type BudgetGoal } from '@/lib/supabase';

export function useBudgetGoals() {
  return useQuery({
    queryKey: ['budget_goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_goals')
        .select('*')
        .order('category');
      if (error) throw error;
      return (data ?? []) as BudgetGoal[];
    },
  });
}

export function useUpsertBudgetGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Omit<BudgetGoal, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('budget_goals')
        .upsert([goal], { onConflict: 'category,month' })
        .select()
        .single();
      if (error) throw error;
      return data as BudgetGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget_goals'] }),
  });
}

export function useDeleteBudgetGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget_goals'] }),
  });
}
