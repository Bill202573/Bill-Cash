import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Layout } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Debts from '@/pages/Debts';
import Budget from '@/pages/Budget';
import Insights from '@/pages/Insights';
import Accounts from '@/pages/Accounts';
import FixedBills from '@/pages/FixedBills';
import Assistente from '@/pages/Assistente';
import Configuracoes from '@/pages/Configuracoes';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/"             element={<Layout><Dashboard   /></Layout>} />
          <Route path="/transacoes"   element={<Layout><Transactions /></Layout>} />
          <Route path="/dividas"      element={<Layout><Debts        /></Layout>} />
          <Route path="/orcamento"    element={<Layout><Budget       /></Layout>} />
          <Route path="/insights"     element={<Layout><Insights     /></Layout>} />
          <Route path="/contas"       element={<Layout><Accounts     /></Layout>} />
          <Route path="/contas-fixas" element={<Layout><FixedBills   /></Layout>} />
          <Route path="/assistente"    element={<Layout><Assistente    /></Layout>} />
          <Route path="/configuracoes" element={<Layout><Configuracoes /></Layout>} />
          <Route path="*"              element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
