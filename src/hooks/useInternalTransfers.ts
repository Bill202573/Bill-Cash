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
