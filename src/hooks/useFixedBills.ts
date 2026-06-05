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
  competence_month?: string;     // YYYY-MM: mês a que a conta se refere (ex: janeiro)
  due_date?: string;             // YYYY-MM-DD: data real de vencimento (ex: quando você paga)
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
  year_month: string;            // 'YYYY-MM'
  /** Valor cobrado neste mês específico (pode variar mês a mês) */
  expected_amount?: number | null;
  /** Data real de vencimento neste mês (pode variar mês a mês) */
  due_date?: string | null;      // YYYY-MM-DD
  /** Valor pago. NULL se ainda não pago */
  paid_amount: number | null;
  /** Data do pagamento. NULL se ainda não pago */
  paid_date: string | null;      // YYYY-MM-DD
  transaction_id: string | null;
  notes: string | null;
  created_at?: string;
}

export type BillCellStatus = 'paid' | 'overdue' | 'pending' | 'future' | 'na';

/** Verifica se um registro representa um pagamento (paid_amount preenchido) */
export function isPaymentDone(p: FixedBillPayment | undefined): boolean {
  return !!p && p.paid_amount != null && p.paid_amount > 0;
}

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

  // Se já foi pago, retorna paid (independente do due_date)
  if (isPaymentDone(payment)) return 'paid';

  // Se há um registro em aberto (sem pagamento), o status é baseado no due_date dele
  if (payment && payment.due_date) {
    const due = new Date(payment.due_date + 'T12:00:00');
    return due > today ? 'pending' : 'overdue';
  }

  // Sem registro: usa lógica baseada no template (fallback)
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

/**
 * Salva uma instância mensal de uma conta fixa SEM marcar como paga.
 * Útil quando você quer cadastrar:
 *   - Valor cobrado este mês
 *   - Data real de vencimento deste mês
 * E só DEPOIS registrar o pagamento (ou deixar em aberto para o Dashboard).
 */
export function useSaveBillEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      bill_id: string;
      year_month: string;
      expected_amount: number | null;
      due_date: string | null;
      notes?: string | null;
    }) => {
      // Não sobrescreve paid_amount/paid_date se já existirem (preserva pagamento)
      const { data: existing } = await supabase
        .from('fixed_bill_payments')
        .select('*')
        .eq('bill_id', entry.bill_id)
        .eq('year_month', entry.year_month)
        .maybeSingle();

      const payload = {
        bill_id:         entry.bill_id,
        year_month:      entry.year_month,
        expected_amount: entry.expected_amount,
        due_date:        entry.due_date,
        paid_amount:     existing?.paid_amount ?? null,
        paid_date:       existing?.paid_date   ?? null,
        transaction_id:  existing?.transaction_id ?? null,
        notes:           entry.notes ?? existing?.notes ?? null,
      };

      const { data, error } = await supabase
        .from('fixed_bill_payments')
        .upsert([payload], { onConflict: 'bill_id,year_month' })
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
