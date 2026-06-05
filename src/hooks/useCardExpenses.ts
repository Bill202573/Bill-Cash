import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type CardExpense, type CardExpenseStatus } from '@/lib/supabase';
import {
  getBillMonthForPurchase,
  getClosingDateForBill,
  getDueDateForBill,
  splitIntoInstallments,
} from '@/lib/cardBills';
import { addMonthsToYYYYMM } from '@/lib/parcelas';

interface CardExpenseFilter {
  billId?:    string;
  cardId?:    string;
  status?:    CardExpenseStatus;
}

/** Lista despesas (filtros opcionais) */
export function useCardExpenses(filter: CardExpenseFilter = {}) {
  return useQuery({
    queryKey: ['card_expenses', filter],
    queryFn: async () => {
      let q = supabase.from('card_expenses').select('*').order('purchase_date', { ascending: false });
      if (filter.billId)  q = q.eq('bill_id', filter.billId);
      if (filter.cardId)  q = q.eq('card_id', filter.cardId);
      if (filter.status)  q = q.eq('status',  filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CardExpense[];
    },
  });
}

/**
 * Helper interno: garante que a fatura existe para um card_id + month_ref,
 * criando se necessário, e retorna o bill.id.
 */
async function ensureBill(
  cardId:     string,
  monthRef:   string,
  closingDay: number | undefined,
  dueDay:     number | undefined,
): Promise<string> {
  // Tenta encontrar
  const { data: existing } = await supabase
    .from('card_bills')
    .select('id')
    .eq('card_id', cardId)
    .eq('month_ref', monthRef)
    .maybeSingle();
  if (existing) return existing.id;

  // Cria nova
  const { data: newBill, error } = await supabase
    .from('card_bills')
    .insert([{
      card_id:      cardId,
      month_ref:    monthRef,
      closing_date: getClosingDateForBill(monthRef, closingDay),
      due_date:     getDueDateForBill(monthRef, dueDay),
      total_amount: 0,
      paid_amount:  0,
      status:       'open',
    }])
    .select('id')
    .single();
  if (error) throw error;
  return newBill.id;
}

/**
 * Adiciona uma despesa de cartão.
 *
 * Comportamento por modo:
 * - Se forceBillMonthRef for informado (caso da IMPORTAÇÃO de uma fatura
 *   completa do banco), TODAS as parcelas/despesas vão para esse mês.
 *   A primeira parcela usa esse mês, e as seguintes (se houver) avançam +1.
 *
 * - Sem forceBillMonthRef (lançamento MANUAL avulso), usa closingDay para
 *   decidir em qual fatura cai (compras após o fechamento vão para a próxima).
 */
export function useAddCardExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      closingDay,
      dueDay,
      description,
      amount,
      purchaseDate,
      category,
      subcategory,
      totalInstallments = 1,
      origin = 'manual',
      status = 'pending',
      notes,
      forceBillMonthRef,
    }: {
      cardId:             string;
      closingDay?:        number;
      dueDay?:            number;
      description:        string;
      amount:             number;
      purchaseDate:       string;
      category?:          string;
      subcategory?:       string;
      totalInstallments?: number;
      origin?:            'manual' | 'import';
      status?:            CardExpenseStatus;
      notes?:             string;
      forceBillMonthRef?: string;     // 'YYYY-MM' — força a fatura
    }) => {
      // Decide o mês de início da fatura
      const firstMonthRef =
        forceBillMonthRef ?? getBillMonthForPurchase(purchaseDate, closingDay);

      if (totalInstallments <= 1) {
        const billId = await ensureBill(cardId, firstMonthRef, closingDay, dueDay);
        const { data, error } = await supabase
          .from('card_expenses')
          .insert([{
            bill_id:            billId,
            card_id:            cardId,
            description,
            amount,
            purchase_date:      purchaseDate,
            category,
            subcategory,
            installment:        1,
            total_installments: 1,
            status,
            origin,
            notes,
          }])
          .select()
          .single();
        if (error) throw error;
        return [data as CardExpense];
      }

      // Parcelado: gera as N parcelas a partir do mês de início
      const [y, m] = firstMonthRef.split('-').map(Number);
      const installmentAmount = Math.round((amount / totalInstallments) * 100) / 100;
      const parts: Array<{ installment: number; monthRef: string; amount: number }> = [];
      for (let i = 0; i < totalInstallments; i++) {
        const monthsAhead = m - 1 + i;
        const year  = y + Math.floor(monthsAhead / 12);
        const month = (monthsAhead % 12) + 1;
        parts.push({
          installment: i + 1,
          monthRef:    `${year}-${String(month).padStart(2, '0')}`,
          amount:      installmentAmount,
        });
      }
      // Ajuste de centavos na última
      const distributed = installmentAmount * totalInstallments;
      const diff = Math.round((amount - distributed) * 100) / 100;
      if (diff !== 0) parts[parts.length - 1].amount += diff;

      const inserted: CardExpense[] = [];
      for (const p of parts) {
        const billId = await ensureBill(cardId, p.monthRef, closingDay, dueDay);
        const { data, error } = await supabase
          .from('card_expenses')
          .insert([{
            bill_id:            billId,
            card_id:            cardId,
            description:        `${description} (${p.installment}/${totalInstallments})`,
            amount:             p.amount,
            purchase_date:      purchaseDate,
            category,
            subcategory,
            installment:        p.installment,
            total_installments: totalInstallments,
            status,
            origin,
            notes,
          }])
          .select()
          .single();
        if (error) throw error;
        inserted.push(data as CardExpense);
      }
      return inserted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}

export function useUpdateCardExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CardExpense> & { id: string }) => {
      const { data, error } = await supabase
        .from('card_expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CardExpense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}

/** Atualiza várias despesas de uma vez (ex: "Confirmar todas") */
export function useBulkUpdateCardExpenses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<CardExpense> }) => {
      if (ids.length === 0) return 0;
      const { error } = await supabase
        .from('card_expenses')
        .update(updates)
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}

export function useDeleteCardExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('card_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}

/**
 * Projeta parcelas futuras de uma compra parcelada.
 *
 * Quando importamos a parcela X de Y (ex: 1/12) da fatura atual, esta função:
 *  - Gera (ou reutiliza) um purchase_group_id
 *  - Insere a parcela X na fatura atual (status=pending, origin=import)
 *  - Insere as parcelas (X+1)..Y nas faturas futuras (uma por mês),
 *    criando as faturas se ainda não existirem (status=pending)
 *
 * IMPORTANTE — anti-duplicação inteligente:
 *  Antes de inserir, verifica se já existe parcela com mesmo
 *  purchase_group_id e mesmo installment (caso a função seja chamada
 *  duas vezes). Se existir, ATUALIZA em vez de duplicar.
 */
export function useProjectInstallments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      closingDay,
      dueDay,
      currentBillMonthRef,
      baseDescription,
      installmentAmount,
      currentInstallment,
      totalInstallments,
      purchaseDate,
      category,
      subcategory,
      groupId,                    // opcional; gerado se ausente
    }: {
      cardId:              string;
      closingDay?:         number;
      dueDay?:             number;
      currentBillMonthRef: string;
      baseDescription:     string;
      installmentAmount:   number;
      currentInstallment:  number;
      totalInstallments:   number;
      purchaseDate:        string;
      category?:           string;
      subcategory?:        string;
      groupId?:            string;
    }) => {
      const purchaseGroupId = groupId ?? crypto.randomUUID();
      const inserted: CardExpense[] = [];

      // Gera as parcelas: currentInstallment até totalInstallments
      for (let i = currentInstallment; i <= totalInstallments; i++) {
        const offset = i - currentInstallment;
        const monthRef = addMonthsToYYYYMM(currentBillMonthRef, offset);
        const billId   = await ensureBill(cardId, monthRef, closingDay, dueDay);
        const description = `${baseDescription} (${i}/${totalInstallments})`;

        // Já existe esta parcela com o mesmo grupo? (segurança contra dupla chamada)
        const { data: existing } = await supabase
          .from('card_expenses')
          .select('*')
          .eq('card_id', cardId)
          .eq('purchase_group_id', purchaseGroupId)
          .eq('installment', i)
          .maybeSingle();

        if (existing) {
          // Atualiza para refletir os dados mais recentes (caso amount tenha mudado)
          const { data, error } = await supabase
            .from('card_expenses')
            .update({
              bill_id:     billId,
              amount:      installmentAmount,
              description,
              category,
              subcategory,
            })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          inserted.push(data as CardExpense);
          continue;
        }

        const { data, error } = await supabase
          .from('card_expenses')
          .insert([{
            bill_id:            billId,
            card_id:            cardId,
            description,
            amount:             installmentAmount,
            purchase_date:      purchaseDate,
            category,
            subcategory,
            installment:        i,
            total_installments: totalInstallments,
            // Parcela atual entra como 'pending' (triagem); futuras como 'pending'
            // também (mas o usuário vai marcá-las quando a fatura real chegar).
            status:             'pending',
            origin:             'import',
            purchase_group_id:  purchaseGroupId,
          }])
          .select()
          .single();
        if (error) throw error;
        inserted.push(data as CardExpense);
      }

      return { groupId: purchaseGroupId, expenses: inserted };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}

/**
 * Recalcula total_amount da fatura somando as despesas CONFIRMADAS.
 * Útil após mudar status de várias despesas.
 */
export function useRecalculateBillTotal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (billId: string) => {
      const { data: expenses, error: e1 } = await supabase
        .from('card_expenses')
        .select('amount, status')
        .eq('bill_id', billId);
      if (e1) throw e1;

      const total = (expenses ?? [])
        .filter(e => e.status === 'confirmed')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const { error: e2 } = await supabase
        .from('card_bills')
        .update({ total_amount: total })
        .eq('id', billId);
      if (e2) throw e2;

      return total;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card_bills'] });
    },
  });
}
