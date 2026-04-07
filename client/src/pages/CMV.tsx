import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatPercentual, getCmvColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

function CmvGauge({ value }: { value: number }) {
  const max = 60;
  const angle = (value / max) * 180 - 90;
  const color = value <= 28 ? '#22c55e' : value <= 35 ? '#eab308' : value <= 42 ? '#f97316' : '#ef4444';

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: 160, height: 80 }}>
        {/* Background arc */}
        <svg width="160" height="90" viewBox="0 0 160 90">
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
          {/* Green zone 0-28% */}
          <path d="M 10 80 A 70 70 0 0 1 68 19" fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
          {/* Yellow zone 28-35% */}
          <path d="M 68 19 A 70 70 0 0 1 95 13" fill="none" stroke="#eab308" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
          {/* Orange zone 35-42% */}
          <path d="M 95 13 A 70 70 0 0 1 122 19" fill="none" stroke="#f97316" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
          {/* Red zone 42-60% */}
          <path d="M 122 19 A 70 70 0 0 1 150 80" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
          {/* Needle */}
          <line
            x1="80" y1="80"
            x2={80 + 55 * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={80 + 55 * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="80" cy="80" r="5" fill={color} />
        </svg>
      </div>
      <p className={`text-3xl font-black -mt-2 ${getCmvColor(value)}`}>{formatPercentual(value)}</p>
      <p className="text-xs text-gray-500 mt-1">CMV do período</p>
      <div className="flex gap-3 mt-2 text-xs">
        <span className="text-green-600">Excelente ≤28%</span>
        <span className="text-yellow-600">Bom ≤35%</span>
        <span className="text-orange-500">Regular ≤42%</span>
        <span className="text-red-600">Crítico &gt;42%</span>
      </div>
    </div>
  );
}

export function CMV() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), 'yyyy-MM-dd'));

  const { data: cmv, isLoading } = trpc.cmv.calcular.useQuery({ dataInicio, dataFim });
  const { data: historico = [] } = trpc.cmv.historico.useQuery({ semanas: 8 });
  const { data: porProduto } = trpc.cmv.porProduto.useQuery({ dataInicio, dataFim });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  const d = cmv || { cmvPctReal: 0, cmvPctTeorico: 0, cmvReal: 0, cmvTeorico: 0, faturamento: 0, desvio: 0, desvioPercentual: 0, totalCompras: 0, topInsumos: [], interpretacaoDesvio: '' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CMV - Custo de Mercadoria Vendida</h1>
          <p className="text-gray-500 text-sm mt-1">Análise de custos e eficiência operacional</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-600">De:</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <label className="text-sm text-gray-600">Até:</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      {/* Gauge + KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="col-span-2 flex items-center justify-center py-6">
          <CmvGauge value={d.cmvPctReal} />
        </Card>

        <div className="col-span-2 grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">CMV Real</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatMoeda(d.cmvReal)}</p>
              <p className={`text-sm font-semibold mt-1 ${getCmvColor(d.cmvPctReal)}`}>{formatPercentual(d.cmvPctReal)}</p>
              <p className="text-xs text-gray-400 mt-1">do faturamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">CMV Teórico</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatMoeda(d.cmvTeorico)}</p>
              <p className={`text-sm font-semibold mt-1 ${getCmvColor(d.cmvPctTeorico)}`}>{formatPercentual(d.cmvPctTeorico)}</p>
              <p className="text-xs text-gray-400 mt-1">esperado (fichas técnicas)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">Faturamento</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatMoeda(d.faturamento)}</p>
            </CardContent>
          </Card>
          <Card className={d.desvio > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">Desvio (Real - Teórico)</p>
              <p className={`text-xl font-bold mt-1 ${d.desvio > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {d.desvio >= 0 ? '+' : ''}{formatMoeda(d.desvio)}
              </p>
              <p className={`text-sm mt-1 ${d.desvio > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {d.desvio >= 0 ? '+' : ''}{formatPercentual(d.desvioPercentual)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Análise de desvio */}
      <Card className={d.desvio > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            {d.desvio > 0
              ? <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0" />
              : <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            }
            <div>
              <p className="font-semibold text-gray-800">Análise de Desvio CMV</p>
              <p className="text-sm text-gray-600 mt-0.5">{d.interpretacaoDesvio}</p>
              {d.desvio > 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  O consumo real excede o teórico em {formatMoeda(d.desvio)} ({formatPercentual(d.desvioPercentual)}).
                  Verifique desperdícios, perdas não registradas ou desvios.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CMV% Histórico (8 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`]} />
                <ReferenceLine y={32} stroke="#22c55e" strokeDasharray="5 5" />
                <ReferenceLine y={45} stroke="#ef4444" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="cmvPct" stroke="#1B4F72" strokeWidth={2} dot={{ r: 3 }} name="CMV%" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Insumos por Custo</CardTitle>
          </CardHeader>
          <CardContent>
            {(d.topInsumos || []).length > 0 ? (
              <div className="space-y-2">
                {d.topInsumos.slice(0, 6).map((ins: { nome: string; valor: number; percentualCmv: number }, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                    <span className="text-sm flex-1 truncate">{ins.nome}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-600"
                          style={{ width: `${Math.min(100, ins.percentualCmv)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-14 text-right">{formatMoeda(ins.valor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                Sem dados de CMV para o período
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
