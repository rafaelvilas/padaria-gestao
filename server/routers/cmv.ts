import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { cuponsFiscais, itensVenda, fichasTecnicas, itensFichaTecnica, estoque, movimentacoesEstoque, notasFiscais, insumos, produtos } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

async function calcularCmvTeorico(dataInicio: string, dataFim: string) {
  // 1. Buscar todas as vendas do período
  const cupons = await db.query.cuponsFiscais.findMany({
    where: and(
      gte(cuponsFiscais.dataVenda, dataInicio),
      lte(cuponsFiscais.dataVenda, dataFim),
      eq(cuponsFiscais.cancelado, false)
    ),
  });

  let cmvTeorico = 0;
  const consumoPorInsumo = new Map<string, { insumoId: string, nome: string, consumo: number, valor: number }>();

  for (const cupom of cupons) {
    const itens = await db.query.itensVenda.findMany({ where: eq(itensVenda.cupomId, cupom.id) });

    for (const item of itens) {
      if (!item.produtoId) continue;

      // Buscar ficha técnica ativa
      const ficha = await db.query.fichasTecnicas.findFirst({
        where: and(eq(fichasTecnicas.produtoId, item.produtoId), eq(fichasTecnicas.ativa, true)),
      });
      if (!ficha) continue;

      const ingredientes = await db.query.itensFichaTecnica.findMany({
        where: eq(itensFichaTecnica.fichaTecnicaId, ficha.id),
      });

      const qtdVendida = Number(item.quantidade);
      const rendimento = Number(ficha.rendimento);

      for (const ing of ingredientes) {
        const insumoData = await db.query.insumos.findFirst({ where: eq(insumos.id, ing.insumoId) });
        if (!insumoData) continue;

        const fatorPerda = Number(ing.fatorPerda || 0);
        const consumo = (qtdVendida * Number(ing.quantidade) / rendimento) * (1 + fatorPerda);
        const custoMedio = Number(insumoData.custoMedio || 0);
        const valor = consumo * custoMedio;

        cmvTeorico += valor;

        const entry = consumoPorInsumo.get(ing.insumoId) || { insumoId: ing.insumoId, nome: insumoData.nome, consumo: 0, valor: 0 };
        entry.consumo += consumo;
        entry.valor += valor;
        consumoPorInsumo.set(ing.insumoId, entry);
      }
    }
  }

  return { cmvTeorico, consumoPorInsumo };
}

async function calcularCmvReal(dataInicio: string, dataFim: string) {
  // CMV Real = estoque_inicial + compras - estoque_final
  // Usamos movimentações para calcular

  // Compras do período
  const nfs = await db.query.notasFiscais.findMany({
    where: and(
      gte(notasFiscais.dataEmissao, dataInicio),
      lte(notasFiscais.dataEmissao, dataFim)
    ),
  });
  const totalCompras = nfs.reduce((acc, nf) => acc + Number(nf.valorTotal), 0);

  // Valor atual do estoque
  const estoqueItems = await db.query.estoque.findMany();
  const valorEstoqueAtual = estoqueItems.reduce((acc, e) => {
    return acc + Number(e.quantidadeAtual) * Number(e.custoMedio);
  }, 0);

  // Movimentações de saída no período (para simular estoque inicial)
  const movSaidas = await db.query.movimentacoesEstoque.findMany({
    where: and(
      gte(movimentacoesEstoque.dataMovimentacao, new Date(dataInicio)),
      lte(movimentacoesEstoque.dataMovimentacao, new Date(dataFim + 'T23:59:59'))
    ),
  });

  const totalSaidaPeriodo = movSaidas
    .filter(m => m.tipo === 'saida_venda' || m.tipo === 'saida_perda')
    .reduce((acc, m) => acc + Math.abs(Number(m.custoTotal || 0)), 0);

  // Estoque inicial aproximado = estoque_atual + saidas_periodo - entradas_periodo
  const totalEntradaPeriodo = movSaidas
    .filter(m => m.tipo === 'entrada_compra')
    .reduce((acc, m) => acc + Number(m.custoTotal || 0), 0);

  const valorEstoqueInicial = valorEstoqueAtual + totalSaidaPeriodo - totalEntradaPeriodo;

  const cmvReal = Math.max(0, valorEstoqueInicial + totalCompras - valorEstoqueAtual);

  return { cmvReal, totalCompras, valorEstoqueAtual, valorEstoqueInicial };
}

export const cmvRouter = router({
  calcular: publicProcedure
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

      const { cmvTeorico, consumoPorInsumo } = await calcularCmvTeorico(input.dataInicio, input.dataFim);
      const { cmvReal, totalCompras } = await calcularCmvReal(input.dataInicio, input.dataFim);

      const cmvPctTeorico = faturamento > 0 ? (cmvTeorico / faturamento) * 100 : 0;
      const cmvPctReal = faturamento > 0 ? (cmvReal / faturamento) * 100 : 0;
      const desvio = cmvReal - cmvTeorico;
      const desvioPercentual = faturamento > 0 ? (desvio / faturamento) * 100 : 0;

      const topInsumos = Array.from(consumoPorInsumo.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)
        .map(i => ({
          ...i,
          percentualCmv: cmvTeorico > 0 ? (i.valor / cmvTeorico) * 100 : 0,
        }));

      return {
        faturamento,
        cmvTeorico,
        cmvReal,
        cmvPctTeorico,
        cmvPctReal,
        desvio,
        desvioPercentual,
        totalCompras,
        topInsumos,
        interpretacaoDesvio: desvio > 0
          ? 'Consumo real acima do teórico: possível desperdício ou desvio'
          : desvio < 0
          ? 'Consumo real abaixo do teórico: possível estoque subestimado'
          : 'CMV dentro do esperado',
      };
    }),

  historico: publicProcedure
    .input(z.object({ semanas: z.number().default(8) }))
    .query(async ({ input }) => {
      const resultado = [];
      const hoje = new Date();

      for (let i = input.semanas - 1; i >= 0; i--) {
        const fim = new Date(hoje.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const inicio = new Date(fim.getTime() - 7 * 24 * 60 * 60 * 1000);

        const dataInicio = inicio.toISOString().split('T')[0];
        const dataFim = fim.toISOString().split('T')[0];

        const cupons = await db.query.cuponsFiscais.findMany({
          where: and(
            gte(cuponsFiscais.dataVenda, dataInicio),
            lte(cuponsFiscais.dataVenda, dataFim),
            eq(cuponsFiscais.cancelado, false)
          ),
        });

        const faturamento = cupons.reduce((acc, c) => acc + Number(c.valorLiquido), 0);
        const { cmvReal } = await calcularCmvReal(dataInicio, dataFim);
        const cmvPct = faturamento > 0 ? (cmvReal / faturamento) * 100 : 0;

        resultado.push({
          semana: `S${input.semanas - i}`,
          dataInicio,
          dataFim,
          faturamento,
          cmvValor: cmvReal,
          cmvPct: Math.round(cmvPct * 10) / 10,
          meta: 32,
        });
      }

      return resultado;
    }),

  porProduto: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const { cmvTeorico, consumoPorInsumo } = await calcularCmvTeorico(input.dataInicio, input.dataFim);

      const cupons = await db.query.cuponsFiscais.findMany({
        where: and(
          gte(cuponsFiscais.dataVenda, input.dataInicio),
          lte(cuponsFiscais.dataVenda, input.dataFim),
          eq(cuponsFiscais.cancelado, false)
        ),
      });
      const faturamento = cupons.reduce((acc, c) => acc + Number(c.valorLiquido), 0);

      const topInsumos = Array.from(consumoPorInsumo.values())
        .sort((a, b) => b.valor - a.valor)
        .map(i => ({
          ...i,
          percentualCmv: cmvTeorico > 0 ? (i.valor / cmvTeorico) * 100 : 0,
          percentualFaturamento: faturamento > 0 ? (i.valor / faturamento) * 100 : 0,
        }));

      return { topInsumos, cmvTeorico, faturamento };
    }),
});
