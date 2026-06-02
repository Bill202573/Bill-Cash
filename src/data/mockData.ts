export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  account: string;
  user: string;
}

export interface CreditCard {
  id: string;
  name: string;
  lastDigits: string;
  currentBill: number;
  limit: number;
  dueDate: string;
  color: string;
}

export interface CategorySummary {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

export const mockTransactions: Transaction[] = [
  { id: '1', description: 'Salário', amount: 8500, type: 'income', category: 'Salário', date: '2026-03-25', account: 'Nubank', user: 'Você' },
  { id: '2', description: 'Supermercado Extra', amount: 342.50, type: 'expense', category: 'Alimentação', date: '2026-03-26', account: 'Nubank', user: 'Você' },
  { id: '3', description: 'Conta de Luz', amount: 189.90, type: 'expense', category: 'Moradia', date: '2026-03-24', account: 'Itaú', user: 'Esposa' },
  { id: '4', description: 'Uber', amount: 28.50, type: 'expense', category: 'Transporte', date: '2026-03-26', account: 'Nubank', user: 'Você' },
  { id: '5', description: 'Freelance Design', amount: 2200, type: 'income', category: 'Freelance', date: '2026-03-20', account: 'Itaú', user: 'Esposa' },
  { id: '6', description: 'Netflix', amount: 55.90, type: 'expense', category: 'Lazer', date: '2026-03-22', account: 'Cartão Inter', user: 'Você' },
  { id: '7', description: 'Farmácia', amount: 87.30, type: 'expense', category: 'Saúde', date: '2026-03-25', account: 'Nubank', user: 'Esposa' },
  { id: '8', description: 'Restaurante Japonês', amount: 156.00, type: 'expense', category: 'Alimentação', date: '2026-03-23', account: 'Cartão Inter', user: 'Você' },
  { id: '9', description: 'Gasolina', amount: 220.00, type: 'expense', category: 'Transporte', date: '2026-03-21', account: 'Itaú', user: 'Esposa' },
  { id: '10', description: 'Aluguel', amount: 2800, type: 'expense', category: 'Moradia', date: '2026-03-05', account: 'Itaú', user: 'Você' },
];

export const mockCreditCards: CreditCard[] = [
  { id: '1', name: 'Nubank', lastDigits: '4532', currentBill: 1890.40, limit: 8000, dueDate: '2026-04-10', color: 'from-purple-600 to-purple-800' },
  { id: '2', name: 'Inter', lastDigits: '7891', currentBill: 654.20, limit: 5000, dueDate: '2026-04-15', color: 'from-orange-500 to-orange-700' },
  { id: '3', name: 'Itaú', lastDigits: '2156', currentBill: 420.00, limit: 12000, dueDate: '2026-04-07', color: 'from-blue-600 to-blue-800' },
];

export const mockCategories: CategorySummary[] = [
  { name: 'Moradia', amount: 2989.90, percentage: 35, color: 'hsl(220, 70%, 55%)' },
  { name: 'Alimentação', amount: 498.50, percentage: 18, color: 'hsl(152, 60%, 48%)' },
  { name: 'Transporte', amount: 248.50, percentage: 12, color: 'hsl(38, 92%, 55%)' },
  { name: 'Saúde', amount: 87.30, percentage: 8, color: 'hsl(340, 65%, 55%)' },
  { name: 'Lazer', amount: 55.90, percentage: 5, color: 'hsl(270, 60%, 55%)' },
];

export const monthlyData = [
  { month: 'Out', receitas: 9800, despesas: 6200 },
  { month: 'Nov', receitas: 10200, despesas: 7100 },
  { month: 'Dez', receitas: 12500, despesas: 9800 },
  { month: 'Jan', receitas: 10700, despesas: 6900 },
  { month: 'Fev', receitas: 10500, despesas: 7400 },
  { month: 'Mar', receitas: 10700, despesas: 4880 },
];
