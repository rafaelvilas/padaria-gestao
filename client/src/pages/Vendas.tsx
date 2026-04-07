import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatData } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Vendas() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), 'yyyy-MM-dd'));

  const { data: cupons = [] } = trpc.vendas.listCupons.useQuery({ dataInicio, dataFim });
  const { data: resumo } = trpc.vendas.getResumo.useQuery({ dataInicio, dataFim });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-500 text-sm mt-1">{cupons.length} cupons no período</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Faturamento</p>
            <p className="text-2xl font-bold text-green-600">{formatMoeda(resumo?.faturamento || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Total de Cupons</p>
            <p className="text-2xl font-bold">{resumo?.totalCupons || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Ticket Médio</p>
            <p className="text-2xl font-bold">{formatMoeda(resumo?.ticketMedio || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {(resumo?.topProdutos || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={resumo?.topProdutos?.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatMoeda(v)} />
                  <YAxis type="category" dataKey="descricao" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: number) => formatMoeda(v)} />
                  <Bar dataKey="valor" fill="#1B4F72" name="Faturamento" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem dados de vendas</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Últimos Cupons</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Forma Pag.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cupons.slice(0, 10).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{formatData(c.dataVenda)}</TableCell>
                    <TableCell className="font-mono text-xs">{c.numeroCupom || '-'}</TableCell>
                    <TableCell className="font-medium">{formatMoeda(c.valorLiquido)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.formaPagamento || '-'}</TableCell>
                  </TableRow>
                ))}
                {cupons.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-6">Nenhuma venda no período</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
