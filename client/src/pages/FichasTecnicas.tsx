import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { formatMoeda } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, BookOpen, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

export function FichasTecnicas() {
  const [selectedProduto, setSelectedProduto] = useState<string | null>(null);
  const [fichaDialogOpen, setFichaDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fichaForm, setFichaForm] = useState({
    rendimento: 1, unidadeRendimento: 'un', observacoes: '',
  });
  const [fichaItens, setFichaItens] = useState<Array<{
    insumoId: string; quantidade: number; unidadeMedida: string; fatorPerda: number;
  }>>([]);

  const { data: produtos = [], refetch } = trpc.fichasTecnicas.listProdutos.useQuery();
  const { data: insumos = [] } = trpc.fichasTecnicas.listInsumos.useQuery();
  const { data: ficha } = trpc.fichasTecnicas.getFicha.useQuery(
    selectedProduto || '',
    { enabled: !!selectedProduto }
  );

  const saveFicha = trpc.fichasTecnicas.saveFicha.useMutation({
    onSuccess: () => { toast.success('Ficha técnica salva!'); refetch(); setFichaDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = produtos.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  function openFichaDialog(produtoId: string) {
    setSelectedProduto(produtoId);
    setFichaItens([]);
    setFichaForm({ rendimento: 1, unidadeRendimento: 'un', observacoes: '' });
    setFichaDialogOpen(true);
  }

  function calcularCustoPorcao() {
    return fichaItens.reduce((acc, item) => {
      const ins = insumos.find(i => i.id === item.insumoId);
      const custo = Number(ins?.custoMedio || 0);
      return acc + item.quantidade * custo * (1 + item.fatorPerda);
    }, 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-500 text-sm mt-1">{produtos.filter(p => p.fichaAtiva).length} de {produtos.length} produtos com ficha</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className={p.fichaAtiva ? 'border-green-200' : 'border-gray-200'}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{p.nome}</p>
                  <p className="text-xs text-gray-500">{(p as any).categoria?.nome}</p>
                </div>
                {p.temFichaTecnica
                  ? <Badge variant="success">Com ficha</Badge>
                  : <Badge variant="secondary">Sem ficha</Badge>
                }
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Preço venda: <span className="font-medium">{formatMoeda(p.precoVenda)}</span>
              </p>
              <Button
                variant={p.temFichaTecnica ? 'outline' : 'default'}
                size="sm"
                className="w-full"
                onClick={() => openFichaDialog(p.id)}
              >
                {p.temFichaTecnica ? (
                  <><Edit className="w-3 h-3 mr-1" />Editar Ficha</>
                ) : (
                  <><Plus className="w-3 h-3 mr-1" />Criar Ficha</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ficha Dialog */}
      <Dialog open={fichaDialogOpen} onOpenChange={setFichaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ficha Técnica: {produtos.find(p => p.id === selectedProduto)?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Rendimento</Label>
                <Input type="number" value={fichaForm.rendimento} onChange={e => setFichaForm(f => ({ ...f, rendimento: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Unidade Rendimento</Label>
                <Input value={fichaForm.unidadeRendimento} onChange={e => setFichaForm(f => ({ ...f, unidadeRendimento: e.target.value }))} placeholder="un, kg, L..." />
              </div>
              <div className="flex items-end">
                <div>
                  <p className="text-xs text-gray-500">Custo Calculado</p>
                  <p className="text-lg font-bold text-blue-600">{formatMoeda(calcularCustoPorcao())}</p>
                  <p className="text-xs text-gray-400">para {fichaForm.rendimento} {fichaForm.unidadeRendimento}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Ingredientes</Label>
                <Button variant="outline" size="sm" onClick={() => setFichaItens(prev => [...prev, { insumoId: '', quantidade: 0, unidadeMedida: 'kg', fatorPerda: 0 }])}>
                  <Plus className="w-3 h-3 mr-1" />Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {fichaItens.map((item, i) => {
                  const ins = insumos.find(x => x.id === item.insumoId);
                  const custo = Number(ins?.custoMedio || 0) * item.quantidade * (1 + item.fatorPerda);
                  return (
                    <div key={i} className="grid grid-cols-6 gap-2 items-center bg-gray-50 p-2 rounded">
                      <div className="col-span-2">
                        <Select value={item.insumoId} onValueChange={v => {
                          const ins2 = insumos.find(x => x.id === v);
                          setFichaItens(prev => prev.map((it, idx) => idx === i ? { ...it, insumoId: v, unidadeMedida: ins2?.unidadeMedida || 'kg' } : it));
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Insumo..." /></SelectTrigger>
                          <SelectContent>{insumos.map(ins2 => <SelectItem key={ins2.id} value={ins2.id}>{ins2.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Input className="h-8 text-xs" type="number" step="0.001" placeholder="Qtd" value={item.quantidade || ''} onChange={e => setFichaItens(prev => prev.map((it, idx) => idx === i ? { ...it, quantidade: Number(e.target.value) } : it))} />
                      <Input className="h-8 text-xs" placeholder="Un" value={item.unidadeMedida} onChange={e => setFichaItens(prev => prev.map((it, idx) => idx === i ? { ...it, unidadeMedida: e.target.value } : it))} />
                      <div className="text-xs text-gray-600">{formatMoeda(custo)}</div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFichaItens(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                  );
                })}
                {fichaItens.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-4">Adicione os ingredientes da receita</p>
                )}
              </div>
            </div>

            {fichaItens.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-blue-800">Custo Total da Ficha</p>
                  <p className="text-xs text-blue-600">Para {fichaForm.rendimento} {fichaForm.unidadeRendimento}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-800">{formatMoeda(calcularCustoPorcao())}</p>
                  <p className="text-xs text-blue-600">
                    {formatMoeda(calcularCustoPorcao() / fichaForm.rendimento)} por {fichaForm.unidadeRendimento}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFichaDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedProduto) return;
                saveFicha.mutate({
                  produtoId: selectedProduto,
                  ...fichaForm,
                  itens: fichaItens.filter(i => i.insumoId),
                });
              }}
              disabled={saveFicha.isPending || fichaItens.length === 0}
            >
              Salvar Ficha Técnica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
