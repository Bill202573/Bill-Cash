import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Transaction } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

// Busca quantas transações têm o mesmo nome mas categoria diferente
export async function countSimilarTransactions(
  description: string,
  category: string,
  excludeId?: string,
): Promise<number> {
  let query = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .ilike('description', description)
    .neq('category', category);
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return count ?? 0;
}

// Atualiza a categoria de todas as transações com o mesmo nome
export function useBulkCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      description,
      category,
      excludeId,
    }: {
      description: string;
      category: string;
      excludeId?: string;
    }) => {
      let query = supabase
        .from('transactions')
        .update({ category })
        .ilike('description', description)
        .neq('category', category);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query.select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useTransactions() {
  const { scope } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();

  return useQuery({
    queryKey: ['transactions', scope, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('transactions')
        .select('*')
        .is('reconciliation_status', null)  // Apenas transações NÃO reconciliadas
        .order('date', { ascending: false });

      // Filtro por scope
      if (scope === 'personal') {
        // Mostra apenas transações do usuário atual
        query = query.eq('user_id', user.id);
      } else if (scope === 'family' && family?.members) {
        // Mostra transações de todos os membros da família
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!user?.id,
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
      // Pega o user diretamente do Supabase Auth no momento do insert
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Usuário não autenticado');

      const payload = {
        ...tx,
        user_id: user.id,  // Usa o user_id real do auth
      };
      const { data, error } = await supabase.from('transactions').insert([payload]).select().single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

// Calcula saldo ignorando transações reconciliadas
export function useTransactionsSummary() {
  const { scope } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();

  return useQuery({
    queryKey: ['transactions_summary', scope, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return { income: 0, expense: 0, transfer: 0, balance: 0 };

      let query = supabase
        .from('transactions')
        .select('type, amount')
        .or('reconciliation_status.is.null');  // Apenas transações não reconciliadas

      // Filtro por scope
      if (scope === 'personal') {
        query = query.eq('user_id', user.id);
      } else if (scope === 'family' && family?.members) {
        const memberIds = family.members.map(m => m.user_id);
        query = query.in('user_id', memberIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        income: 0,
        expense: 0,
        transfer: 0,
      };

      (data ?? []).forEach(tx => {
        if (tx.type === 'income') stats.income += tx.amount;
        else if (tx.type === 'expense') stats.expense += tx.amount;
        else if (tx.type === 'transfer') stats.transfer += tx.amount;
      });

      return {
        ...stats,
        balance: stats.income - stats.expense + stats.transfer,
      };
    },
    enabled: !!user?.id,
  });
}
