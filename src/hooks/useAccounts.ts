import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Account } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useAccounts() {
  const { scope } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();

  return useQuery({
    queryKey: ['accounts', scope, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      // Filtro por scope
      if (scope === 'personal') {
        // Mostra apenas contas do usuário atual
        query = query.eq('user_id', user.id);
      } else if (scope === 'family' && family?.members) {
        // Mostra contas de todos os membros da família
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    enabled: !!user?.id,
  });
}

export function useAddAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (account: Omit<Account, 'id' | 'created_at'>) => {
      const payload = {
        ...account,
        user_id: user?.id,  // Adiciona automaticamente o user_id
      };
      const { data, error } = await supabase.from('accounts').insert([payload]).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
