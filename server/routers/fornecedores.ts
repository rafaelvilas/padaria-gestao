import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { fornecedores, notasFiscais, boletos, cotacoes } from '../db/schema';
import { eq, desc, count, sum, avg, and, gte, lte } from 'drizzle-orm';

const fornecedorSchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  contatoNome: z.string().optional(),
  prazoMedioDias: z.number().default(0),
  status: z.enum(['ativo', 'inativo', 'bloqueado']).default('ativo'),
  observacoes: z.string().optional(),
});

export const fornecedoresRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(['ativo', 'inativo', 'bloqueado']).optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.status) {
        conditions.push(eq(fornecedores.status, input.status));
      }
      return await db.query.fornecedores.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(fornecedores.criadoEm)],
      });
    }),

  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return await db.query.fornecedores.findFirst({
        where: eq(fornecedores.id, input),
      });
    }),

  create: publicProcedure
    .input(fornecedorSchema)
    .mutation(async ({ input }) => {
      const [novo] = await db.insert(fornecedores).values(input).returning();
      return novo;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: fornecedorSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(fornecedores)
        .set({ ...input.data, atualizadoEm: new Date() })
        .where(eq(fornecedores.id, input.id))
        .returning();
      return updated;
    }),

  delete: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.update(fornecedores)
        .set({ status: 'inativo', atualizadoEm: new Date() })
        .where(eq(fornecedores.id, input));
      return { success: true };
    }),

  getPerformance: publicProcedure
    .input(z.object({
      fornecedorId: z.string().uuid(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const conditions = [eq(notasFiscais.fornecedorId, input.fornecedorId)];
      if (input.dataInicio) conditions.push(gte(notasFiscais.dataEmissao, input.dataInicio));
      if (input.dataFim) conditions.push(lte(notasFiscais.dataEmissao, input.dataFim));

      const nfs = await db.query.notasFiscais.findMany({
        where: and(...conditions),
        orderBy: [desc(notasFiscais.dataEmissao)],
      });

      const totalCompras = nfs.reduce((acc, nf) => acc + Number(nf.valorTotal), 0);
      const quantidadeNfs = nfs.length;

      const boletosData = await db.query.boletos.findMany({
        where: eq(boletos.fornecedorId, input.fornecedorId),
      });

      const boletosVencidos = boletosData.filter(b => b.status === 'vencido').length;
      const boletosPagos = boletosData.filter(b => b.status === 'pago' || b.status === 'conciliado').length;

      return {
        fornecedorId: input.fornecedorId,
        totalCompras,
        quantidadeNfs,
        boletosVencidos,
        boletosPagos,
        totalBoletos: boletosData.length,
        ultimasNfs: nfs.slice(0, 5),
      };
    }),

  getRanking: publicProcedure
    .input(z.object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      const allNfs = await db.query.notasFiscais.findMany({
        with: { fornecedor: true } as never,
      });

      const rankingMap = new Map<string, { fornecedor: typeof fornecedores.$inferSelect, total: number, quantidade: number }>();

      for (const nf of allNfs) {
        const key = nf.fornecedorId;
        if (!rankingMap.has(key)) {
          const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, key) });
          if (forn) {
            rankingMap.set(key, { fornecedor: forn, total: 0, quantidade: 0 });
          }
        }
        const entry = rankingMap.get(key);
        if (entry) {
          entry.total += Number(nf.valorTotal);
          entry.quantidade += 1;
        }
      }

      return Array.from(rankingMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, input.limit);
    }),
});
