import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FamilyScopeProvider } from '@/contexts/FamilyContext';
import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Debts from '@/pages/Debts';
import Budget from '@/pages/Budget';
import Insights from '@/pages/Insights';
import Accounts from '@/pages/Accounts';
import Cards from '@/pages/Cards';
import CardDetail from '@/pages/CardDetail';
import Categories from '@/pages/Categories';
import FixedBills from '@/pages/FixedBills';
import Assistente from '@/pages/Assistente';
import Configuracoes from '@/pages/Configuracoes';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/** Componente para proteger rotas — redireciona pra login se não autenticado */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <FamilyScopeProvider>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout><ErrorBoundary><Dashboard   /></ErrorBoundary></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transacoes"
            element={
              <ProtectedRoute>
                <Layout><Transactions /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dividas"
            element={
              <ProtectedRoute>
                <Layout><Debts        /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orcamento"
            element={
              <ProtectedRoute>
                <Layout><Budget       /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <Layout><Insights     /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contas"
            element={
              <ProtectedRoute>
                <Layout><Accounts     /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cartoes"
            element={
              <ProtectedRoute>
                <Layout><ErrorBoundary><Cards        /></ErrorBoundary></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cartoes/:id"
            element={
              <ProtectedRoute>
                <Layout><ErrorBoundary><CardDetail   /></ErrorBoundary></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categorias"
            element={
              <ProtectedRoute>
                <Layout><ErrorBoundary><Categories   /></ErrorBoundary></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contas-fixas"
            element={
              <ProtectedRoute>
                <Layout><ErrorBoundary><FixedBills   /></ErrorBoundary></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistente"
            element={
              <ProtectedRoute>
                <Layout><Assistente    /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <Layout><Configuracoes /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </FamilyScopeProvider>
  </QueryClientProvider>
);

export default App;
