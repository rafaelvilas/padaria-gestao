import { useState, useRef } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { formatMoeda, formatData } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, XCircle, AlertTriangle, Banknote } from 'lucide-react';
import { toast } from 'sonner';

export function Financeiro() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), 'yyyy-MM-dd'));
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [ofxContent, setOfxContent] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: extrato = [], refetch: refetchExtrato } = trpc.financeiro.getExtrato.useQuery({ dataInicio, dataFim });
  const { data: boletos = [], refetch: refetchBoletos } = trpc.financeiro.getBoletos.useQuery({ dataInicio, dataFim });
  const { data: fluxo } = trpc.financeiro.getFluxoCaixa.useQuery({ dataInicio, dataFim });

  const importarOFX = trpc.financeiro.importarOFX.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.inseridas} transações importadas, ${data.conciliadosAuto} conciliadas automaticamente`);
      setImportPreview(null);
      setOfxContent('');
      refetchExtrato();
    },
    onError: (e) => toast.error(e.message),
  });

  const conciliarManual = trpc.financeiro.conciliarManual.useMutation({
    onSuccess: () => { toast.success('Conciliado!'); refetchExtrato(); refetchBoletos(); },
    onError: (e) => toast.error(e.message),
  });

  const confirmarSugestao = trpc.financeiro.confirmarSugestao.useMutation({
    onSuccess: () => { toast.success('Sugestão confirmada!'); refetchExtrato(); refetchBoletos(); },
    onError: (e) => toast.error(e.message),
  });

  const ignorarExtrato = trpc.financeiro.ignorarExtrato.useMutation({
    onSuccess: () => { toast.success('Marcado como sem documento'); refetchExtrato(); },
    onError: (e) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setOfxContent(content);
      // Preview: contar transações
      const count = (content.match(/<STMTTRN>/g) || []).length;
      setImportPreview(`Arquivo: ${file.name} · ${count} transações encontradas`);
    };
    reader.readAsText(file, 'latin1');
  }

  const pendentes = extrato.filter(e => e.statusConciliacao === 'pendente');
  const boletosAbertos = boletos.filter(b => b.status === 'aberto');
  const hojeStr = format(hoje, 'yyyy-MM-dd');
  const boletosVencidos = boletos.filter(b => b.status === 'vencido' || (b.status === 'aberto' && b.dataVencimento < hojeStr));

  const statusBoletoVariant = (status: string) => {
    if (status === 'pago' || status === 'conciliado') return 'success' as const;
    if (status === 'vencido') return 'danger' as const;
    if (status === 'aberto') return 'warning' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Boletos, extrato bancário e conciliação</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={boletosVencidos.length > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Boletos Vencidos</p>
            <p className={`text-2xl font-bold ${boletosVencidos.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {boletosVencidos.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Total a Pagar (abertos)</p>
            <p className="text-2xl font-bold">
              {formatMoeda(boletosAbertos.reduce((acc, b) => acc + Number(b.valor), 0))}
            </p>
          </CardContent>
        </Card>
        <Card className={pendentes.length > 5 ? 'border-yellow-200 bg-yellow-50' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Pendentes Conciliação</p>
            <p className={`text-2xl font-bold ${pendentes.length > 5 ? 'text-yellow-600' : 'text-gray-800'}`}>
              {pendentes.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Saldo Período</p>
            <p className={`text-2xl font-bold ${(fluxo?.saldoPeriodo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoeda(fluxo?.saldoPeriodo || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="boletos">
        <TabsList>
          <TabsTrigger value="boletos">Boletos</TabsTrigger>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="conciliacao">
            Conciliação
            {pendentes.length > 0 && (
              <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendentes.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        {/* Boletos Tab */}
        <TabsContent value="boletos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletos.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nenhum boleto no período</TableCell></TableRow>
                  ) : boletos.map((b) => (
                    <TableRow key={b.id} className={b.status === 'aberto' && b.dataVencimento < hojeStr ? 'bg-red-50' : ''}>
                      <TableCell>{(b as any).fornecedor?.nomeFantasia || (b as any).fornecedor?.razaoSocial}</TableCell>
                      <TableCell className="font-mono font-medium">{formatMoeda(b.valor)}</TableCell>
                      <TableCell>{formatData(b.dataVencimento)}</TableCell>
                      <TableCell>{b.dataPagamento ? formatData(b.dataPagamento) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusBoletoVariant(b.status || 'aberto')}>
                          {b.status === 'conciliado' ? 'Conciliado' : b.status === 'pago' ? 'Pago' : b.status === 'vencido' ? 'Vencido' : b.status === 'cancelado' ? 'Cancelado' : 'Aberto'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extrato Tab */}
        <TabsContent value="extrato">
          <div className="space-y-4">
            {/* Import OFX */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-gray-700">Importar Extrato OFX</p>
                    <p className="text-sm text-gray-500">Arquivo OFX do Sicoob ou outro banco</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={handleFileChange} />
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                  {importPreview && (
                    <>
                      <span className="text-sm text-gray-600">{importPreview}</span>
                      <Button onClick={() => importarOFX.mutate({ conteudo: ofxContent })} disabled={importarOFX.isPending}>
                        {importarOFX.isPending ? 'Importando...' : 'Confirmar Importação'}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Conciliação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extrato.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nenhuma transação no período</TableCell></TableRow>
                    ) : extrato.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{formatData(e.dataTransacao)}</TableCell>
                        <TableCell className="max-w-xs truncate">{e.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={e.tipo === 'credito' ? 'success' : 'danger'}>
                            {e.tipo === 'credito' ? 'Crédito' : 'Débito'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`font-mono font-medium ${e.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {e.tipo === 'credito' ? '+' : '-'}{formatMoeda(e.valor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={e.statusConciliacao === 'conciliado' ? 'success' : e.statusConciliacao === 'sem_documento' ? 'secondary' : 'warning'}>
                            {e.statusConciliacao === 'conciliado' ? 'Conciliado' : e.statusConciliacao === 'sem_documento' ? 'Sem doc.' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Conciliação Tab */}
        <TabsContent value="conciliacao">
          <div className="space-y-3">
            {pendentes.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-400">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                  <p>Todas as transações estão conciliadas!</p>
                </CardContent>
              </Card>
            ) : pendentes.map((e) => {
              const sugestoes = (e as any).sugestoes || [];
              return (
                <Card key={e.id} className="border-yellow-200">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{formatData(e.dataTransacao)}</span>
                          <Badge variant="danger">Débito</Badge>
                          <span className="font-bold text-red-600">-{formatMoeda(e.valor)}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{e.descricao}</p>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[280px]">
                        {sugestoes.length > 0 ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-blue-700 mb-2">Sugestão de conciliação:</p>
                            {sugestoes.map((sug: any) => (
                              <div key={sug.id} className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{sug.fornecedor?.nomeFantasia}</p>
                                  <p className="text-xs text-gray-500">Venc: {formatData(sug.dataVencimento)} · {formatMoeda(sug.valor)}</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" onClick={() => confirmarSugestao.mutate({ extratoId: e.id, boletoId: sug.id })}>
                                    <CheckCircle className="w-3 h-3 mr-1" />OK
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => ignorarExtrato.mutate(e.id)}>
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Select onValueChange={(boletoId) => conciliarManual.mutate({ extratoId: e.id, boletoId })}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Selecionar boleto..." />
                              </SelectTrigger>
                              <SelectContent>
                                {boletosAbertos.map(b => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {(b as any).fornecedor?.nomeFantasia} · {formatMoeda(b.valor)} · {formatData(b.dataVencimento)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={() => ignorarExtrato.mutate(e.id)}>
                              Ignorar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Fluxo de Caixa Tab */}
        <TabsContent value="fluxo">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Total Créditos</p>
                <p className="text-2xl font-bold text-green-600">{formatMoeda(fluxo?.totalCreditos || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Total Débitos</p>
                <p className="text-2xl font-bold text-red-600">{formatMoeda(fluxo?.totalDebitos || 0)}</p>
              </CardContent>
            </Card>
            <Card className={(fluxo?.saldoPeriodo || 0) >= 0 ? 'border-green-200' : 'border-red-200'}>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Saldo</p>
                <p className={`text-2xl font-bold ${(fluxo?.saldoPeriodo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMoeda(fluxo?.saldoPeriodo || 0)}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Débitos</TableHead>
                    <TableHead>Saldo Dia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fluxo?.porDia || []).map((dia) => (
                    <TableRow key={dia.data}>
                      <TableCell>{formatData(dia.data)}</TableCell>
                      <TableCell className="text-green-600 font-mono">{dia.creditos > 0 ? formatMoeda(dia.creditos) : '-'}</TableCell>
                      <TableCell className="text-red-600 font-mono">{dia.debitos > 0 ? formatMoeda(dia.debitos) : '-'}</TableCell>
                      <TableCell className={`font-mono font-medium ${(dia.creditos - dia.debitos) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatMoeda(dia.creditos - dia.debitos)}
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
