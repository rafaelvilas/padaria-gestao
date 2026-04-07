import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { estoque, insumos, movimentacoesEstoque, inventarios, itensInventario, perdas, categoriasInsumo } from '../db/schema';
import { eq, desc, and, gte, lte, lt, sql } from 'drizzle-orm';

export const estoqueRouter = router({
  getSaldo: publicProcedure
    .query(async () => {
      const estoqueItems = await db.query.estoque.findMany();

      const result = await Promise.all(estoqueItems.map(async (e) => {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, e.insumoId) });
        const categoria = insumo?.categoriaId
          ? await db.query.categoriasInsumo.findFirst({ where: eq(categoriasInsumo.id, insumo.categoriaId) })
          : null;

        const qtdAtual = Number(e.quantidadeAtual);
        const qtdTeorica = Number(e.quantidadeTeorica);
        const estoqueMin = Number(insumo?.estoqueMinimo || 0);
        const custoMedio = Number(e.custoMedio);
        const divergencia = qtdAtual - qtdTeorica;
        const critico = qtdAtual <= estoqueMin;
        const valorTotal = qtdAtual * custoMedio;

        return {
          ...e,
          insumo,
          categoria,
          divergencia,
          critico,
          valorTotal,
          percentualDivergencia: qtdTeorica > 0 ? (divergencia / qtdTeorica) * 100 : 0,
        };
      }));

      return result;
    }),

  getMovimentacoes: publicProcedure
    .input(z.object({
      insumoId: z.string().uuid().optional(),
      tipo: z.enum(['entrada_compra', 'saida_venda', 'saida_perda', 'ajuste_inventario', 'ajuste_manual']).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.insumoId) conditions.push(eq(movimentacoesEstoque.insumoId, input.insumoId));
      if (input?.tipo) conditions.push(eq(movimentacoesEstoque.tipo, input.tipo));

      const movs = await db.query.movimentacoesEstoque.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(movimentacoesEstoque.dataMovimentacao)],
        limit: input?.limit || 50,
      });

      return await Promise.all(movs.map(async (m) => {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, m.insumoId) });
        return { ...m, insumo };
      }));
    }),

  criarInventario: publicProcedure
    .input(z.object({
      dataContagem: z.string(),
      responsavelId: z.string().uuid().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Criar registro de inventário
      const [inv] = await db.insert(inventarios).values({
        dataContagem: input.dataContagem,
        responsavelId: input.responsavelId,
        observacoes: input.observacoes,
      }).returning();

      // Buscar todos os itens de estoque
      const estoqueItems = await db.query.estoque.findMany();

      // Popular com quantidade teórica atual
      if (estoqueItems.length > 0) {
        await db.insert(itensInventario).values(
          estoqueItems.map(e => ({
            inventarioId: inv.id,
            insumoId: e.insumoId,
            quantidadeTeorica: e.quantidadeAtual,
            custoUnitario: e.custoMedio,
          }))
        );
      }

      return inv;
    }),

  lancarContagem: publicProcedure
    .input(z.object({
      inventarioId: z.string().uuid(),
      itens: z.array(z.object({
        itemId: z.string().uuid(),
        quantidadeContada: z.number(),
        observacoes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      for (const item of input.itens) {
        const itemAtual = await db.query.itensInventario.findFirst({
          where: eq(itensInventario.id, item.itemId),
        });
        if (!itemAtual) continue;

        const qtdTeorica = Number(itemAtual.quantidadeTeorica || 0);
        const qtdContada = item.quantidadeContada;
        const divergencia = qtdContada - qtdTeorica;
        const divergenciaPercentual = qtdTeorica > 0 ? (divergencia / qtdTeorica) * 100 : 0;
        const custoUnit = Number(itemAtual.custoUnitario || 0);
        const valorDivergencia = divergencia * custoUnit;

        await db.update(itensInventario)
          .set({
            quantidadeContada: String(qtdContada),
            divergencia: String(divergencia),
            divergenciaPercentual: String(divergenciaPercentual),
            valorDivergencia: String(valorDivergencia),
            observacoes: item.observacoes,
          })
          .where(eq(itensInventario.id, item.itemId));
      }
      return { success: true };
    }),

  finalizarInventario: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input: inventarioId }) => {
      const itens = await db.query.itensInventario.findMany({
        where: eq(itensInventario.inventarioId, inventarioId),
      });

      let totalDivergencias = 0;
      let valorDivergenciaTotal = 0;

      for (const item of itens) {
        if (item.quantidadeContada === null) continue;

        const divergencia = Number(item.divergencia || 0);
        const valorDiv = Number(item.valorDivergencia || 0);

        if (Math.abs(divergencia) > 0.001) {
          totalDivergencias++;
          valorDivergenciaTotal += Math.abs(valorDiv);

          // Criar movimentação de ajuste
          await db.insert(movimentacoesEstoque).values({
            insumoId: item.insumoId,
            tipo: 'ajuste_inventario',
            quantidade: String(divergencia),
            custoUnitario: item.custoUnitario,
            custoTotal: String(valorDiv),
            referenciaTipo: 'inventario',
            referenciaId: inventarioId,
            dataMovimentacao: new Date(),
            observacoes: `Ajuste por inventário`,
          });

          // Atualizar estoque
          const estoqueItem = await db.query.estoque.findFirst({ where: eq(estoque.insumoId, item.insumoId) });
          if (estoqueItem) {
            const novaQtd = Number(item.quantidadeContada);
            await db.update(estoque)
              .set({
                quantidadeAtual: String(novaQtd),
                quantidadeTeorica: String(novaQtd),
                ultimaContagem: new Date().toISOString().split('T')[0],
                atualizadoEm: new Date(),
              })
              .where(eq(estoque.insumoId, item.insumoId));
          }

          // Se divergência negativa, registrar como perda
          if (divergencia < 0) {
            await db.insert(perdas).values({
              insumoId: item.insumoId,
              dataPerda: new Date().toISOString().split('T')[0],
              quantidade: String(Math.abs(divergencia)),
              custoUnitario: item.custoUnitario,
              valorTotal: String(Math.abs(valorDiv)),
              tipoPerda: 'ajuste_inventario',
              descricao: `Perda identificada no inventário`,
              inventarioId,
            });
          }

          // Marcar item como ajustado
          await db.update(itensInventario)
            .set({ statusAjuste: 'ajustado' })
            .where(eq(itensInventario.id, item.id));
        } else {
          await db.update(itensInventario)
            .set({ statusAjuste: 'ignorado' })
            .where(eq(itensInventario.id, item.id));
        }
      }

      // Finalizar inventário
      await db.update(inventarios)
        .set({
          status: 'finalizado',
          totalDivergencias,
          valorDivergencia: String(valorDivergenciaTotal),
          finalizadoEm: new Date(),
        })
        .where(eq(inventarios.id, inventarioId));

      return { success: true, totalDivergencias, valorDivergenciaTotal };
    }),

  getInventarios: publicProcedure
    .query(async () => {
      return await db.query.inventarios.findMany({
        orderBy: [desc(inventarios.criadoEm)],
      });
    }),

  getInventarioById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const inv = await db.query.inventarios.findFirst({ where: eq(inventarios.id, input) });
      if (!inv) return null;
      const itens = await db.query.itensInventario.findMany({
        where: eq(itensInventario.inventarioId, input),
      });
      const itensComInsumo = await Promise.all(itens.map(async (i) => {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, i.insumoId) });
        return { ...i, insumo };
      }));
      return { ...inv, itens: itensComInsumo };
    }),

  getGiro: publicProcedure
    .query(async () => {
      const hoje = new Date();
      const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

      const movimentos = await db.query.movimentacoesEstoque.findMany({
        where: and(
          eq(movimentacoesEstoque.tipo, 'saida_venda'),
          gte(movimentacoesEstoque.dataMovimentacao, trintaDiasAtras)
        ),
      });

      const consumoPor30d = new Map<string, number>();
      for (const mov of movimentos) {
        const atual = consumoPor30d.get(mov.insumoId) || 0;
        consumoPor30d.set(mov.insumoId, atual + Math.abs(Number(mov.quantidade)));
      }

      const estoqueItems = await db.query.estoque.findMany();

      return await Promise.all(estoqueItems.map(async (e) => {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, e.insumoId) });
        const consumo30d = consumoPor30d.get(e.insumoId) || 0;
        const consumoDiario = consumo30d / 30;
        const qtdAtual = Number(e.quantidadeAtual);
        const giro = qtdAtual > 0 ? consumo30d / qtdAtual : 0;
        const diasCobertura = consumoDiario > 0 ? qtdAtual / consumoDiario : Infinity;

        return {
          insumoId: e.insumoId,
          insumo,
          quantidadeAtual: qtdAtual,
          consumo30d,
          consumoDiario,
          giro,
          diasCobertura: Math.min(diasCobertura, 999),
        };
      }));
    }),
});
