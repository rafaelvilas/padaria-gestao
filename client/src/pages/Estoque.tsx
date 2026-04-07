import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatData } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Package, ClipboardList, TrendingUp, Plus, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function Estoque() {
  const [search, setSearch] = useState('');
  const [contagemAtual, setContagemAtual] = useState<Record<string, number>>({});

  const { data: saldo = [], refetch: refetchSaldo } = trpc.estoque.getSaldo.useQuery();
  const { data: inventarios = [], refetch: refetchInv } = trpc.estoque.getInventarios.useQuery();
  const { data: giro = [] } = trpc.estoque.getGiro.useQuery();
  const { data: inventarioAtivo } = trpc.estoque.getInventarioById.useQuery(
    inventarios.find(i => i.status === 'em_andamento')?.id || '',
    { enabled: !!inventarios.find(i => i.status === 'em_andamento') }
  );

  const criarInventario = trpc.estoque.criarInventario.useMutation({
    onSuccess: () => { toast.success('Inventário iniciado!'); refetchInv(); },
    onError: (e) => toast.error(e.message),
  });

  const lancarContagem = trpc.estoque.lancarContagem.useMutation({
    onSuccess: () => toast.success('Contagem registrada!'),
    onError: (e) => toast.error(e.message),
  });

  const finalizarInventario = trpc.estoque.finalizarInventario.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventário finalizado! ${data.totalDivergencias} divergências encontradas.`);
      refetchInv();
      refetchSaldo();
      setContagemAtual({});
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredSaldo = saldo.filter(e =>
    (e.insumo?.nome || '').toLowerCase().includes(search.toLowerCase())
  );

  const itensCriticos = saldo.filter(e => e.critico).length;
  const valorTotalEstoque = saldo.reduce((acc, e) => acc + (e.valorTotal || 0), 0);

  function handleSalvarContagem() {
    if (!inventarioAtivo) return;
    const itens = Object.entries(contagemAtual).map(([itemId, quantidadeContada]) => ({
      itemId,
      quantidadeContada,
    }));
    if (itens.length === 0) { toast.error('Nenhuma contagem registrada'); return; }
    lancarContagem.mutate({ inventarioId: inventarioAtivo.id, itens });
  }

  function handleFinalizarInventario() {
    if (!inventarioAtivo) return;
    // Salvar contagens primeiro
    const itens = Object.entries(contagemAtual).map(([itemId, quantidadeContada]) => ({
      itemId,
      quantidadeContada,
    }));
    if (itens.length > 0) {
      lancarContagem.mutate(
        { inventarioId: inventarioAtivo.id, itens },
        { onSuccess: () => finalizarInventario.mutate(inventarioAtivo.id) }
      );
    } else {
      finalizarInventario.mutate(inventarioAtivo.id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">
            {itensCriticos > 0 && <span className="text-red-600 font-medium">{itensCriticos} itens críticos · </span>}
            Valor total: {formatMoeda(valorTotalEstoque)}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Total Itens</p>
            <p className="text-2xl font-bold">{saldo.length}</p>
          </CardContent>
        </Card>
        <Card className={itensCriticos > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Itens Críticos</p>
            <p className={`text-2xl font-bold ${itensCriticos > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {itensCriticos}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Valor Total</p>
            <p className="text-2xl font-bold">{formatMoeda(valorTotalEstoque)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Inventários</p>
            <p className="text-2xl font-bold">{inventarios.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="saldo">
        <TabsList>
          <TabsTrigger value="saldo">Saldo</TabsTrigger>
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="giro">Giro</TabsTrigger>
        </TabsList>

        {/* Saldo Tab */}
        <TabsContent value="saldo">
          <Card>
            <CardHeader className="pb-3">
              <Input
                placeholder="Buscar insumo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Qtd Atual</TableHead>
                    <TableHead>Qtd Teórica</TableHead>
                    <TableHead>Divergência</TableHead>
                    <TableHead>Custo Médio</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSaldo.map((e) => (
                    <TableRow key={e.id} className={e.critico ? 'bg-red-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{e.insumo?.nome}</p>
                          <p className="text-xs text-gray-500">{e.categoria?.nome}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {Number(e.quantidadeAtual).toFixed(3)} {e.insumo?.unidadeMedida}
                      </TableCell>
                      <TableCell className="font-mono text-gray-500">
                        {Number(e.quantidadeTeorica).toFixed(3)}
                      </TableCell>
                      <TableCell>
                        <span className={e.divergencia < 0 ? 'text-red-600 font-medium' : e.divergencia > 0 ? 'text-green-600' : 'text-gray-500'}>
                          {e.divergencia >= 0 ? '+' : ''}{e.divergencia?.toFixed(3)}
                        </span>
                      </TableCell>
                      <TableCell>{formatMoeda(e.custoMedio)}</TableCell>
                      <TableCell>{formatMoeda(e.valorTotal)}</TableCell>
                      <TableCell>
                        {e.critico
                          ? <Badge variant="danger">Crítico</Badge>
                          : <Badge variant="success">OK</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventário Tab */}
        <TabsContent value="inventario">
          <div className="space-y-4">
            {!inventarioAtivo && (
              <div className="flex justify-between items-center">
                <p className="text-gray-600">Nenhum inventário em andamento</p>
                <Button onClick={() => criarInventario.mutate({
                  dataContagem: new Date().toISOString().split('T')[0],
                })} disabled={criarInventario.isPending}>
                  <Plus className="w-4 h-4 mr-2" />
                  Iniciar Contagem Semanal
                </Button>
              </div>
            )}

            {inventarioAtivo && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Inventário em Andamento - {formatData(inventarioAtivo.dataContagem)}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleSalvarContagem} disabled={lancarContagem.isPending}>
                        Salvar Contagem
                      </Button>
                      <Button onClick={handleFinalizarInventario} disabled={finalizarInventario.isPending}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Finalizar Inventário
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead>Qtd Teórica</TableHead>
                        <TableHead>Qtd Contada</TableHead>
                        <TableHead>Divergência</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(inventarioAtivo.itens || []).map((item) => {
                        const contado = contagemAtual[item.id];
                        const teorica = Number(item.quantidadeTeorica || 0);
                        const div = contado !== undefined ? contado - teorica : Number(item.divergencia || 0);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.insumo?.nome}</TableCell>
                            <TableCell className="font-mono">{teorica.toFixed(3)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.001"
                                className="w-28 h-8"
                                placeholder={item.quantidadeContada ? String(item.quantidadeContada) : '0'}
                                value={contado !== undefined ? contado : (item.quantidadeContada || '')}
                                onChange={e => setContagemAtual(c => ({ ...c, [item.id]: Number(e.target.value) }))}
                              />
                            </TableCell>
                            <TableCell>
                              {contado !== undefined && (
                                <span className={div < 0 ? 'text-red-600 font-medium' : div > 0 ? 'text-green-600' : 'text-gray-500'}>
                                  {div >= 0 ? '+' : ''}{div.toFixed(3)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.statusAjuste === 'ajustado' ? 'success' : item.statusAjuste === 'ignorado' ? 'secondary' : 'warning'}>
                                {item.statusAjuste === 'ajustado' ? 'Ajustado' : item.statusAjuste === 'ignorado' ? 'Ignorado' : 'Pendente'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Histórico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Inventários</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Divergências</TableHead>
                      <TableHead>Valor Divergência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventarios.filter(i => i.status !== 'em_andamento').map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{formatData(inv.dataContagem)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'finalizado' ? 'success' : 'secondary'}>
                            {inv.status === 'finalizado' ? 'Finalizado' : inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{inv.totalDivergencias}</TableCell>
                        <TableCell>{formatMoeda(inv.valorDivergencia)}</TableCell>
                      </TableRow>
                    ))}
                    {inventarios.filter(i => i.status !== 'em_andamento').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-6">Nenhum inventário finalizado</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Giro Tab */}
        <TabsContent value="giro">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Qtd Atual</TableHead>
                    <TableHead>Consumo 30d</TableHead>
                    <TableHead>Consumo Diário</TableHead>
                    <TableHead>Giro</TableHead>
                    <TableHead>Dias Cobertura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {giro.sort((a, b) => (a.diasCobertura || 999) - (b.diasCobertura || 999)).map((g) => (
                    <TableRow key={g.insumoId} className={g.diasCobertura < 7 ? 'bg-red-50' : g.diasCobertura < 14 ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-medium">{g.insumo?.nome}</TableCell>
                      <TableCell className="font-mono">{g.quantidadeAtual.toFixed(3)}</TableCell>
                      <TableCell className="font-mono">{g.consumo30d.toFixed(3)}</TableCell>
                      <TableCell className="font-mono">{g.consumoDiario.toFixed(3)}</TableCell>
                      <TableCell className="font-mono">{g.giro.toFixed(2)}x</TableCell>
                      <TableCell>
                        <span className={g.diasCobertura < 7 ? 'text-red-600 font-bold' : g.diasCobertura < 14 ? 'text-yellow-600 font-medium' : 'text-green-600'}>
                          {g.diasCobertura >= 999 ? '∞' : `${Math.round(g.diasCobertura)}d`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
