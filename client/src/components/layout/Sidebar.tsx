import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Truck, FileSearch, ShoppingCart, BookOpen,
  TrendingUp, Package, AlertTriangle, BarChart3, Wallet, Bell,
  ChefHat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/fornecedores', icon: Truck, label: 'Fornecedores' },
  { href: '/cotacoes', icon: FileSearch, label: 'Cotações' },
  { href: '/compras', icon: ShoppingCart, label: 'Compras' },
  { href: '/fichas-tecnicas', icon: BookOpen, label: 'Fichas Técnicas' },
  { href: '/vendas', icon: TrendingUp, label: 'Vendas' },
  { href: '/estoque', icon: Package, label: 'Estoque' },
  { href: '/perdas', icon: AlertTriangle, label: 'Perdas' },
  { href: '/cmv', icon: BarChart3, label: 'CMV' },
  { href: '/financeiro', icon: Wallet, label: 'Financeiro' },
  { href: '/alertas', icon: Bell, label: 'Alertas' },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: alertaCount } = trpc.alertas.getCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col" style={{ backgroundColor: '#0F2A38' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2E86C1' }}>
          <ChefHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">Padaria</p>
          <p className="text-blue-300 text-xs mt-0.5">Gestão</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? location === '/'
            : location.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative',
                  isActive
                    ? 'text-white font-medium'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                )}
                style={isActive ? { backgroundColor: '#2E86C1' } : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {item.href === '/alertas' && alertaCount && alertaCount.total > 0 && (
                  <span className={cn(
                    'ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    alertaCount.criticos > 0 ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
                  )}>
                    {alertaCount.total}
                  </span>
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-blue-300 text-xs">v1.0.0</p>
      </div>
    </aside>
  );
}
