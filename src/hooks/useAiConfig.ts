import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useAiConfig(key: string) {
  return useQuery({
    queryKey: ['ai_config', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('value')
        .eq('key', key)
        .single();
      if (error) throw error;
      return data?.value as string;
    },
  });
}

export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('ai_config')
        .upsert([{ key, value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: (_, { key }) => qc.invalidateQueries({ queryKey: ['ai_config', key] }),
  });
}
