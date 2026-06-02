import SummaryCard from "@/components/SummaryCard";
import TransactionList from "@/components/TransactionList";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import CreditCardSection from "@/components/CreditCardSection";
import MonthlyChart from "@/components/MonthlyChart";
import { MessageSquare, Bell } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight">
              <span className="text-primary">Fin</span>Hub
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors relative" title="WhatsApp conectado">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Notificações">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2 ml-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">VC</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-2xl font-display font-bold">Olá! 👋</h2>
          <p className="text-muted-foreground text-sm mt-1">Aqui está o resumo financeiro de Março 2026</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Saldo Total"
            value="R$ 15.240,30"
            change="+4,2% vs mês anterior"
            changeType="positive"
            icon="balance"
          />
          <SummaryCard
            title="Receitas"
            value="R$ 10.700,00"
            change="+1,9% vs mês anterior"
            changeType="positive"
            icon="income"
          />
          <SummaryCard
            title="Despesas"
            value="R$ 4.880,10"
            change="-34% vs mês anterior"
            changeType="positive"
            icon="expense"
          />
          <SummaryCard
            title="Fatura Cartões"
            value="R$ 2.964,60"
            change="3 cartões ativos"
            changeType="neutral"
            icon="credit"
          />
        </div>

        {/* Charts + Categories Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <MonthlyChart />
          <CategoryBreakdown />
        </div>

        {/* Transactions + Credit Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TransactionList />
          </div>
          <CreditCardSection />
        </div>
      </main>
    </div>
  );
};

export default Index;
