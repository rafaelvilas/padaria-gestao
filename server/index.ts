import { router } from './_core/trpc';
import { fornecedoresRouter } from './routers/fornecedores';
import { cotacoesRouter } from './routers/cotacoes';
import { comprasRouter } from './routers/compras';
import { fichasTecnicasRouter } from './routers/fichasTecnicas';
import { vendasRouter } from './routers/vendas';
import { estoqueRouter } from './routers/estoque';
import { perdasRouter } from './routers/perdas';
import { cmvRouter } from './routers/cmv';
import { financeiroRouter } from './routers/financeiro';
import { alertasRouter } from './routers/alertas';
import { dashboardRouter } from './routers/dashboard';

export const appRouter = router({
  fornecedores: fornecedoresRouter,
  cotacoes: cotacoesRouter,
  compras: comprasRouter,
  fichasTecnicas: fichasTecnicasRouter,
  vendas: vendasRouter,
  estoque: estoqueRouter,
  perdas: perdasRouter,
  cmv: cmvRouter,
  financeiro: financeiroRouter,
  alertas: alertasRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
