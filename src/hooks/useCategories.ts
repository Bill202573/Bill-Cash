import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  parent_id: string | null;
  created_at?: string;
}

export function useCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: ['categories', type ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('categories').select('*').order('name');
      if (type) {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .in('type', [type, 'both'])
          .order('name');
        if (error) throw error;
        return (data ?? []) as Category[];
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Omit<Category, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert([cat])
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

/** Conta quantas transações + despesas de cartão usam uma categoria */
export function useCategoryUsageCount(categoryName: string | undefined) {
  return useQuery({
    queryKey: ['category_usage', categoryName],
    queryFn: async () => {
      if (!categoryName) return { transactions: 0, cardExpenses: 0, total: 0 };
      const [txRes, ceRes] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category', categoryName),
        supabase.from('card_expenses').select('id', { count: 'exact', head: true }).eq('category', categoryName),
      ]);
      const transactions  = txRes.count ?? 0;
      const cardExpenses  = ceRes.count ?? 0;
      return { transactions, cardExpenses, total: transactions + cardExpenses };
    },
    enabled: !!categoryName,
  });
}
