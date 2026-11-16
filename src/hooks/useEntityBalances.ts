import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface EntityBalance { name: string; type: string; balance: number }

export async function fetchEntityBalances(entityId: string): Promise<EntityBalance[]> {
  const { data, error } = await supabase.rpc('entity_balances', { p_entity: entityId });
  if (error) throw error;
  return ((data ?? []) as { name: string; type: string; balance: number | string }[])
    .map(r => ({ name: r.name, type: r.type, balance: Number(r.balance) }));
}

/** Saldo vivo das contas de uma empresa (RPC entity_balances), para somar à Posição Atual da família quando o usuário quiser */
export function useEntityBalances(entityId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['entity_balances', entityId],
    enabled: enabled && !!entityId,
    queryFn: () => fetchEntityBalances(entityId!),
  });
}
