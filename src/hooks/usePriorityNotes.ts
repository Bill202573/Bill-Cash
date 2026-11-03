import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export type PriorityLevel = 'urgent' | 'important' | 'normal';

export interface PriorityNote {
  id: string;
  title: string;
  details: string | null;
  level: PriorityLevel;
  due_date: string | null;   // YYYY-MM-DD
  done: boolean;
  done_at: string | null;
  created_at: string;
}

/** Avisos pessoais: cada usuário vê só os próprios (RLS por user_id), independente do escopo família */
export function usePriorityNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['priority_notes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('priority_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriorityNote[];
    },
  });
}

export function useAddPriorityNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: { title: string; level: PriorityLevel; due_date: string | null }) => {
      const { error } = await supabase.from('priority_notes').insert([note]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priority_notes'] }),
  });
}

export function useUpdatePriorityNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PriorityNote> & { id: string }) => {
      const { error } = await supabase.from('priority_notes').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priority_notes'] }),
  });
}

export function useDeletePriorityNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('priority_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priority_notes'] }),
  });
}
