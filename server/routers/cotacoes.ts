import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { cotacoes, itensCotacao, fornecedores, insumos } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const cotacoesRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(['aberta', 'aprovada', 'rejeitada', 'expirada']).optional(),
      fornecedorId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(cotacoes.status, input.status));
      if (input?.fornecedorId) conditions.push(eq(cotacoes.fornecedorId, input.fornecedorId));

      const rows = await db.query.cotacoes.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(cotacoes.criadoEm)],
      });

      const result = await Promise.all(rows.map(async (c) => {
        const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, c.fornecedorId) });
        const itens = await db.query.itensCotacao.findMany({ where: eq(itensCotacao.cotacaoId, c.id) });
        const valorTotal = itens.reduce((acc, i) => acc + Number(i.precoUnitario) * Number(i.quantidade), 0);
        return { ...c, fornecedor: forn, itens, valorTotal };
      }));

      return result;
    }),

  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const cotacao = await db.query.cotacoes.findFirst({
        where: eq(cotacoes.id, input),
      });
      if (!cotacao) return null;
      const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, cotacao.fornecedorId) });
      const itens = await db.query.itensCotacao.findMany({ where: eq(itensCotacao.cotacaoId, input) });
      const itensComInsumo = await Promise.all(itens.map(async (i) => {
        const ins = i.insumoId ? await db.query.insumos.findFirst({ where: eq(insumos.id, i.insumoId) }) : null;
        return { ...i, insumo: ins };
      }));
      return { ...cotacao, fornecedor: forn, itens: itensComInsumo };
    }),

  create: publicProcedure
    .input(z.object({
      fornecedorId: z.string().uuid(),
      dataCotacao: z.string(),
      dataValidade: z.string().optional(),
      prazoPagamentoDias: z.number().optional(),
      prazoEntregaDias: z.number().optional(),
      observacoes: z.string().optional(),
      itens: z.array(z.object({
        insumoId: z.string().uuid(),
        quantidade: z.number(),
        precoUnitario: z.number(),
        unidadeMedida: z.string().optional(),
        observacoes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const numero = `COT-${Date.now()}`;
      const [nova] = await db.insert(cotacoes).values({
        numero,
        fornecedorId: input.fornecedorId,
        dataCotacao: input.dataCotacao,
        dataValidade: input.dataValidade,
        prazoPagamentoDias: input.prazoPagamentoDias,
        prazoEntregaDias: input.prazoEntregaDias,
        observacoes: input.observacoes,
      }).returning();

      if (input.itens.length > 0) {
        await db.insert(itensCotacao).values(
          input.itens.map(i => ({
            cotacaoId: nova.id,
            insumoId: i.insumoId,
            quantidade: String(i.quantidade),
            precoUnitario: String(i.precoUnitario),
            unidadeMedida: i.unidadeMedida,
            observacoes: i.observacoes,
          }))
        );
      }

      return nova;
    }),

  updateStatus: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['aberta', 'aprovada', 'rejeitada', 'expirada']),
    }))
    .mutation(async ({ input }) => {
      const [updated] = await db.update(cotacoes)
        .set({ status: input.status })
        .where(eq(cotacoes.id, input.id))
        .returning();
      return updated;
    }),

  delete: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.delete(itensCotacao).where(eq(itensCotacao.cotacaoId, input));
      await db.delete(cotacoes).where(eq(cotacoes.id, input));
      return { success: true };
    }),
});
