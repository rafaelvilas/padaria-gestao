import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatPercentual, getCmvColor, getScoreColor, getScoreFaixa, getScoreLabel } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, AlertTriangle, Package, Wallet,
  BarChart3, RefreshCw, DollarSign, ShoppingCart, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ReferenceLine
} from 'recharts';

const PIE_COLORS = ['#1B4F72', '#2E86C1', '#5DADE2', '#85C1E9', '#AED6F1'];

export function Dashboard() {
  const { data, isLoading, refetch } = trpc.dashboard.getExecutivo.useQuery();
  const runAlertas = trpc.alertas.run.useMutation();

  const hoje = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const d = data || {
    cmvPercentual: 0, cmvValor: 0, faturamento: 0, totalCompras: 0,
    alertasCriticos: 0, alertasAltos: 0, itensCriticos: 0,
    boletosVencidos: 0, totalVencendo7d: 0, pendenciasConciliacao: 0,
    scoreGeral: 0, scoreFaixa: 'E',
    cmvHistorico: [], topInsumosCmv: [], comprasPorFornecedor: [],
  };

  const scoreFaixa = getScoreFaixa(d.scoreGeral);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Executivo</h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{hoje}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-lg ${getScoreColor(d.scoreGeral)}`}>
            <span>Score {scoreFaixa}</span>
            <span className="text-2xl font-black">{d.scoreGeral}</span>
            <span className="text-sm font-normal">{getScoreLabel(d.scoreGeral)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { runAlertas.mutate(); refetch(); }}
            disabled={runAlertas.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${runAlertas.isPending ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* CMV% */}
        <Card className={`border-2 ${d.cmvPercentual > 42 ? 'border-red-300' : d.cmvPercentual > 35 ? 'border-orange-300' : d.cmvPercentual > 28 ? 'border-yellow-300' : 'border-green-300'}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">CMV do Mês</p>
                <p className={`text-2xl font-bold mt-1 ${getCmvColor(d.cmvPercentual)}`}>
                  {formatPercentual(d.cmvPercentual)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{formatMoeda(d.cmvValor)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-gray-300" />
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${d.cmvPercentual <= 28 ? 'bg-green-500' : d.cmvPercentual <= 35 ? 'bg-yellow-500' : d.cmvPercentual <= 42 ? 'bg-orange-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (d.cmvPercentual / 60) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Meta: 32%</p>
            </div>
          </CardContent>
        </Card>

        {/* Faturamento */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Faturamento</p>
                <p className="text-2xl font-bold mt-1 text-gray-800">{formatMoeda(d.faturamento)}</p>
                <p className="text-xs text-gray-400 mt-1">Mês atual</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-300" />
            </div>
          </CardContent>
        </Card>

        {/* Total Compras */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Compras</p>
                <p className="text-2xl font-bold mt-1 text-gray-800">{formatMoeda(d.totalCompras)}</p>
                <p className="text-xs text-gray-400 mt-1">Mês atual</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className={d.alertasCriticos > 0 ? 'border-red-300 border-2' : ''}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Alertas</p>
                <p className={`text-2xl font-bold mt-1 ${d.alertasCriticos > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {d.alertasCriticos + d.alertasAltos}
                </p>
                <div className="flex gap-1 mt-1">
                  {d.alertasCriticos > 0 && (
                    <Badge variant="danger" className="text-xs px-1">{d.alertasCriticos} crít</Badge>
                  )}
                  {d.alertasAltos > 0 && (
                    <Badge variant="warning" className="text-xs px-1">{d.alertasAltos} alto</Badge>
                  )}
                </div>
              </div>
              <Bell className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>

        {/* Financeiro */}
        <Card className={d.boletosVencidos > 0 ? 'border-red-300 border-2' : ''}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Financeiro</p>
                <p className={`text-2xl font-bold mt-1 ${d.boletosVencidos > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {d.boletosVencidos} vcdo
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatMoeda(d.totalVencendo7d)} em 7d
                </p>
              </div>
              <Wallet className="w-8 h-8 text-yellow-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* CMV Histórico - ocupa 2/3 */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CMV% - Histórico 8 Semanas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.cmvHistorico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 60]} />
                <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                <Legend />
                <ReferenceLine y={32} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Meta 32%', position: 'right', fontSize: 11, fill: '#22c55e' }} />
                <ReferenceLine y={45} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Máx 45%', position: 'right', fontSize: 11, fill: '#ef4444' }} />
                <Line
                  type="monotone"
                  dataKey="cmvPct"
                  stroke="#1B4F72"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="CMV%"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Compras por Fornecedor - ocupa 1/3 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compras por Fornecedor</CardTitle>
          </CardHeader>
          <CardContent>
            {d.comprasPorFornecedor.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={d.comprasPorFornecedor}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                    >
                      {d.comprasPorFornecedor.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoeda(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {d.comprasPorFornecedor.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-gray-600">{f.nome}</span>
                      <span className="ml-auto font-medium">{formatMoeda(f.valor)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                Sem dados de compras
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Top Insumos CMV */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 5 Insumos por Impacto no CMV</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topInsumosCmv.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.topInsumosCmv} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatMoeda(v)} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v: number) => formatMoeda(v)} />
                  <Bar dataKey="valor" fill="#1B4F72" radius={[0, 4, 4, 0]} name="Valor" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                Sem dados de CMV
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="space-y-3">
          <Card className={d.itensCriticos > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Package className={`w-8 h-8 ${d.itensCriticos > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Estoque Crítico</p>
                  <p className={`text-xl font-bold ${d.itensCriticos > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {d.itensCriticos === 0 ? 'OK' : `${d.itensCriticos} itens`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={d.pendenciasConciliacao > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Wallet className={`w-8 h-8 ${d.pendenciasConciliacao > 5 ? 'text-yellow-500' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Conciliação</p>
                  <p className={`text-xl font-bold ${d.pendenciasConciliacao > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {d.pendenciasConciliacao === 0 ? 'OK' : `${d.pendenciasConciliacao} pend`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={d.boletosVencidos > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-8 h-8 ${d.boletosVencidos > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Boletos Vencidos</p>
                  <p className={`text-xl font-bold ${d.boletosVencidos > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {d.boletosVencidos === 0 ? 'OK' : `${d.boletosVencidos} em atraso`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
