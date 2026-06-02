import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FixedBill {
  id: string;
  name: string;
  category: string;
  expected_amount: number | null;
  active_months: number[] | null; // null = todos os meses
  due_day: number;
  due_month_offset: number; // 0 = vence no mesmo mês, 1 = vence no mês seguinte (ex: Light)
  account: string | null;
  keywords: string[] | null;
  notes: string | null;
  active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface FixedBillPayment {
  id: string;
  bill_id: string;
  year_month: string;      // 'YYYY-MM'
  paid_amount: number;
  paid_date: string;       // 'YYYY-MM-DD'
  transaction_id: string | null;
  notes: string | null;
  created_at?: string;
}

export type BillCellStatus = 'paid' | 'overdue' | 'pending' | 'future' | 'na';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retorna true se a conta tem movimentação no mês dado */
export function billAppliesToMonth(bill: FixedBill, yearMonth: string): boolean {
  if (!bill.active) return false;
  if (bill.active_months === null || bill.active_months.length === 0) return true;
  const m = parseInt(yearMonth.slice(5), 10);
  return bill.active_months.includes(m);
}

export function getBillCellStatus(
  bill: FixedBill,
  payment: FixedBillPayment | undefined,
  yearMonth: string,
  today: Date,
): BillCellStatus {
  if (!billAppliesToMonth(bill, yearMonth)) return 'na';
  if (payment) return 'paid';

  const [y, mo] = yearMonth.split('-').map(Number);
  const todayY  = today.getFullYear();
  const todayM  = today.getMonth() + 1; // 1-based

  // Competência futura → ainda não cabe nem pagar
  if (y > todayY || (y === todayY && mo > todayM)) return 'future';

  // Data real de vencimento = competência + due_month_offset meses, dia due_day
  const offset  = bill.due_month_offset ?? 0;
  const dueDate = new Date(y, mo - 1 + offset, bill.due_day || 10);

  // Vencimento ainda não chegou → pendente
  if (dueDate > today) return 'pending';

  // Vencimento passou sem pagamento → atrasado
  return 'overdue';
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useFixedBills() {
  return useQuery({
    queryKey: ['fixed_bills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_bills')
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data ?? []) as FixedBill[];
    },
  });
}

export function useFixedBillPayments(year: number) {
  return useQuery({
    queryKey: ['fixed_bill_payments', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_bill_payments')
        .select('*')
        .gte('year_month', `${year}-01`)
        .lte('year_month', `${year}-12`);
      if (error) throw error;
      return (data ?? []) as FixedBillPayment[];
    },
  });
}

export function useAddFixedBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bill: Omit<FixedBill, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('fixed_bills').insert([bill]).select().single();
      if (error) throw error;
      return data as FixedBill;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed_bills'] }),
  });
}

export function useUpdateFixedBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FixedBill> & { id: string }) => {
      const { data, error } = await supabase.from('fixed_bills').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as FixedBill;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed_bills'] }),
  });
}

export function useDeleteFixedBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fixed_bills').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed_bills'] }),
  });
}

export function useMarkBillPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: Omit<FixedBillPayment, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('fixed_bill_payments')
        .upsert([payment], { onConflict: 'bill_id,year_month' })
        .select()
        .single();
      if (error) throw error;
      return data as FixedBillPayment;
    },
    onSuccess: (_, vars) => {
      const year = parseInt(vars.year_month.slice(0, 4), 10);
      qc.invalidateQueries({ queryKey: ['fixed_bill_payments', year] });
    },
  });
}

export function useMarkBillUnpaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bill_id, year_month }: { bill_id: string; year_month: string }) => {
      const { error } = await supabase
        .from('fixed_bill_payments')
        .delete()
        .eq('bill_id', bill_id)
        .eq('year_month', year_month);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const year = parseInt(vars.year_month.slice(0, 4), 10);
      qc.invalidateQueries({ queryKey: ['fixed_bill_payments', year] });
    },
  });
}
