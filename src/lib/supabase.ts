import { createClient } from '@supabase/supabase-js';

// Supabase anon key is a PUBLIC key — safe to have in client-side code.
// RLS policies on the database protect sensitive data.
const supabaseUrl     = 'https://jzonnecthimbvdeutsft.supabase.co';
const supabaseAnonKey = 'sb_publishable_GFCKtO3G2YwiweQ3S5mKaQ_Dioakamh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Transaction {
  id:           string;
  description:  string;
  amount:       number;
  type:         'income' | 'expense' | 'transfer';
  category:     string;
  subcategory?: string;
  date:         string;       // YYYY-MM-DD
  account:      string;
  user:         string;
  notes?:       string;
  created_at?:  string;
}

export interface CreditCard {
  id:               string;
  name:             string;
  last_digits:      string;
  current_bill:     number;
  credit_limit:     number;
  due_date:         string;
  color:            string;
  closing_day?:     number;        // dia do mês em que a fatura fecha (1-31)
  due_day?:         number;        // dia do mês de vencimento (1-31)
  payment_account?: string;        // nome da conta usada para pagar (FK por nome, como nas transactions)
  active?:          boolean;
  created_at?:      string;
}

// ─── Cartão: Fatura mensal ────────────────────────────────────────────────────
export type CardBillStatus = 'open' | 'closed' | 'paid' | 'reconciled';

export interface CardBill {
  id:             string;
  card_id:        string;
  month_ref:      string;          // 'YYYY-MM'
  closing_date?:  string;          // YYYY-MM-DD
  due_date?:      string;          // YYYY-MM-DD
  total_amount:   number;          // soma das despesas confirmadas
  paid_amount:    number;          // valor efetivamente pago
  payment_tx_id?: string | null;   // FK -> transactions.id (quando paga)
  status:         CardBillStatus;
  notes?:         string;
  created_at?:    string;
}

// ─── Cartão: Despesa individual (linha da fatura) ─────────────────────────────
export type CardExpenseStatus = 'pending' | 'confirmed' | 'refunded';
export type CardExpenseOrigin = 'manual' | 'import';

export interface CardExpense {
  id:                 string;
  bill_id?:           string | null;
  card_id:            string;
  description:        string;
  amount:             number;
  purchase_date:      string;      // YYYY-MM-DD
  category?:          string;
  subcategory?:       string;
  installment:        number;      // 1 = à vista, ou número da parcela atual
  total_installments: number;      // 1 = à vista, ou total de parcelas
  status:             CardExpenseStatus;
  origin:             CardExpenseOrigin;
  notes?:             string;
  /** Mesmo uuid em todas as parcelas de uma mesma compra (12x do iPhone, etc.) */
  purchase_group_id?: string | null;
  created_at?:        string;
}

export type AccountType = 'checking' | 'savings' | 'investment' | 'wallet';

export interface Account {
  id:                    string;
  name:                  string;
  bank:                  string;
  type:                  AccountType;
  balance:               number;     // legado — mantido para compat. O saldo "vivo" é calculado.
  owner:                 string;
  color:                 string;
  /** Saldo inicial: ponto de partida para o cálculo dinâmico */
  initial_balance?:      number;
  /** Data do saldo inicial. Transações ANTES desta data são ignoradas no cálculo */
  initial_balance_date?: string;     // YYYY-MM-DD
  created_at?:           string;
}

export type DebtType = 'credit_card' | 'personal_loan' | 'financing' | 'overdraft' | 'other';

export interface Debt {
  id:              string;
  name:            string;
  type:            DebtType;
  total_amount:    number;
  remaining:       number;
  interest_rate:   number;
  monthly_payment: number;
  due_date?:       string;
  notes?:          string;
  created_at?:     string;
}

export interface BudgetGoal {
  id:       string;
  category: string;
  month:    string;   // YYYY-MM
  limit:    number;
  created_at?: string;
}

export type FixedBillType = 'utility' | 'tax' | 'subscription' | 'insurance' | 'other';

export interface FixedBill {
  id:                 string;
  name:               string;
  amount:             number;
  category?:          string;
  /** Tipo de conta: contas fixas (utilidades) vs impostos vs outros */
  bill_type?:         FixedBillType;  // default: 'utility'
  /** Mês a que a conta se refere (ex: Janeiro) */
  competence_month?:  string;     // YYYY-MM
  /** Data real de vencimento (quando você efetivamente paga) */
  due_date?:          string;     // YYYY-MM-DD
  active:             boolean;
  notes?:             string;
  created_at?:        string;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Utilidades',
  'Serviços',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Vestuário',
  'Beleza',
  'Pet',
  'Assinaturas',
  'Impostos',
  'Seguros',
  'Investimentos',
  'Doações',
  'Outros',
] as const;

export const INCOME_CATEGORIES = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Aluguel',
  'Presente',
  'Reembolso',
  'Outros',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação':   'hsl(152, 60%, 48%)',
  'Moradia':       'hsl(220, 70%, 55%)',
  'Transporte':    'hsl(38, 92%, 55%)',
  'Saúde':         'hsl(340, 65%, 55%)',
  'Educação':      'hsl(200, 70%, 55%)',
  'Lazer':         'hsl(270, 60%, 55%)',
  'Vestuário':     'hsl(15, 80%, 55%)',
  'Beleza':        'hsl(320, 60%, 55%)',
  'Pet':           'hsl(100, 50%, 48%)',
  'Assinaturas':   'hsl(190, 60%, 48%)',
  'Impostos':      'hsl(0, 55%, 50%)',
  'Seguros':       'hsl(240, 50%, 55%)',
  'Investimentos': 'hsl(152, 50%, 40%)',
  'Doações':       'hsl(30, 70%, 55%)',
  'Utilidades':    'hsl(45, 90%, 50%)',
  'Serviços':      'hsl(180, 55%, 45%)',
  'Outros':        'hsl(215, 15%, 55%)',
  'Salário':       'hsl(152, 60%, 48%)',
  'Freelance':     'hsl(200, 65%, 50%)',
  'Aluguel':       'hsl(38, 80%, 50%)',
  'Presente':      'hsl(320, 55%, 52%)',
  'Reembolso':     'hsl(170, 55%, 48%)',
};

// ─── Account types ────────────────────────────────────────────────────────────

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking:   'Conta Corrente',
  savings:    'Poupança',
  investment: 'Investimentos',
  wallet:     'Carteira',
};

// ─── Card colors ──────────────────────────────────────────────────────────────

export const CARD_COLORS = [
  'from-purple-600 to-purple-800',
  'from-orange-500 to-orange-700',
  'from-blue-600 to-blue-800',
  'from-green-600 to-green-800',
  'from-pink-500 to-pink-700',
  'from-slate-600 to-slate-800',
  'from-teal-500 to-teal-700',
  'from-indigo-600 to-indigo-800',
];

// ─── Debt type labels ─────────────────────────────────────────────────────────

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card:   'Cartão de Crédito',
  personal_loan: 'Empréstimo Pessoal',
  financing:     'Financiamento',
  overdraft:     'Cheque Especial',
  other:         'Outro',
};
