import { useEffect, useMemo, useState } from 'react';
import { useTransactions } from './useTransactions';
import { useCardExpenses } from './useCardExpenses';
import { useCreditCards } from './useCreditCards';
import { useCardBills } from './useCardBills';
import { mergeCardExpensesAsTransactions } from '@/lib/cardIntegration';
import type { Transaction } from '@/lib/supabase';

const STORAGE_KEY = 'billcash.includeCardExpensesInReports';

/**
 * Hook global para ler/persistir o flag "Incluir despesas do cartão por categoria".
 * Quando true, as despesas confirmadas do cartão entram nos cálculos,
 * e as transações de "Pagamento Cartão" são removidas (evita dupla contagem).
 */
export function useIncludeCardExpensesFlag() {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(value));
      // Dispara evento para que outras instâncias do hook (em outras páginas)
      // se atualizem ao mudar em uma página.
      window.dispatchEvent(new CustomEvent('billcash:include-cards-changed', { detail: value }));
    }
  }, [value]);

  // Escuta mudanças vindas de outras páginas/instâncias
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') setValue(detail);
    };
    window.addEventListener('billcash:include-cards-changed', handler);
    return () => window.removeEventListener('billcash:include-cards-changed', handler);
  }, []);

  return [value, setValue] as const;
}

/**
 * Retorna a lista unificada de transações (bancárias + despesas do cartão
 * confirmadas) respeitando o flag global de inclusão.
 *
 * Use isto em vez de useTransactions() em qualquer tela que precisa do
 * fluxo completo (Dashboard, Insights, Transactions, charts etc.).
 */
export function useUnifiedTransactions(): {
  transactions: Transaction[];
  includeCardExpenses: boolean;
  setIncludeCardExpenses: (v: boolean) => void;
  isLoading: boolean;
} {
  const [includeCardExpenses, setIncludeCardExpenses] = useIncludeCardExpensesFlag();

  const { data: rawTransactions = [], isLoading: l1 } = useTransactions();
  const { data: cardExpenses    = [], isLoading: l2 } = useCardExpenses();
  const { data: cards           = [], isLoading: l3 } = useCreditCards();
  const { data: bills           = [], isLoading: l4 } = useCardBills();

  const transactions = useMemo(
    () => mergeCardExpensesAsTransactions(rawTransactions, cardExpenses, {
      includeCardExpenses,
      cards,
      bills,
    }),
    [rawTransactions, cardExpenses, cards, bills, includeCardExpenses],
  );

  return {
    transactions,
    includeCardExpenses,
    setIncludeCardExpenses,
    isLoading: l1 || l2 || l3 || l4,
  };
}
