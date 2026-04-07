import { useState } from 'react';
import { format } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatData } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Cotacoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    fornecedorId: '', dataCotacao: format(new Date(), 'yyyy-MM-dd'),
    dataValidade: '', prazoPagamentoDias: 30, prazoEntregaDias: 7, observacoes: '',
  });
  const [itens, setItens] = useState<Array<{ insumoId: string; quantidade: number; precoUnitario: number; unidadeMedida: string }>>([]);

  const { data: cotacoes = [], refetch } = trpc.cotacoes.list.useQuery();
  const { data: fornecedores = [] } = trpc.fornecedores.list.useQuery();
  const { data: insumos = [] } = trpc.fichasTecnicas.listInsumos.useQuery();

  const create = trpc.cotacoes.create.useMutation({
    onSuccess: () => { toast.success('Cotação criada!'); refetch(); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.cotacoes.updateStatus.useMutation({
    onSuccess: () => { toast.success('Status atualizado'); refetch(); },
  });

  function resetForm() {
    setForm({ fornecedorId: '', dataCotacao: format(new Date(), 'yyyy-MM-dd'), dataValidade: '', prazoPagamentoDias: 30, prazoEntregaDias: 7, observacoes: '' });
    setItens([]);
  }

  function addItem() {
    setItens(prev => [...prev, { insumoId: '', quantidade: 0, precoUnitario: 0, unidadeMedida: 'kg' }]);
  }

  const statusConfig = {
    aberta: { label: 'Aberta', variant: 'info' as const },
    aprovada: { label: 'Aprovada', variant: 'success' as const },
    rejeitada: { label: 'Rejeitada', variant: 'danger' as const },
    expirada: { label: 'Expirada', variant: 'secondary' as const },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotações</h1>
          <p className="text-gray-500 text-sm mt-1">{cotacoes.length} cotações cadastradas</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Cotação
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotacoes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhuma cotação</TableCell></TableRow>
              ) : cotacoes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.numero || '-'}</TableCell>
                  <TableCell>{(c as any).fornecedor?.nomeFantasia || (c as any).fornecedor?.razaoSocial}</TableCell>
                  <TableCell>{formatData(c.dataCotacao)}</TableCell>
                  <TableCell>{c.dataValidade ? formatData(c.dataValidade) : '-'}</TableCell>
                  <TableCell>{formatMoeda((c as any).valorTotal || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[c.status as keyof typeof statusConfig]?.variant || 'secondary'}>
                      {statusConfig[c.status as keyof typeof statusConfig]?.label || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.status === 'aberta' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'aprovada' })}>Aprovar</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: c.id, status: 'rejeitada' })}>Rejeitar</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Cotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor *</Label>
                <Select value={form.fornecedorId} onValueChange={v => setForm(f => ({ ...f, fornecedorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da Cotação</Label>
                <Input type="date" value={form.dataCotacao} onChange={e => setForm(f => ({ ...f, dataCotacao: e.target.value }))} />
              </div>
              <div>
                <Label>Validade</Label>
                <Input type="date" value={form.dataValidade} onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))} />
              </div>
              <div>
                <Label>Prazo Pagamento (dias)</Label>
                <Input type="number" value={form.prazoPagamentoDias} onChange={e => setForm(f => ({ ...f, prazoPagamentoDias: Number(e.target.value) }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
              </div>
              {itens.map((item, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-center">
                  <div className="col-span-2">
                    <Select value={item.insumoId} onValueChange={v => {
                      const ins = insumos.find(x => x.id === v);
                      setItens(prev => prev.map((it, idx) => idx === i ? { ...it, insumoId: v, unidadeMedida: ins?.unidadeMedida || 'kg' } : it));
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Insumo..." /></SelectTrigger>
                      <SelectContent>{insumos.map(ins => <SelectItem key={ins.id} value={ins.id}>{ins.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input className="h-8 text-xs" type="number" placeholder="Qtd" value={item.quantidade || ''} onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, quantidade: Number(e.target.value) } : it))} />
                  <Input className="h-8 text-xs" type="number" step="0.01" placeholder="Preço" value={item.precoUnitario || ''} onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, precoUnitario: Number(e.target.value) } : it))} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItens(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => create.mutate({ ...form, itens })} disabled={create.isPending}>Criar Cotação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
