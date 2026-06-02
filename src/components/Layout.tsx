import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, Target,
  Lightbulb, Wallet, FileText, Bot, Settings, Menu, X,
} from 'lucide-react';

interface LayoutProps { children: ReactNode }

const NAV = [
  { path: '/',             icon: LayoutDashboard, label: 'Dashboard'     },
  { path: '/transacoes',   icon: ArrowLeftRight,  label: 'Transações'    },
  { path: '/contas-fixas', icon: FileText,        label: 'Contas Fixas'  },
  { path: '/dividas',      icon: CreditCard,      label: 'Dívidas'       },
  { path: '/orcamento',    icon: Target,          label: 'Orçamento'     },
  { path: '/contas',       icon: Wallet,          label: 'Contas'        },
  { path: '/insights',     icon: Lightbulb,       label: 'Insights'      },
  { path: '/assistente',    icon: Bot,      label: 'Assistente IA',  highlight: true },
  { path: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/50 bg-card/40 backdrop-blur-xl">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">B</div>
            <span className="font-display font-bold text-lg">Bill Cash</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ path, icon: Icon, label, highlight }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : highlight
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-border/30">
          <p className="text-xs text-muted-foreground">Bill Cash © 2026</p>
        </div>
      </aside>

      {/* ── Mobile header ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">B</div>
          <span className="font-display font-bold">Bill Cash</span>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 pt-14">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="relative bg-card border-r border-border/50 w-56 h-full p-3 space-y-0.5 overflow-y-auto">
            {NAV.map(({ path, icon: Icon, label, highlight }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : highlight
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
