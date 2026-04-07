import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { formatData } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Truck, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';

type StatusFornecedor = 'ativo' | 'inativo' | 'bloqueado';

const statusMap: Record<StatusFornecedor, { label: string; variant: 'success' | 'secondary' | 'danger' }> = {
  ativo: { label: 'Ativo', variant: 'success' },
  inativo: { label: 'Inativo', variant: 'secondary' },
  bloqueado: { label: 'Bloqueado', variant: 'danger' },
};

export function Fornecedores() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    razaoSocial: '', nomeFantasia: '', cnpj: '', telefone: '',
    email: '', contatoNome: '', prazoMedioDias: 0, status: 'ativo' as StatusFornecedor, observacoes: '',
  });

  const { data: fornecedores = [], refetch } = trpc.fornecedores.list.useQuery();
  const createMutation = trpc.fornecedores.create.useMutation({
    onSuccess: () => { toast.success('Fornecedor criado!'); refetch(); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.fornecedores.update.useMutation({
    onSuccess: () => { toast.success('Fornecedor atualizado!'); refetch(); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ razaoSocial: '', nomeFantasia: '', cnpj: '', telefone: '', email: '', contatoNome: '', prazoMedioDias: 0, status: 'ativo', observacoes: '' });
    setEditId(null);
  }

  function openEdit(f: typeof fornecedores[0]) {
    setEditId(f.id);
    setForm({
      razaoSocial: f.razaoSocial,
      nomeFantasia: f.nomeFantasia || '',
      cnpj: f.cnpj || '',
      telefone: f.telefone || '',
      email: f.email || '',
      contatoNome: f.contatoNome || '',
      prazoMedioDias: f.prazoMedioDias || 0,
      status: f.status || 'ativo',
      observacoes: f.observacoes || '',
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const filtered = fornecedores.filter(f =>
    f.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
    (f.nomeFantasia || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.cnpj || '').includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-gray-500 text-sm mt-1">{fornecedores.length} fornecedores cadastrados</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4" />
          Novo Fornecedor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Prazo Médio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhum fornecedor encontrado
                  </TableCell>
                </TableRow>
              ) : filtered.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{f.nomeFantasia || f.razaoSocial}</p>
                      {f.nomeFantasia && <p className="text-xs text-gray-500">{f.razaoSocial}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 font-mono text-sm">{f.cnpj || '-'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{f.contatoNome || '-'}</p>
                      <p className="text-xs text-gray-500">{f.telefone || ''}</p>
                    </div>
                  </TableCell>
                  <TableCell>{f.prazoMedioDias || 0} dias</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[f.status as StatusFornecedor]?.variant || 'secondary'}>
                      {statusMap[f.status as StatusFornecedor]?.label || f.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Razão Social *</Label>
                <Input value={form.razaoSocial} onChange={e => setForm(f => ({ ...f, razaoSocial: e.target.value }))} />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={form.nomeFantasia} onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
              </div>
              <div>
                <Label>Nome do Contato</Label>
                <Input value={form.contatoNome} onChange={e => setForm(f => ({ ...f, contatoNome: e.target.value }))} />
              </div>
              <div>
                <Label>Prazo Médio (dias)</Label>
                <Input value={form.prazoMedioDias} onChange={e => setForm(f => ({ ...f, prazoMedioDias: Number(e.target.value) }))} type="number" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusFornecedor }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
