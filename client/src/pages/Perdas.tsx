import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatData } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TIPO_PERDA_LABELS: Record<string, string> = {
  desperdicio_operacional: 'Desperdício Operacional',
  vencimento: 'Vencimento',
  quebra: 'Quebra',
  erro_producao: 'Erro de Produção',
  desvio_suspeito: 'Desvio Suspeito',
  ajuste_inventario: 'Ajuste de Inventário',
  nao_identificada: 'Não Identificada',
};

const COLORS = ['#1B4F72', '#2E86C1', '#5DADE2', '#F39C12', '#E74C3C', '#8E44AD', '#27AE60'];

export function Perdas() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), 'yyyy-MM-dd'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    insumoId: '', dataPerda: format(hoje, 'yyyy-MM-dd'),
    quantidade: 0, tipoPerda: 'desperdicio_operacional' as const, descricao: '',
  });

  const { data: perdas = [], refetch } = trpc.perdas.list.useQuery({ dataInicio, dataFim });
  const { data: resumo } = trpc.perdas.getResumo.useQuery({ dataInicio, dataFim });
  const { data: insumos = [] } = trpc.fichasTecnicas.listInsumos.useQuery();

  const registrar = trpc.perdas.registrar.useMutation({
    onSuccess: () => { toast.success('Perda registrada!'); refetch(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perdas</h1>
          <p className="text-gray-500 text-sm mt-1">
            Total no período: <span className="font-medium text-red-600">{formatMoeda(resumo?.totalValor || 0)}</span>
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Perda
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Total Perdas</p>
            <p className="text-2xl font-bold text-red-600">{formatMoeda(resumo?.totalValor || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Ocorrências</p>
            <p className="text-2xl font-bold">{resumo?.totalItens || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Tipo Predominante</p>
            <p className="text-lg font-bold text-gray-700">
              {resumo?.porTipo?.[0]
                ? TIPO_PERDA_LABELS[resumo.porTipo[0].tipo] || resumo.porTipo[0].tipo
                : '-'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Perdas por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {(resumo?.porTipo || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={resumo?.porTipo} dataKey="valor" nameKey="tipo" cx="50%" cy="50%" outerRadius={70}>
                    {(resumo?.porTipo || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoeda(v)} labelFormatter={l => TIPO_PERDA_LABELS[l] || l} />
                  <Legend formatter={v => TIPO_PERDA_LABELS[v] || v} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem perdas no período</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Insumos com Perdas</CardTitle>
          </CardHeader>
          <CardContent>
            {(resumo?.topInsumos || []).length > 0 ? (
              <div className="space-y-2">
                {resumo?.topInsumos?.slice(0, 6).map((ins, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[200px]">{ins.nome}</span>
                    <span className="text-sm font-medium text-red-600">{formatMoeda(ins.valor)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perdas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma perda registrada no período
                </TableCell></TableRow>
              ) : perdas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatData(p.dataPerda)}</TableCell>
                  <TableCell>{(p as any).insumo?.nome}</TableCell>
                  <TableCell>
                    <Badge variant={p.tipoPerda === 'desvio_suspeito' ? 'danger' : 'warning'}>
                      {TIPO_PERDA_LABELS[p.tipoPerda] || p.tipoPerda}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{Number(p.quantidade).toFixed(3)}</TableCell>
                  <TableCell className="text-red-600 font-medium">{formatMoeda(p.valorTotal)}</TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-xs truncate">{p.descricao || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Perda</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Insumo *</Label>
              <Select value={form.insumoId} onValueChange={v => setForm(f => ({ ...f, insumoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar insumo..." /></SelectTrigger>
                <SelectContent>{insumos.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data da Perda</Label>
                <Input type="date" value={form.dataPerda} onChange={e => setForm(f => ({ ...f, dataPerda: e.target.value }))} />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" step="0.001" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>Tipo de Perda *</Label>
              <Select value={form.tipoPerda} onValueChange={v => setForm(f => ({ ...f, tipoPerda: v as typeof form.tipoPerda }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_PERDA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes da perda..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => registrar.mutate(form)} disabled={registrar.isPending || !form.insumoId}>
              Registrar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
