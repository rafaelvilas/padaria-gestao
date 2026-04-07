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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

export function Compras() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), 'yyyy-MM-dd'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    numeroNf: '', fornecedorId: '', dataEmissao: format(hoje, 'yyyy-MM-dd'),
    dataEntrada: format(hoje, 'yyyy-MM-dd'), valorTotal: 0,
    valorImpostos: 0, valorFrete: 0, observacoes: '',
  });
  const [itens, setItens] = useState<Array<{
    insumoId: string; descricaoNf: string; quantidade: number;
    precoUnitario: number; unidadeMedida: string; valorTotal: number;
  }>>([]);
  const [boletoVenc, setBoletoVenc] = useState('');

  const { data: nfs = [], refetch } = trpc.compras.listNfs.useQuery({ dataInicio, dataFim });
  const { data: fornecedores = [] } = trpc.fornecedores.list.useQuery();
  const { data: insumos = [] } = trpc.fichasTecnicas.listInsumos.useQuery();

  const createNf = trpc.compras.createNf.useMutation({
    onSuccess: () => { toast.success('NF registrada e estoque atualizado!'); refetch(); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ numeroNf: '', fornecedorId: '', dataEmissao: format(hoje, 'yyyy-MM-dd'), dataEntrada: format(hoje, 'yyyy-MM-dd'), valorTotal: 0, valorImpostos: 0, valorFrete: 0, observacoes: '' });
    setItens([]);
    setBoletoVenc('');
  }

  function addItem() {
    setItens(prev => [...prev, { insumoId: '', descricaoNf: '', quantidade: 0, precoUnitario: 0, unidadeMedida: 'kg', valorTotal: 0 }]);
  }

  function removeItem(i: number) {
    setItens(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: string, value: string | number) {
    setItens(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantidade' || field === 'precoUnitario') {
        updated.valorTotal = Number(updated.quantidade) * Number(updated.precoUnitario);
      }
      return updated;
    }));
  }

  const totalItens = itens.reduce((acc, i) => acc + i.valorTotal, 0);

  function handleSubmit() {
    if (!form.numeroNf || !form.fornecedorId) { toast.error('Preencha número da NF e fornecedor'); return; }
    createNf.mutate({
      ...form,
      valorTotal: form.valorTotal || totalItens,
      itens: itens.filter(i => i.descricaoNf),
      boletos: boletoVenc ? [{ valor: form.valorTotal || totalItens, dataVencimento: boletoVenc }] : undefined,
    });
  }

  const statusVariant = (s: string) => s === 'conciliada' ? 'success' as const : s === 'cancelada' ? 'danger' as const : 'warning' as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 text-sm mt-1">{nfs.length} notas fiscais no período</p>
        </div>
        <div className="flex gap-3 items-center">
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Lançar NF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma NF no período
                </TableCell></TableRow>
              ) : nfs.map((nf) => (
                <TableRow key={nf.id}>
                  <TableCell className="font-mono font-medium">{nf.numeroNf}</TableCell>
                  <TableCell>{(nf as any).fornecedor?.nomeFantasia || (nf as any).fornecedor?.razaoSocial}</TableCell>
                  <TableCell>{formatData(nf.dataEmissao)}</TableCell>
                  <TableCell>{nf.dataEntrada ? formatData(nf.dataEntrada) : '-'}</TableCell>
                  <TableCell className="font-medium">{formatMoeda(nf.valorTotal)}</TableCell>
                  <TableCell><Badge variant={statusVariant(nf.status || 'pendente')}>{nf.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para nova NF */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar Nota Fiscal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Número NF *</Label>
                <Input value={form.numeroNf} onChange={e => setForm(f => ({ ...f, numeroNf: e.target.value }))} />
              </div>
              <div>
                <Label>Data Emissão</Label>
                <Input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} />
              </div>
              <div>
                <Label>Data Entrada</Label>
                <Input type="date" value={form.dataEntrada} onChange={e => setForm(f => ({ ...f, dataEntrada: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Fornecedor *</Label>
                <Select value={form.fornecedorId} onValueChange={v => setForm(f => ({ ...f, fornecedorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Venc. Boleto</Label>
                <Input type="date" value={boletoVenc} onChange={e => setBoletoVenc(e.target.value)} />
              </div>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens da NF</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-3 h-3 mr-1" />Adicionar Item
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((item, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-center bg-gray-50 p-2 rounded">
                    <div className="col-span-2">
                      <Select value={item.insumoId} onValueChange={v => {
                        const ins = insumos.find(x => x.id === v);
                        updateItem(i, 'insumoId', v);
                        if (ins) { updateItem(i, 'descricaoNf', ins.nome); updateItem(i, 'unidadeMedida', ins.unidadeMedida); }
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Insumo..." /></SelectTrigger>
                        <SelectContent>
                          {insumos.map(ins => <SelectItem key={ins.id} value={ins.id}>{ins.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input className="h-8 text-xs" placeholder="Qtd" type="number" value={item.quantidade || ''} onChange={e => updateItem(i, 'quantidade', Number(e.target.value))} />
                    <Input className="h-8 text-xs" placeholder="Preço Un" type="number" step="0.01" value={item.precoUnitario || ''} onChange={e => updateItem(i, 'precoUnitario', Number(e.target.value))} />
                    <div className="text-sm font-medium text-gray-700">{formatMoeda(item.valorTotal)}</div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)}>
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              {itens.length > 0 && (
                <div className="text-right mt-2 font-semibold">
                  Total: {formatMoeda(totalItens)}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createNf.isPending}>
              {createNf.isPending ? 'Salvando...' : 'Lançar NF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
