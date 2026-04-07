import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { notasFiscais, itensNf, boletos, estoque, movimentacoesEstoque, insumos, fornecedores } from '../db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export const comprasRouter = router({
  listNfs: publicProcedure
    .input(z.object({
      status: z.enum(['pendente', 'conciliada', 'cancelada']).optional(),
      fornecedorId: z.string().uuid().optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(notasFiscais.status, input.status));
      if (input?.fornecedorId) conditions.push(eq(notasFiscais.fornecedorId, input.fornecedorId));
      if (input?.dataInicio) conditions.push(gte(notasFiscais.dataEmissao, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(notasFiscais.dataEmissao, input.dataFim));

      const nfs = await db.query.notasFiscais.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(notasFiscais.dataEmissao)],
      });

      return await Promise.all(nfs.map(async (nf) => {
        const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, nf.fornecedorId) });
        const itens = await db.query.itensNf.findMany({ where: eq(itensNf.nfId, nf.id) });
        return { ...nf, fornecedor: forn, itens };
      }));
    }),

  getNfById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const nf = await db.query.notasFiscais.findFirst({ where: eq(notasFiscais.id, input) });
      if (!nf) return null;
      const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, nf.fornecedorId) });
      const itensData = await db.query.itensNf.findMany({ where: eq(itensNf.nfId, input) });
      const itensComInsumo = await Promise.all(itensData.map(async (i) => {
        const ins = i.insumoId ? await db.query.insumos.findFirst({ where: eq(insumos.id, i.insumoId) }) : null;
        return { ...i, insumo: ins };
      }));
      return { ...nf, fornecedor: forn, itens: itensComInsumo };
    }),

  createNf: publicProcedure
    .input(z.object({
      numeroNf: z.string(),
      serie: z.string().optional(),
      fornecedorId: z.string().uuid(),
      dataEmissao: z.string(),
      dataEntrada: z.string().optional(),
      valorTotal: z.number(),
      valorProdutos: z.number().optional(),
      valorImpostos: z.number().default(0),
      valorFrete: z.number().default(0),
      cotacaoId: z.string().uuid().optional(),
      chaveNfe: z.string().optional(),
      observacoes: z.string().optional(),
      itens: z.array(z.object({
        insumoId: z.string().uuid().optional(),
        descricaoNf: z.string(),
        codigoProdutoFornecedor: z.string().optional(),
        quantidade: z.number(),
        unidadeMedida: z.string().optional(),
        precoUnitario: z.number(),
        valorTotal: z.number(),
      })),
      boletos: z.array(z.object({
        valor: z.number(),
        dataVencimento: z.string(),
        dataEmissao: z.string().optional(),
        codigoBarras: z.string().optional(),
        nossoNumero: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      // 1. Inserir NF
      const [nf] = await db.insert(notasFiscais).values({
        numeroNf: input.numeroNf,
        serie: input.serie,
        fornecedorId: input.fornecedorId,
        dataEmissao: input.dataEmissao,
        dataEntrada: input.dataEntrada,
        valorTotal: String(input.valorTotal),
        valorProdutos: input.valorProdutos ? String(input.valorProdutos) : null,
        valorImpostos: String(input.valorImpostos),
        valorFrete: String(input.valorFrete),
        cotacaoId: input.cotacaoId,
        chaveNfe: input.chaveNfe,
        observacoes: input.observacoes,
      }).returning();

      // 2. Inserir itens da NF
      if (input.itens.length > 0) {
        await db.insert(itensNf).values(
          input.itens.map(i => ({
            nfId: nf.id,
            insumoId: i.insumoId,
            descricaoNf: i.descricaoNf,
            codigoProdutoFornecedor: i.codigoProdutoFornecedor,
            quantidade: String(i.quantidade),
            unidadeMedida: i.unidadeMedida,
            precoUnitario: String(i.precoUnitario),
            valorTotal: String(i.valorTotal),
          }))
        );
      }

      // 3. Para cada item com insumoId, atualizar estoque
      for (const item of input.itens) {
        if (!item.insumoId) continue;

        const insumoData = await db.query.insumos.findFirst({ where: eq(insumos.id, item.insumoId) });
        if (!insumoData) continue;

        // Buscar estoque atual
        const estoqueAtual = await db.query.estoque.findFirst({ where: eq(estoque.insumoId, item.insumoId) });

        let novoCustoMedio: number;
        if (estoqueAtual) {
          const qtdAtual = Number(estoqueAtual.quantidadeAtual);
          const custoAtual = Number(estoqueAtual.custoMedio);
          const qtdEntrada = item.quantidade;
          const custoEntrada = item.precoUnitario;

          // Custo médio ponderado
          novoCustoMedio = qtdAtual + qtdEntrada > 0
            ? (qtdAtual * custoAtual + qtdEntrada * custoEntrada) / (qtdAtual + qtdEntrada)
            : custoEntrada;

          await db.update(estoque)
            .set({
              quantidadeAtual: String(qtdAtual + qtdEntrada),
              quantidadeTeorica: String(Number(estoqueAtual.quantidadeTeorica) + qtdEntrada),
              custoMedio: String(novoCustoMedio),
              ultimaEntrada: input.dataEntrada || input.dataEmissao,
              atualizadoEm: new Date(),
            })
            .where(eq(estoque.insumoId, item.insumoId));
        } else {
          novoCustoMedio = item.precoUnitario;
          await db.insert(estoque).values({
            insumoId: item.insumoId,
            quantidadeAtual: String(item.quantidade),
            quantidadeTeorica: String(item.quantidade),
            custoMedio: String(novoCustoMedio),
            ultimaEntrada: input.dataEntrada || input.dataEmissao,
          });
        }

        // Atualizar custo médio no insumo
        await db.update(insumos)
          .set({ custoMedio: String(novoCustoMedio), atualizadoEm: new Date() })
          .where(eq(insumos.id, item.insumoId));

        // 4. Criar movimentação de entrada
        await db.insert(movimentacoesEstoque).values({
          insumoId: item.insumoId,
          tipo: 'entrada_compra',
          quantidade: String(item.quantidade),
          custoUnitario: String(item.precoUnitario),
          custoTotal: String(item.quantidade * item.precoUnitario),
          referenciaTipo: 'nota_fiscal',
          referenciaId: nf.id,
          dataMovimentacao: new Date(input.dataEntrada || input.dataEmissao),
          observacoes: `Entrada pela NF ${input.numeroNf}`,
        });
      }

      // 5. Inserir boletos se fornecidos
      if (input.boletos && input.boletos.length > 0) {
        await db.insert(boletos).values(
          input.boletos.map(b => ({
            nfId: nf.id,
            fornecedorId: input.fornecedorId,
            valor: String(b.valor),
            dataVencimento: b.dataVencimento,
            dataEmissao: b.dataEmissao,
            codigoBarras: b.codigoBarras,
            nossoNumero: b.nossoNumero,
          }))
        );
      }

      return nf;
    }),

  cancelarNf: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.update(notasFiscais)
        .set({ status: 'cancelada', atualizadoEm: new Date() })
        .where(eq(notasFiscais.id, input));
      return { success: true };
    }),

  listBoletos: publicProcedure
    .input(z.object({
      status: z.enum(['aberto', 'pago', 'vencido', 'cancelado', 'conciliado']).optional(),
      fornecedorId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(boletos.status, input.status));
      if (input?.fornecedorId) conditions.push(eq(boletos.fornecedorId, input.fornecedorId));

      const rows = await db.query.boletos.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(boletos.dataVencimento)],
      });

      return await Promise.all(rows.map(async (b) => {
        const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, b.fornecedorId) });
        return { ...b, fornecedor: forn };
      }));
    }),
});
