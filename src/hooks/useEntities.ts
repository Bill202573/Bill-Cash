import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

/** Perfil de empresa (ex.: PJ Stelle Odontologia): dados separados da família */
export interface Entity {
  id: string;
  name: string;
  kind: string;
  owner_user_id: string;
}

export function useEntities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['entities', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('entities').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Entity[];
    },
  });
}
