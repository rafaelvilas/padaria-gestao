import { Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from './lib/trpc';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Fornecedores } from './pages/Fornecedores';
import { Cotacoes } from './pages/Cotacoes';
import { Compras } from './pages/Compras';
import { FichasTecnicas } from './pages/FichasTecnicas';
import { Vendas } from './pages/Vendas';
import { Estoque } from './pages/Estoque';
import { Perdas } from './pages/Perdas';
import { CMV } from './pages/CMV';
import { Financeiro } from './pages/Financeiro';
import { Alertas } from './pages/Alertas';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/fornecedores" component={Fornecedores} />
        <Route path="/cotacoes" component={Cotacoes} />
        <Route path="/compras" component={Compras} />
        <Route path="/fichas-tecnicas" component={FichasTecnicas} />
        <Route path="/vendas" component={Vendas} />
        <Route path="/estoque" component={Estoque} />
        <Route path="/perdas" component={Perdas} />
        <Route path="/cmv" component={CMV} />
        <Route path="/financeiro" component={Financeiro} />
        <Route path="/alertas" component={Alertas} />
        <Route>
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-400">Página não encontrada</h2>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
