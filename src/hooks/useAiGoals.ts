import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface AiGoal {
  id:             string;
  title:          string;
  description:    string | null;
  type:           'debt_payoff' | 'savings' | 'tax_payment' | 'investment' | 'custom';
  target_amount:  number | null;
  current_amount: number;
  target_date:    string | null;
  status:         'active' | 'paused' | 'completed' | 'cancelled';
  priority:       number;
  metadata:       Record<string, unknown>;
  created_at:     string;
  updated_at:     string;
}

export const GOAL_TYPE_LABELS: Record<AiGoal['type'], string> = {
  debt_payoff:  'Quitar Dívida',
  savings:      'Poupança',
  tax_payment:  'Pagamento de Imposto',
  investment:   'Investimento',
  custom:       'Personalizado',
};

export const GOAL_TYPE_ICONS: Record<AiGoal['type'], string> = {
  debt_payoff:  '🧾',
  savings:      '🐷',
  tax_payment:  '📋',
  investment:   '📈',
  custom:       '🎯',
};

export function useAiGoals(status?: AiGoal['status']) {
  return useQuery({
    queryKey: ['ai_goals', status],
    queryFn: async () => {
      let q = supabase.from('ai_goals').select('*').order('priority').order('created_at');
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AiGoal[];
    },
  });
}

export function useAddAiGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Omit<AiGoal, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('ai_goals')
        .insert([{ ...goal, updated_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      return data as AiGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai_goals'] }),
  });
}

export function useUpdateAiGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AiGoal> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AiGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai_goals'] }),
  });
}

export function useDeleteAiGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai_goals'] }),
  });
}
