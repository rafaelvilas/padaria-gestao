import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { alertas, estoque, insumos, boletos, extratoBancario, cuponsFiscais, inventarios, notasFiscais, itensCotacao, itensNf, fornecedores } from '../db/schema';
import { eq, and, gte, lte, lt, ne, desc } from 'drizzle-orm';

async function runAlertas() {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const alertasNovos: Array<{
    tipo: string;
    criticidade: 'baixa' | 'media' | 'alta' | 'critica';
    titulo: string;
    mensagem: string;
    referenciaTipo?: string;
    referenciaId?: string;
  }> = [];

  // Helper para verificar duplicata
  async function naoExisteAlerta(tipo: string, referenciaId?: string) {
    const conditions: ReturnType<typeof eq>[] = [
      eq(alertas.tipo, tipo),
      eq(alertas.status, 'ativo'),
    ];
    if (referenciaId) conditions.push(eq(alertas.referenciaId as never, referenciaId));
    const existente = await db.query.alertas.findFirst({ where: and(...conditions) });
    return !existente;
  }

  // 1. Estoque crítico (abaixo do mínimo)
  const estoqueItems = await db.query.estoque.findMany();
  for (const e of estoqueItems) {
    const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, e.insumoId) });
    if (!insumo) continue;
    const qtdAtual = Number(e.quantidadeAtual);
    const estoqueMin = Number(insumo.estoqueMinimo || 0);
    if (qtdAtual <= estoqueMin && estoqueMin > 0) {
      if (await naoExisteAlerta('estoque_critico', e.insumoId)) {
        alertasNovos.push({
          tipo: 'estoque_critico',
          criticidade: qtdAtual === 0 ? 'critica' : 'alta',
          titulo: `Estoque crítico: ${insumo.nome}`,
          mensagem: `Estoque atual (${qtdAtual} ${insumo.unidadeMedida}) abaixo do mínimo (${estoqueMin} ${insumo.unidadeMedida})`,
          referenciaTipo: 'insumo',
          referenciaId: e.insumoId,
        });
      }
    }
  }

  // 2. Boletos vencidos
  const boletosVencidos = await db.query.boletos.findMany({
    where: and(eq(boletos.status, 'aberto'), lt(boletos.dataVencimento, hojeStr)),
  });
  for (const b of boletosVencidos) {
    const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, b.fornecedorId) });
    if (await naoExisteAlerta('boleto_vencido', b.id)) {
      alertasNovos.push({
        tipo: 'boleto_vencido',
        criticidade: 'alta',
        titulo: `Boleto vencido: ${forn?.nomeFantasia || forn?.razaoSocial}`,
        mensagem: `Boleto de R$ ${Number(b.valor).toFixed(2)} venceu em ${b.dataVencimento}`,
        referenciaTipo: 'boleto',
        referenciaId: b.id,
      });
    }
  }

  // 3. Extrato sem documento (pendente há mais de 7 dias)
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const semDocumento = await db.query.extratoBancario.findMany({
    where: and(
      eq(extratoBancario.statusConciliacao, 'pendente'),
      eq(extratoBancario.tipo, 'debito'),
      lt(extratoBancario.dataTransacao, seteDiasAtras)
    ),
  });
  if (semDocumento.length > 0) {
    if (await naoExisteAlerta('pagamentos_nao_identificados')) {
      alertasNovos.push({
        tipo: 'pagamentos_nao_identificados',
        criticidade: 'media',
        titulo: `${semDocumento.length} pagamentos não identificados`,
        mensagem: `Existem ${semDocumento.length} débitos no extrato sem documento vinculado há mais de 7 dias`,
      });
    }
  }

  // 4. Inventário semanal não realizado (segunda-feira)
  const diaSemana = hoje.getDay();
  if (diaSemana === 1) {
    const inicioDaSemana = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const inventarioSemana = await db.query.inventarios.findFirst({
      where: and(
        gte(inventarios.dataContagem, inicioDaSemana),
        lte(inventarios.dataContagem, hojeStr)
      ),
    });
    if (!inventarioSemana) {
      if (await naoExisteAlerta('inventario_pendente')) {
        alertasNovos.push({
          tipo: 'inventario_pendente',
          criticidade: 'alta',
          titulo: 'Inventário semanal não realizado',
          mensagem: 'O inventário semanal de estoque ainda não foi realizado nesta semana',
        });
      }
    }
  }

  // 5. Compras acima do preço cotado em > 10%
  const nfsRecentes = await db.query.notasFiscais.findMany({
    where: gte(notasFiscais.dataEmissao, seteDiasAtras),
  });
  for (const nf of nfsRecentes) {
    if (!nf.cotacaoId) continue;
    const itensNfData = await db.query.itensNf.findMany({ where: eq(itensNf.nfId, nf.id) });
    const itensCotacaoData = await db.query.itensCotacao.findMany({ where: eq(itensCotacao.cotacaoId, nf.cotacaoId) });

    for (const itemNf of itensNfData) {
      if (!itemNf.insumoId) continue;
      const itemCot = itensCotacaoData.find(ic => ic.insumoId === itemNf.insumoId);
      if (!itemCot) continue;

      const precoCotado = Number(itemCot.precoUnitario);
      const precoCompra = Number(itemNf.precoUnitario);
      const variacao = precoCotado > 0 ? ((precoCompra - precoCotado) / precoCotado) * 100 : 0;

      if (variacao > 10) {
        if (await naoExisteAlerta('compra_acima_cotacao', nf.id)) {
          alertasNovos.push({
            tipo: 'compra_acima_cotacao',
            criticidade: 'media',
            titulo: `Compra acima da cotação: NF ${nf.numeroNf}`,
            mensagem: `Item com variação de ${variacao.toFixed(1)}% acima do preço cotado`,
            referenciaTipo: 'nota_fiscal',
            referenciaId: nf.id,
          });
        }
      }
    }
  }

  // Salvar alertas novos
  if (alertasNovos.length > 0) {
    await db.insert(alertas).values(alertasNovos);
  }

  return alertasNovos.length;
}

export const alertasRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(['ativo', 'lido', 'resolvido', 'ignorado']).optional(),
      criticidade: z.enum(['baixa', 'media', 'alta', 'critica']).optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(alertas.status, input.status));
      if (input?.criticidade) conditions.push(eq(alertas.criticidade, input.criticidade));

      return await db.query.alertas.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(alertas.criadoEm)],
      });
    }),

  getCount: publicProcedure
    .query(async () => {
      const ativos = await db.query.alertas.findMany({ where: eq(alertas.status, 'ativo') });
      const criticos = ativos.filter(a => a.criticidade === 'critica').length;
      const altos = ativos.filter(a => a.criticidade === 'alta').length;
      const medios = ativos.filter(a => a.criticidade === 'media').length;
      const baixos = ativos.filter(a => a.criticidade === 'baixa').length;
      return { total: ativos.length, criticos, altos, medios, baixos };
    }),

  marcarLido: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.update(alertas)
        .set({ status: 'lido', lidoEm: new Date() })
        .where(eq(alertas.id, input));
      return { success: true };
    }),

  resolver: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.update(alertas)
        .set({ status: 'resolvido' })
        .where(eq(alertas.id, input));
      return { success: true };
    }),

  ignorar: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.update(alertas)
        .set({ status: 'ignorado' })
        .where(eq(alertas.id, input));
      return { success: true };
    }),

  run: publicProcedure
    .mutation(async () => {
      const novos = await runAlertas();
      return { novosAlertas: novos };
    }),
});
