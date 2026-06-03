import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ImportRecord {
  id:          string;
  account:     string;
  file_name:   string;
  month:       string;   // YYYY-MM
  total_rows:  number;
  saved_rows:  number;
  created_at:  string;
}

export function useImportHistory() {
  return useQuery({
    queryKey: ['import_history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ImportRecord[];
    },
  });
}

export function useAddImportRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<ImportRecord, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('import_history')
        .insert([record])
        .select()
        .single();
      if (error) throw error;
      return data as ImportRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['import_history'] }),
  });
}
