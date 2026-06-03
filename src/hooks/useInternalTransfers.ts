import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface InternalTransfer {
  id:           string;
  from_account: string;
  to_account:   string;
  amount:       number;
  date:         string;         // YYYY-MM-DD
  description:  string;
  from_tx_id:   string | null;  // transaction id on origin side
  to_tx_id:     string | null;  // transaction id on destination side
  created_at?:  string;
}

export function useInternalTransfers() {
  return useQuery({
    queryKey: ['internal_transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_transfers')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InternalTransfer[];
    },
  });
}

export function useAddInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      from_account,
      to_account,
      amount,
      date,
      description,
      user,
    }: {
      from_account: string;
      to_account:   string;
      amount:       number;
      date:         string;
      description:  string;
      user:         string;
    }): Promise<InternalTransfer> => {
      const desc = description.trim() || `Transferência ${from_account} → ${to_account}`;

      // 1. Create outgoing transaction (origin account)
      const { data: fromTx, error: e1 } = await supabase
        .from('transactions')
        .insert([{
          description: `${desc} [saída]`,
          amount,
          type: 'transfer',
          category: 'Transferência Interna',
          date,
          account: from_account,
          user,
        }])
        .select()
        .single();
      if (e1) throw e1;

      // 2. Create incoming transaction (destination account)
      const { data: toTx, error: e2 } = await supabase
        .from('transactions')
        .insert([{
          description: `${desc} [entrada]`,
          amount,
          type: 'transfer',
          category: 'Transferência Interna',
          date,
          account: to_account,
          user,
        }])
        .select()
        .single();
      if (e2) throw e2;

      // 3. Link them in internal_transfers
      const { data, error: e3 } = await supabase
        .from('internal_transfers')
        .insert([{
          from_account,
          to_account,
          amount,
          date,
          description: desc,
          from_tx_id: fromTx.id,
          to_tx_id:   toTx.id,
        }])
        .select()
        .single();
      if (e3) throw e3;

      return data as InternalTransfer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['internal_transfers'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transfer: InternalTransfer) => {
      // Delete both linked transactions (cascade deletes the transfer record via trigger,
      // but we delete the transfer record first to avoid FK issues)
      const { error: e1 } = await supabase
        .from('internal_transfers')
        .delete()
        .eq('id', transfer.id);
      if (e1) throw e1;

      if (transfer.from_tx_id) {
        await supabase.from('transactions').delete().eq('id', transfer.from_tx_id);
      }
      if (transfer.to_tx_id) {
        await supabase.from('transactions').delete().eq('id', transfer.to_tx_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['internal_transfers'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// Auto-detect and link paired transactions as internal transfers
export function useAutoLinkTransfers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactions: any[]) => {
      // Find pairs: same date, same amount, different accounts
      const pairs: Array<{ expense: any; income: any }> = [];

      for (const exp of transactions.filter(t => t.type === 'expense')) {
        const paired = transactions.find(
          t => t.type === 'income' &&
               t.date === exp.date &&
               t.amount === exp.amount &&
               t.account !== exp.account
        );
        if (paired) {
          pairs.push({ expense: exp, income: paired });
        }
      }

      // For each pair, create internal transfer and delete originals
      const results = [];
      for (const { expense, income } of pairs) {
        const desc = expense.description || `Transferência ${expense.account} → ${income.account}`;

        // Create transfer (which creates both transactions)
        const { data: transfer, error } = await supabase
          .from('internal_transfers')
          .insert([{
            from_account: expense.account,
            to_account: income.account,
            amount: expense.amount,
            date: expense.date,
            description: desc,
          }])
          .select()
          .single();

        if (error) continue;

        // Delete original transactions
        await supabase.from('transactions').delete().eq('id', expense.id);
        await supabase.from('transactions').delete().eq('id', income.id);

        results.push(transfer);
      }

      return results;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['internal_transfers'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
