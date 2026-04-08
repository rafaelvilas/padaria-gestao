import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { fichasTecnicas, itensFichaTecnica, produtos, insumos, categoriasProduto } from '../db/schema';
import { eq, desc, and, asc } from 'drizzle-orm';

export const fichasTecnicasRouter = router({
  listProdutos: publicProcedure
    .query(async () => {
      const prods = await db.query.produtos.findMany({
        orderBy: [asc(produtos.nome)],
      });
      return await Promise.all(prods.map(async (p) => {
        const cat = p.categoriaId ? await db.query.categoriasProduto.findFirst({ where: eq(categoriasProduto.id, p.categoriaId) }) : null;
        const fichaAtiva = await db.query.fichasTecnicas.findFirst({
          where: and(eq(fichasTecnicas.produtoId, p.id), eq(fichasTecnicas.ativa, true)),
        });
        return { ...p, categoria: cat, fichaAtiva };
      }));
    }),

  listCategorias: publicProcedure
    .query(async () => {
      return await db.query.categoriasProduto.findMany();
    }),

  createProduto: publicProcedure
    .input(z.object({
      codigo: z.string().optional(),
      codigoBarras: z.string().optional(),
      nome: z.string().min(1),
      categoriaId: z.string().uuid().optional(),
      precoVenda: z.number().optional(),
      unidadeVenda: z.string().default('un'),
    }))
    .mutation(async ({ input }) => {
      const [novo] = await db.insert(produtos).values(input).returning();
      return novo;
    }),

  updateProduto: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: z.object({
        nome: z.string().optional(),
        categoriaId: z.string().uuid().optional(),
        precoVenda: z.number().optional(),
        unidadeVenda: z.string().optional(),
        ativo: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const [updated] = await db.update(produtos)
        .set({ ...input.data, atualizadoEm: new Date() })
        .where(eq(produtos.id, input.id))
        .returning();
      return updated;
    }),

  getFicha: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const ficha = await db.query.fichasTecnicas.findFirst({
        where: and(eq(fichasTecnicas.produtoId, input), eq(fichasTecnicas.ativa, true)),
      });
      if (!ficha) return null;
      const itens = await db.query.itensFichaTecnica.findMany({
        where: eq(itensFichaTecnica.fichaTecnicaId, ficha.id),
      });
      const itensComInsumo = await Promise.all(itens.map(async (i) => {
        const ins = await db.query.insumos.findFirst({ where: eq(insumos.id, i.insumoId) });
        return { ...i, insumo: ins };
      }));
      const produto = await db.query.produtos.findFirst({ where: eq(produtos.id, input) });
      return { ...ficha, produto, itens: itensComInsumo };
    }),

  saveFicha: publicProcedure
    .input(z.object({
      produtoId: z.string().uuid(),
      rendimento: z.number().default(1),
      unidadeRendimento: z.string().default('un'),
      cmvAlvo: z.number().optional(),
      observacoes: z.string().optional(),
      itens: z.array(z.object({
        insumoId: z.string().uuid(),
        quantidade: z.number(),
        unidadeMedida: z.string(),
        fatorPerda: z.number().default(0),
        observacoes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      // Desativar ficha anterior
      await db.update(fichasTecnicas)
        .set({ ativa: false })
        .where(and(eq(fichasTecnicas.produtoId, input.produtoId), eq(fichasTecnicas.ativa, true)));

      // Contar versoes
      const fichasAnteriores = await db.query.fichasTecnicas.findMany({
        where: eq(fichasTecnicas.produtoId, input.produtoId),
      });
      const versao = fichasAnteriores.length + 1;

      const [novaFicha] = await db.insert(fichasTecnicas).values({
        produtoId: input.produtoId,
        versao,
        rendimento: String(input.rendimento),
        unidadeRendimento: input.unidadeRendimento,
        cmvAlvo: input.cmvAlvo != null ? String(input.cmvAlvo.toFixed(2)) : null,
        ativa: true,
        observacoes: input.observacoes,
      }).returning();

      if (input.itens.length > 0) {
        await db.insert(itensFichaTecnica).values(
          input.itens.map(i => ({
            fichaTecnicaId: novaFicha.id,
            insumoId: i.insumoId,
            quantidade: String(i.quantidade),
            unidadeMedida: i.unidadeMedida,
            fatorPerda: String(i.fatorPerda),
            observacoes: i.observacoes,
          }))
        );
      }

      // Marcar produto como tendo ficha técnica
      await db.update(produtos)
        .set({ temFichaTecnica: true })
        .where(eq(produtos.id, input.produtoId));

      return novaFicha;
    }),

  listInsumos: publicProcedure
    .query(async () => {
      return await db.query.insumos.findMany({
        where: eq(insumos.ativo, true),
        orderBy: [desc(insumos.nome)],
      });
    }),

  listCategoriasInsumo: publicProcedure
    .query(async () => {
      const { categoriasInsumo } = await import('../db/schema');
      return await db.query.categoriasInsumo.findMany();
    }),

  createInsumo: publicProcedure
    .input(z.object({
      codigo: z.string().optional(),
      nome: z.string().min(1),
      categoriaId: z.string().uuid().optional(),
      unidadeMedida: z.string(),
      estoqueMinimo: z.number().default(0),
      estoqueMaximo: z.number().optional(),
      diasValidade: z.number().optional(),
      fornecedorPrincipalId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input }) => {
      const [novo] = await db.insert(insumos).values({
        ...input,
        estoqueMinimo: String(input.estoqueMinimo),
        estoqueMaximo: input.estoqueMaximo ? String(input.estoqueMaximo) : null,
      }).returning();
      return novo;
    }),
});
