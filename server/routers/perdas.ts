import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { perdas, insumos, estoque, movimentacoesEstoque } from '../db/schema';
import { eq, desc, and, gte, lte, sum } from 'drizzle-orm';

export const perdasRouter = router({
  list: publicProcedure
    .input(z.object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      tipoPerda: z.enum(['desperdicio_operacional', 'vencimento', 'quebra', 'erro_producao', 'desvio_suspeito', 'ajuste_inventario', 'nao_identificada']).optional(),
      insumoId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(perdas.dataPerda, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(perdas.dataPerda, input.dataFim));
      if (input?.tipoPerda) conditions.push(eq(perdas.tipoPerda, input.tipoPerda));
      if (input?.insumoId) conditions.push(eq(perdas.insumoId, input.insumoId));

      const rows = await db.query.perdas.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(perdas.dataPerda)],
      });

      return await Promise.all(rows.map(async (p) => {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, p.insumoId) });
        return { ...p, insumo };
      }));
    }),

  registrar: publicProcedure
    .input(z.object({
      insumoId: z.string().uuid(),
      dataPerda: z.string(),
      quantidade: z.number().positive(),
      tipoPerda: z.enum(['desperdicio_operacional', 'vencimento', 'quebra', 'erro_producao', 'desvio_suspeito', 'ajuste_inventario', 'nao_identificada']),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const insumoData = await db.query.insumos.findFirst({ where: eq(insumos.id, input.insumoId) });
      const estoqueItem = await db.query.estoque.findFirst({ where: eq(estoque.insumoId, input.insumoId) });

      const custoUnit = Number(insumoData?.custoMedio || 0);
      const valorTotal = input.quantidade * custoUnit;

      const [perda] = await db.insert(perdas).values({
        insumoId: input.insumoId,
        dataPerda: input.dataPerda,
        quantidade: String(input.quantidade),
        custoUnitario: String(custoUnit),
        valorTotal: String(valorTotal),
        tipoPerda: input.tipoPerda,
        descricao: input.descricao,
      }).returning();

      // Baixar do estoque
      if (estoqueItem) {
        const novaQtd = Math.max(0, Number(estoqueItem.quantidadeAtual) - input.quantidade);
        await db.update(estoque)
          .set({
            quantidadeAtual: String(novaQtd),
            ultimaSaida: input.dataPerda,
            atualizadoEm: new Date(),
          })
          .where(eq(estoque.insumoId, input.insumoId));
      }

      // Registrar movimentação
      await db.insert(movimentacoesEstoque).values({
        insumoId: input.insumoId,
        tipo: 'saida_perda',
        quantidade: String(-input.quantidade),
        custoUnitario: String(custoUnit),
        custoTotal: String(-valorTotal),
        referenciaTipo: 'perda',
        referenciaId: perda.id,
        dataMovimentacao: new Date(input.dataPerda),
        observacoes: input.descricao || `Perda: ${input.tipoPerda}`,
      });

      return perda;
    }),

  getResumo: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const rows = await db.query.perdas.findMany({
        where: and(
          gte(perdas.dataPerda, input.dataInicio),
          lte(perdas.dataPerda, input.dataFim)
        ),
      });

      const totalValor = rows.reduce((acc, p) => acc + Number(p.valorTotal || 0), 0);
      const totalItens = rows.length;

      // Agrupar por tipo
      const porTipo = new Map<string, { tipo: string, quantidade: number, valor: number }>();
      for (const p of rows) {
        const entry = porTipo.get(p.tipoPerda) || { tipo: p.tipoPerda, quantidade: 0, valor: 0 };
        entry.quantidade += Number(p.quantidade);
        entry.valor += Number(p.valorTotal || 0);
        porTipo.set(p.tipoPerda, entry);
      }

      // Agrupar por insumo
      const porInsumo = new Map<string, { insumoId: string, nome: string, valor: number }>();
      for (const p of rows) {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, p.insumoId) });
        const key = p.insumoId;
        const entry = porInsumo.get(key) || { insumoId: key, nome: insumo?.nome || key, valor: 0 };
        entry.valor += Number(p.valorTotal || 0);
        porInsumo.set(key, entry);
      }

      return {
        totalValor,
        totalItens,
        porTipo: Array.from(porTipo.values()).sort((a, b) => b.valor - a.valor),
        topInsumos: Array.from(porInsumo.values()).sort((a, b) => b.valor - a.valor).slice(0, 10),
      };
    }),
});
