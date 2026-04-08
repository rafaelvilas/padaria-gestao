import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatPercentual } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Edit, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIA_ORDER = ['PADARIA', 'CAFÉ', 'CONFEITARIA', 'SALGADOS', 'COZINHA', 'EXECUTIVO', 'PIZZARIA', 'BAR'];

export function FichasTecnicas() {
  const [selectedProduto, setSelectedProduto] = useState<string | null>(null);
  const [fichaDialogOpen, setFichaDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [fichaForm, setFichaForm] = useState({
    rendimento: 1,
    unidadeRendimento: 'un',
    cmvAlvo: '' as string | number,
    observacoes: '',
  });
  const [fichaItens, setFichaItens] = useState<Array<{
    insumoId: string;
    quantidade: number;
    unidadeMedida: string;
    fatorPerda: number;
  }>>([]);

  const { data: produtos = [], refetch } = trpc.fichasTecnicas.listProdutos.useQuery();
  const { data: insumos = [] } = trpc.fichasTecnicas.listInsumos.useQuery();
  const { data: ficha } = trpc.fichasTecnicas.getFicha.useQuery(
    selectedProduto || '',
    { enabled: !!selectedProduto }
  );

  // Pré-popula o formulário quando a ficha existente é carregada
  useEffect(() => {
    if (ficha && fichaDialogOpen) {
      setFichaForm({
        rendimento: Number(ficha.rendimento ?? 1),
        unidadeRendimento: ficha.unidadeRendimento ?? 'un',
        cmvAlvo: ficha.cmvAlvo != null ? Number(ficha.cmvAlvo) : '',
        observacoes: ficha.observacoes ?? '',
      });
      setFichaItens(
        (ficha.itens ?? []).map((it: any) => ({
          insumoId: it.insumoId,
          quantidade: Number(it.quantidade),
          unidadeMedida: it.unidadeMedida,
          fatorPerda: Number(it.fatorPerda ?? 0),
        }))
      );
    }
  }, [ficha, fichaDialogOpen]);

  const saveFicha = trpc.fichasTecnicas.saveFicha.useMutation({
    onSuccess: () => { toast.success('Ficha técnica salva!'); refetch(); setFichaDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  // Agrupamento por categoria
  const categorias = Array.from(
    new Map(produtos.map(p => [p.categoriaId ?? 'sem-cat', (p as any).categoria?.nome ?? 'Sem Categoria']))
  ).sort(([, a], [, b]) => {
    const ai = CATEGORIA_ORDER.indexOf(a.toUpperCase());
    const bi = CATEGORIA_ORDER.indexOf(b.toUpperCase());
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const filtered = produtos.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'todos' || (p as any).categoria?.nome === activeTab;
    return matchSearch && matchTab;
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  function openFichaDialog(produtoId: string) {
    setSelectedProduto(produtoId);
    // Limpa o form enquanto carrega; o useEffect preenche ao receber ficha
    setFichaItens([]);
    setFichaForm({ rendimento: 1, unidadeRendimento: 'un', cmvAlvo: '', observacoes: '' });
    setFichaDialogOpen(true);
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────

  function custoItem(item: { insumoId: string; quantidade: number; fatorPerda: number }) {
    const ins = insumos.find(i => i.id === item.insumoId);
    const custoUnit = Number(ins?.custoMedio ?? 0);
    return item.quantidade * custoUnit * (1 + item.fatorPerda);
  }

  const custoTotalFicha = fichaItens.reduce((acc, it) => acc + custoItem(it), 0);
  const rendimento = Number(fichaForm.rendimento) || 1;
  const custoPorPorcao = custoTotalFicha / rendimento;

  const produtoSelecionado = produtos.find(p => p.id === selectedProduto);
  const precoVenda = Number(produtoSelecionado?.precoVenda ?? 0);
  const cmvRealPct = precoVenda > 0 ? (custoPorPorcao / precoVenda) * 100 : 0;
  const cmvAlvoNum = fichaForm.cmvAlvo !== '' ? Number(fichaForm.cmvAlvo) : null;
  const desvioAbs = cmvAlvoNum != null ? cmvRealPct - cmvAlvoNum : null;

  const totalComFicha = produtos.filter(p => p.temFichaTecnica).length;
  const showGrouped = activeTab === 'todos' && !search;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-500 text-sm mt-1">{totalComFicha} de {produtos.length} produtos com ficha</p>
        </div>
        <div className="relative max-w-sm">
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="todos">Todos ({produtos.length})</TabsTrigger>
          {categorias.map(([catId, catNome]) => {
            const count = produtos.filter(p => (p as any).categoria?.nome === catNome).length;
            return (
              <TabsTrigger key={catId} value={catNome}>
                {catNome} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {showGrouped ? (
            <div className="space-y-8">
              {categorias.map(([catId, catNome]) => {
                const catProdutos = produtos
                  .filter(p => (p as any).categoria?.nome === catNome)
                  .sort((a, b) => a.nome.localeCompare(b.nome));
                return (
                  <div key={catId}>
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="text-lg font-bold text-gray-800">{catNome}</h2>
                      <span className="text-sm text-gray-400">{catProdutos.length} produtos</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <ProdutoGrid produtos={catProdutos} onOpen={openFichaDialog} />
                  </div>
                );
              })}
            </div>
          ) : (
            <ProdutoGrid produtos={filtered} onOpen={openFichaDialog} />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog Ficha Técnica ───────────────────────────────────────────── */}
      <Dialog open={fichaDialogOpen} onOpenChange={setFichaDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Ficha Técnica — {produtoSelecionado?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">

            {/* ── Rendimento + CMV Alvo ─── */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Rendimento</Label>
                <Input
                  type="number" min={0.001} step="0.001"
                  value={fichaForm.rendimento}
                  onChange={e => setFichaForm(f => ({ ...f, rendimento: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input
                  value={fichaForm.unidadeRendimento}
                  onChange={e => setFichaForm(f => ({ ...f, unidadeRendimento: e.target.value }))}
                  placeholder="un, kg, L..."
                />
              </div>
              <div>
                <Label>CMV Alvo (%)</Label>
                <Input
                  type="number" min={0} max={100} step="0.1"
                  placeholder="ex: 28"
                  value={fichaForm.cmvAlvo}
                  onChange={e => setFichaForm(f => ({ ...f, cmvAlvo: e.target.value === '' ? '' : Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Preço de Venda</Label>
                <Input value={formatMoeda(precoVenda)} readOnly className="bg-gray-50 text-gray-600" />
              </div>
            </div>

            <Separator />

            {/* ── Ingredientes ─────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Ingredientes</Label>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setFichaItens(prev => [...prev, { insumoId: '', quantidade: 0, unidadeMedida: 'kg', fatorPerda: 0 }])}
                >
                  <Plus className="w-3 h-3 mr-1" />Adicionar
                </Button>
              </div>

              {/* Cabeçalho da tabela */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 mb-1 px-2">
                <span>Insumo</span>
                <span>Qtd</span>
                <span>Unid.</span>
                <span className="text-right">Preço/Kg•Un</span>
                <span className="text-right">% Perda</span>
                <span className="text-right">Custo</span>
                <span />
              </div>

              <div className="space-y-1">
                {fichaItens.map((item, i) => {
                  const ins = insumos.find(x => x.id === item.insumoId);
                  const custoUnit = Number(ins?.custoMedio ?? 0);
                  const custo = custoItem(item);
                  const pctDoCusto = custoTotalFicha > 0 ? (custo / custoTotalFicha) * 100 : 0;

                  return (
                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-gray-50 px-2 py-1.5 rounded">
                      <Select value={item.insumoId} onValueChange={v => {
                        const ins2 = insumos.find(x => x.id === v);
                        setFichaItens(prev => prev.map((it, idx) => idx === i
                          ? { ...it, insumoId: v, unidadeMedida: ins2?.unidadeMedida || 'kg' }
                          : it));
                      }}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {insumos.map(ins2 => (
                            <SelectItem key={ins2.id} value={ins2.id}>
                              {ins2.nome} — {formatMoeda(Number(ins2.custoMedio))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        className="h-7 text-xs" type="number" step="0.001" min={0}
                        placeholder="0"
                        value={item.quantidade || ''}
                        onChange={e => setFichaItens(prev => prev.map((it, idx) => idx === i ? { ...it, quantidade: Number(e.target.value) } : it))}
                      />
                      <Input
                        className="h-7 text-xs" placeholder="Un"
                        value={item.unidadeMedida}
                        onChange={e => setFichaItens(prev => prev.map((it, idx) => idx === i ? { ...it, unidadeMedida: e.target.value } : it))}
                      />
                      <div className="text-xs text-right text-gray-500">
                        {custoUnit > 0 ? formatMoeda(custoUnit) : '—'}
                      </div>
                      <Input
                        className="h-7 text-xs text-right" type="number" step="0.01" min={0} max={1}
                        placeholder="0"
                        value={item.fatorPerda || ''}
                        onChange={e => setFichaItens(prev => prev.map((it, idx) => idx === i ? { ...it, fatorPerda: Number(e.target.value) } : it))}
                      />
                      <div className="text-xs text-right font-medium text-gray-800">
                        <div>{formatMoeda(custo)}</div>
                        {pctDoCusto > 0 && <div className="text-gray-400">{pctDoCusto.toFixed(1)}%</div>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFichaItens(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                  );
                })}

                {fichaItens.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-6">Adicione os ingredientes da receita</p>
                )}
              </div>
            </div>

            {fichaItens.length > 0 && (
              <>
                <Separator />

                {/* ── Painel de totais ─────────── */}
                <div className="grid grid-cols-2 gap-4">

                  {/* Custos */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Custos</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Custo total da ficha</span>
                      <span className="font-bold text-gray-900">{formatMoeda(custoTotalFicha)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Rendimento</span>
                      <span className="font-medium">{rendimento} {fichaForm.unidadeRendimento}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                      <span className="text-gray-600 font-medium">Custo por {fichaForm.unidadeRendimento}</span>
                      <span className="font-bold text-blue-700 text-base">{formatMoeda(custoPorPorcao)}</span>
                    </div>
                  </div>

                  {/* CMV */}
                  <div className={`rounded-lg p-4 space-y-2 ${
                    desvioAbs == null ? 'bg-gray-50' :
                    desvioAbs <= 0 ? 'bg-green-50 border border-green-200' :
                    desvioAbs <= 3 ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-red-50 border border-red-200'
                  }`}>
                    <p className="text-sm font-semibold text-gray-700">CMV</p>
                    {precoVenda > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Preço de venda</span>
                        <span className="font-medium">{formatMoeda(precoVenda)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">CMV calculado</span>
                      <span className={`font-bold text-base ${cmvRealPct > 40 ? 'text-red-600' : cmvRealPct > 32 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {precoVenda > 0 ? `${cmvRealPct.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    {cmvAlvoNum != null && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">CMV alvo</span>
                          <span className="font-medium">{cmvAlvoNum.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2 mt-2 items-center">
                          <span className="text-gray-600 font-medium">Desvio</span>
                          <div className="flex items-center gap-1">
                            {desvioAbs! <= 0
                              ? <CheckCircle className="w-4 h-4 text-green-500" />
                              : desvioAbs! <= 3
                              ? <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              : <TrendingUp className="w-4 h-4 text-red-500" />
                            }
                            <span className={`font-bold ${desvioAbs! <= 0 ? 'text-green-600' : desvioAbs! <= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {desvioAbs! >= 0 ? '+' : ''}{desvioAbs!.toFixed(1)}pp
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setFichaDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedProduto) return;
                saveFicha.mutate({
                  produtoId: selectedProduto,
                  rendimento: fichaForm.rendimento,
                  unidadeRendimento: fichaForm.unidadeRendimento,
                  cmvAlvo: fichaForm.cmvAlvo !== '' ? Number(fichaForm.cmvAlvo) : undefined,
                  observacoes: fichaForm.observacoes || undefined,
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

// ── Grid de produtos ─────────────────────────────────────────────────────────

type Produto = {
  id: string;
  nome: string;
  precoVenda: string | null;
  temFichaTecnica: boolean;
  categoria?: { nome: string } | null;
};

function ProdutoGrid({ produtos, onOpen }: { produtos: Produto[]; onOpen: (id: string) => void }) {
  if (produtos.length === 0) {
    return <p className="text-center text-gray-400 py-8">Nenhum produto encontrado</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-4">
      {produtos.map((p) => (
        <Card key={p.id} className={p.temFichaTecnica ? 'border-green-200' : 'border-gray-200'}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-3">
              <p className="font-semibold text-gray-800 text-sm leading-tight">{p.nome}</p>
              {p.temFichaTecnica
                ? <Badge variant="success" className="text-xs shrink-0 ml-2">Com ficha</Badge>
                : <Badge variant="secondary" className="text-xs shrink-0 ml-2">Sem ficha</Badge>
              }
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Preço venda: <span className="font-medium">{formatMoeda(Number(p.precoVenda || 0))}</span>
            </p>
            <Button
              variant={p.temFichaTecnica ? 'outline' : 'default'}
              size="sm"
              className="w-full"
              onClick={() => onOpen(p.id)}
            >
              {p.temFichaTecnica ? (
                <><Edit className="w-3 h-3 mr-1" />Ver / Editar</>
              ) : (
                <><Plus className="w-3 h-3 mr-1" />Criar Ficha</>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
