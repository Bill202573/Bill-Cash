import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Account } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export function useAccounts() {
  const { scope, getFilterUserId } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();
  const filterUserId = getFilterUserId();

  return useQuery({
    queryKey: ['accounts', scope, filterUserId, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (filterUserId) {
        // Pessoal, ou um membro específico da família selecionado
        query = query.eq('user_id', filterUserId);
      } else if (scope === 'family' && family?.members) {
        // Família agregada: todos os membros
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
  const { getFilterUserId } = useFamilyScope();

  return useMutation({
    mutationFn: async (account: Omit<Account, 'id' | 'created_at'>) => {
      const payload = {
        ...account,
        // Se um membro específico da família estiver selecionado no menu
        // (ex: "Késya"), o registro é criado em nome dele — permite
        // administrar os dados de outro membro sem precisar logar como ele.
        user_id: getFilterUserId() ?? user?.id,
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
