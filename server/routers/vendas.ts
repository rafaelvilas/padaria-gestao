import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { cuponsFiscais, itensVenda, produtos } from '../db/schema';
import { eq, desc, and, gte, lte, sum, count } from 'drizzle-orm';

export const vendasRouter = router({
  listCupons: publicProcedure
    .input(z.object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      cancelado: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(cuponsFiscais.dataVenda, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(cuponsFiscais.dataVenda, input.dataFim));
      if (input?.cancelado !== undefined) conditions.push(eq(cuponsFiscais.cancelado, input.cancelado));

      return await db.query.cuponsFiscais.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(cuponsFiscais.dataVenda)],
      });
    }),

  getCupomById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const cupom = await db.query.cuponsFiscais.findFirst({ where: eq(cuponsFiscais.id, input) });
      if (!cupom) return null;
      const itens = await db.query.itensVenda.findMany({ where: eq(itensVenda.cupomId, input) });
      const itensComProduto = await Promise.all(itens.map(async (i) => {
        const prod = i.produtoId ? await db.query.produtos.findFirst({ where: eq(produtos.id, i.produtoId) }) : null;
        return { ...i, produto: prod };
      }));
      return { ...cupom, itens: itensComProduto };
    }),

  importarCupons: publicProcedure
    .input(z.array(z.object({
      numeroCupom: z.string().optional(),
      dataVenda: z.string(),
      horaVenda: z.string().optional(),
      valorTotal: z.number(),
      desconto: z.number().default(0),
      valorLiquido: z.number(),
      formaPagamento: z.string().optional(),
      pdv: z.string().optional(),
      cancelado: z.boolean().default(false),
      itens: z.array(z.object({
        produtoId: z.string().uuid().optional(),
        descricaoOriginal: z.string(),
        codigoProduto: z.string().optional(),
        quantidade: z.number(),
        precoUnitario: z.number(),
        valorTotal: z.number(),
        desconto: z.number().default(0),
      })),
    })))
    .mutation(async ({ input }) => {
      let importados = 0;
      for (const cupomData of input) {
        const [cupom] = await db.insert(cuponsFiscais).values({
          numeroCupom: cupomData.numeroCupom,
          dataVenda: cupomData.dataVenda,
          horaVenda: cupomData.horaVenda,
          valorTotal: String(cupomData.valorTotal),
          desconto: String(cupomData.desconto),
          valorLiquido: String(cupomData.valorLiquido),
          formaPagamento: cupomData.formaPagamento,
          pdv: cupomData.pdv,
          cancelado: cupomData.cancelado,
        }).returning();

        if (cupomData.itens.length > 0) {
          await db.insert(itensVenda).values(
            cupomData.itens.map(i => ({
              cupomId: cupom.id,
              produtoId: i.produtoId,
              descricaoOriginal: i.descricaoOriginal,
              codigoProduto: i.codigoProduto,
              quantidade: String(i.quantidade),
              precoUnitario: String(i.precoUnitario),
              valorTotal: String(i.valorTotal),
              desconto: String(i.desconto),
            }))
          );
        }
        importados++;
      }
      return { importados };
    }),

  getResumo: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const cupons = await db.query.cuponsFiscais.findMany({
        where: and(
          gte(cuponsFiscais.dataVenda, input.dataInicio),
          lte(cuponsFiscais.dataVenda, input.dataFim),
          eq(cuponsFiscais.cancelado, false)
        ),
      });

      const faturamento = cupons.reduce((acc, c) => acc + Number(c.valorLiquido), 0);
      const totalCupons = cupons.length;
      const ticketMedio = totalCupons > 0 ? faturamento / totalCupons : 0;

      const allItens = await Promise.all(
        cupons.map(c => db.query.itensVenda.findMany({ where: eq(itensVenda.cupomId, c.id) }))
      );
      const itensFlat = allItens.flat();

      // Top produtos por faturamento
      const produtoMap = new Map<string, { descricao: string, valor: number, quantidade: number }>();
      for (const item of itensFlat) {
        const key = item.codigoProduto || item.descricaoOriginal;
        const entry = produtoMap.get(key) || { descricao: item.descricaoOriginal, valor: 0, quantidade: 0 };
        entry.valor += Number(item.valorTotal);
        entry.quantidade += Number(item.quantidade);
        produtoMap.set(key, entry);
      }

      const topProdutos = Array.from(produtoMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10);

      return { faturamento, totalCupons, ticketMedio, topProdutos };
    }),
});
