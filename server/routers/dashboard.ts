import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { alertas, estoque, insumos, boletos, extratoBancario, cuponsFiscais, notasFiscais, fornecedores, scoresOperacionais } from '../db/schema';
import { eq, and, gte, lte, lt, desc } from 'drizzle-orm';

function getScoreFaixa(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

async function calcularScoreGeral() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const hojeStr = hoje.toISOString().split('T')[0];

  // Score CMV (meta: 32%, máximo aceitável: 45%)
  const cupons = await db.query.cuponsFiscais.findMany({
    where: and(gte(cuponsFiscais.dataVenda, inicioMes), eq(cuponsFiscais.cancelado, false)),
  });
  const faturamento = cupons.reduce((acc, c) => acc + Number(c.valorLiquido), 0);
  const nfs = await db.query.notasFiscais.findMany({ where: gte(notasFiscais.dataEmissao, inicioMes) });
  const totalCompras = nfs.reduce((acc, nf) => acc + Number(nf.valorTotal), 0);
  const cmvPct = faturamento > 0 ? (totalCompras / faturamento) * 100 : 0;
  const scoreCmv = cmvPct <= 28 ? 100 : cmvPct <= 32 ? 90 : cmvPct <= 35 ? 75 : cmvPct <= 42 ? 50 : cmvPct <= 50 ? 25 : 0;

  // Score conciliação
  const extratos = await db.query.extratoBancario.findMany();
  const totalExtratos = extratos.length;
  const conciliados = extratos.filter(e => e.statusConciliacao === 'conciliado').length;
  const scoreConciliacao = totalExtratos > 0 ? (conciliados / totalExtratos) * 100 : 100;

  // Score estoque
  const estoqueItems = await db.query.estoque.findMany();
  let itensCriticos = 0;
  for (const e of estoqueItems) {
    const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, e.insumoId) });
    if (insumo && Number(e.quantidadeAtual) <= Number(insumo.estoqueMinimo || 0)) itensCriticos++;
  }
  const scoreEstoque = estoqueItems.length > 0
    ? Math.max(0, 100 - (itensCriticos / estoqueItems.length) * 100)
    : 100;

  // Score boletos
  const boletosVencidos = await db.query.boletos.findMany({
    where: and(eq(boletos.status, 'aberto'), lt(boletos.dataVencimento, hojeStr)),
  });
  const scoreCompras = Math.max(0, 100 - boletosVencidos.length * 10);

  const scoreGeral = (scoreCmv * 0.3 + scoreConciliacao * 0.2 + scoreEstoque * 0.25 + scoreCompras * 0.25);

  return {
    scoreGeral: Math.round(scoreGeral),
    scoreCmv: Math.round(scoreCmv),
    scoreConciliacao: Math.round(scoreConciliacao),
    scoreEstoque: Math.round(scoreEstoque),
    scoreCompras: Math.round(scoreCompras),
  };
}

export const dashboardRouter = router({
  getExecutivo: publicProcedure
    .query(async () => {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
      const hojeStr = hoje.toISOString().split('T')[0];

      // Faturamento do mês
      const cupons = await db.query.cuponsFiscais.findMany({
        where: and(
          gte(cuponsFiscais.dataVenda, inicioMes),
          lte(cuponsFiscais.dataVenda, fimMes),
          eq(cuponsFiscais.cancelado, false)
        ),
      });
      const faturamento = cupons.reduce((acc, c) => acc + Number(c.valorLiquido), 0);

      // Compras do mês
      const nfs = await db.query.notasFiscais.findMany({
        where: and(gte(notasFiscais.dataEmissao, inicioMes), lte(notasFiscais.dataEmissao, fimMes)),
      });
      const totalCompras = nfs.reduce((acc, nf) => acc + Number(nf.valorTotal), 0);
      const cmvValor = totalCompras;
      const cmvPercentual = faturamento > 0 ? (cmvValor / faturamento) * 100 : 0;

      // Alertas
      const alertasAtivos = await db.query.alertas.findMany({ where: eq(alertas.status, 'ativo') });
      const alertasCriticos = alertasAtivos.filter(a => a.criticidade === 'critica').length;
      const alertasAltos = alertasAtivos.filter(a => a.criticidade === 'alta').length;

      // Estoque crítico
      const estoqueItems = await db.query.estoque.findMany();
      let itensCriticos = 0;
      for (const e of estoqueItems) {
        const insumo = await db.query.insumos.findFirst({ where: eq(insumos.id, e.insumoId) });
        if (insumo && Number(e.quantidadeAtual) <= Number(insumo.estoqueMinimo || 0) && Number(insumo.estoqueMinimo || 0) > 0) {
          itensCriticos++;
        }
      }

      // Boletos vencidos
      const boletosVencidos = await db.query.boletos.findMany({
        where: and(eq(boletos.status, 'aberto'), lt(boletos.dataVencimento, hojeStr)),
      });

      // Boletos vencendo em 7 dias
      const sete = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const boletosVencendo7d = await db.query.boletos.findMany({
        where: and(
          eq(boletos.status, 'aberto'),
          gte(boletos.dataVencimento, hojeStr),
          lte(boletos.dataVencimento, sete)
        ),
      });
      const totalVencendo7d = boletosVencendo7d.reduce((acc, b) => acc + Number(b.valor), 0);

      // Pendências de conciliação
      const pendenciasConciliacao = await db.query.extratoBancario.findMany({
        where: eq(extratoBancario.statusConciliacao, 'pendente'),
      });

      // Score
      const scores = await calcularScoreGeral();
      const scoreFaixa = getScoreFaixa(scores.scoreGeral);

      // CMV histórico (8 semanas)
      const cmvHistorico = [];
      for (let i = 7; i >= 0; i--) {
        const fim = new Date(hoje.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const inicio = new Date(fim.getTime() - 7 * 24 * 60 * 60 * 1000);
        const di = inicio.toISOString().split('T')[0];
        const df = fim.toISOString().split('T')[0];

        const cuponsS = await db.query.cuponsFiscais.findMany({
          where: and(gte(cuponsFiscais.dataVenda, di), lte(cuponsFiscais.dataVenda, df), eq(cuponsFiscais.cancelado, false)),
        });
        const fatS = cuponsS.reduce((acc, c) => acc + Number(c.valorLiquido), 0);
        const nfsS = await db.query.notasFiscais.findMany({
          where: and(gte(notasFiscais.dataEmissao, di), lte(notasFiscais.dataEmissao, df)),
        });
        const comprasS = nfsS.reduce((acc, nf) => acc + Number(nf.valorTotal), 0);
        const cmvPctS = fatS > 0 ? (comprasS / fatS) * 100 : 0;

        cmvHistorico.push({
          semana: `S${8 - i}`,
          cmvPct: Math.round(cmvPctS * 10) / 10,
          meta: 32,
        });
      }

      // Top insumos por CMV
      const topInsumosMap = new Map<string, { nome: string, valor: number }>();
      for (const nf of nfs) {
        const { itensNf } = await import('../db/schema');
        const itens = await db.query.itensNf.findMany({ where: eq(itensNf.nfId, nf.id) });
        for (const item of itens) {
          const key = item.insumoId || item.descricaoNf;
          let nome = item.descricaoNf;
          if (item.insumoId) {
            const ins = await db.query.insumos.findFirst({ where: eq(insumos.id, item.insumoId) });
            if (ins) nome = ins.nome;
          }
          const entry = topInsumosMap.get(key) || { nome, valor: 0 };
          entry.valor += Number(item.valorTotal);
          topInsumosMap.set(key, entry);
        }
      }
      const topInsumosCmv = Array.from(topInsumosMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      // Compras por fornecedor (pie chart)
      const comprasPorFornecedorMap = new Map<string, { nome: string, valor: number }>();
      for (const nf of nfs) {
        const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, nf.fornecedorId) });
        const nome = forn?.nomeFantasia || forn?.razaoSocial || 'Desconhecido';
        const entry = comprasPorFornecedorMap.get(nf.fornecedorId) || { nome, valor: 0 };
        entry.valor += Number(nf.valorTotal);
        comprasPorFornecedorMap.set(nf.fornecedorId, entry);
      }
      const comprasPorFornecedor = Array.from(comprasPorFornecedorMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      return {
        cmvPercentual: Math.round(cmvPercentual * 10) / 10,
        cmvValor,
        faturamento,
        totalCompras,
        alertasCriticos,
        alertasAltos,
        itensCriticos,
        boletosVencidos: boletosVencidos.length,
        totalVencendo7d,
        pendenciasConciliacao: pendenciasConciliacao.length,
        scoreGeral: scores.scoreGeral,
        scoreFaixa,
        cmvHistorico,
        topInsumosCmv,
        comprasPorFornecedor,
      };
    }),
});
