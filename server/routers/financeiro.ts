import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { db } from '../db';
import { extratoBancario, boletos, fornecedores } from '../db/schema';
import { eq, desc, and, gte, lte, or, like } from 'drizzle-orm';

// Motor de conciliação automática
async function runConciliacaoAutomatica() {
  const extratosPendentes = await db.query.extratoBancario.findMany({
    where: and(
      eq(extratoBancario.tipo, 'debito'),
      eq(extratoBancario.statusConciliacao, 'pendente')
    ),
  });

  let conciliadosAuto = 0;
  let sugeridos = 0;

  for (const extrato of extratosPendentes) {
    const valorExtrato = Math.abs(Number(extrato.valor));
    const dataExtrato = new Date(extrato.dataTransacao);

    const boletosAbertos = await db.query.boletos.findMany({
      where: eq(boletos.status, 'aberto'),
    });

    let melhorMatch: typeof boletos.$inferSelect | null = null;
    let melhorScore = 0;

    for (const boleto of boletosAbertos) {
      const valorBoleto = Number(boleto.valor);
      const diferecaValor = Math.abs(valorExtrato - valorBoleto);
      if (diferecaValor >= 0.01) continue;

      const dataVenc = new Date(boleto.dataVencimento);
      const difDias = Math.abs((dataExtrato.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));

      // NÍVEL 1: automático (3 dias de diferença + match de descrição)
      const forn = boleto.fornecedorId ? await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, boleto.fornecedorId) }) : null;
      const descricaoMatch = forn?.nomeFantasia
        ? extrato.descricao.toLowerCase().includes(forn.nomeFantasia.toLowerCase())
        : false;
      const nossoNumeroMatch = boleto.nossoNumero
        ? extrato.descricao.includes(boleto.nossoNumero)
        : false;

      if (difDias <= 3 && (descricaoMatch || nossoNumeroMatch)) {
        // Nível 1: automático
        await db.update(extratoBancario)
          .set({ statusConciliacao: 'conciliado', boletoId: boleto.id })
          .where(eq(extratoBancario.id, extrato.id));

        await db.update(boletos)
          .set({
            status: 'conciliado',
            dataPagamento: extrato.dataTransacao,
            valorPago: String(valorExtrato),
            conciliacaoTipo: 'automatica',
            extratoId: extrato.id,
            conciliadoEm: new Date(),
          })
          .where(eq(boletos.id, boleto.id));

        conciliadosAuto++;
        melhorMatch = null; // ja conciliado
        break;
      }

      // NÍVEL 2: sugerido (7 dias de diferença)
      if (difDias <= 7 && difDias > 3) {
        const score = 7 - difDias;
        if (score > melhorScore) {
          melhorScore = score;
          melhorMatch = boleto;
        }
      }
    }

    // Nível 2: sugerido
    if (melhorMatch) {
      await db.update(boletos)
        .set({
          conciliacaoTipo: 'sugerida',
          extratoId: extrato.id,
        })
        .where(eq(boletos.id, melhorMatch.id));
      sugeridos++;
    }
  }

  return { conciliadosAuto, sugeridos };
}

export const financeiroRouter = router({
  importarOFX: publicProcedure
    .input(z.object({
      conteudo: z.string(),
      banco: z.string().default('Sicoob'),
      conta: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Parse OFX (formato XML-like)
      const transacoes: Array<{
        dtposted: string;
        trnamt: number;
        memo: string;
        fitid: string;
      }> = [];

      // Extrair transações do OFX
      const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
      let match;
      while ((match = stmtTrnRegex.exec(input.conteudo)) !== null) {
        const trn = match[1];
        const dtposted = trn.match(/<DTPOSTED>([^<]+)/)?.[1] || '';
        const trnamt = parseFloat(trn.match(/<TRNAMT>([^<]+)/)?.[1] || '0');
        const memo = trn.match(/<MEMO>([^<]+)/)?.[1] || trn.match(/<NAME>([^<]+)/)?.[1] || '';
        const fitid = trn.match(/<FITID>([^<]+)/)?.[1] || '';

        if (dtposted && trnamt !== undefined) {
          transacoes.push({ dtposted, trnamt, memo, fitid });
        }
      }

      // Também tentar formato sem tags de fechamento (OFX clássico SGML)
      if (transacoes.length === 0) {
        const linhas = input.conteudo.split('\n');
        let trnAtual: Partial<{ dtposted: string; trnamt: number; memo: string; fitid: string }> = {};
        let emTrn = false;

        for (const linha of linhas) {
          const l = linha.trim();
          if (l === '<STMTTRN>') { emTrn = true; trnAtual = {}; continue; }
          if (l === '</STMTTRN>') {
            if (emTrn && trnAtual.dtposted && trnAtual.trnamt !== undefined) {
              transacoes.push({
                dtposted: trnAtual.dtposted!,
                trnamt: trnAtual.trnamt!,
                memo: trnAtual.memo || '',
                fitid: trnAtual.fitid || '',
              });
            }
            emTrn = false;
            continue;
          }
          if (!emTrn) continue;
          const m = l.match(/^<(\w+)>(.+)/);
          if (!m) continue;
          const [, tag, val] = m;
          if (tag === 'DTPOSTED') trnAtual.dtposted = val.substring(0, 8);
          if (tag === 'TRNAMT') trnAtual.trnamt = parseFloat(val);
          if (tag === 'MEMO') trnAtual.memo = val;
          if (tag === 'NAME') trnAtual.memo = trnAtual.memo || val;
          if (tag === 'FITID') trnAtual.fitid = val;
        }
      }

      // Inserir no banco
      let inseridas = 0;
      for (const t of transacoes) {
        // Formatar data: YYYYMMDD -> YYYY-MM-DD
        const ano = t.dtposted.substring(0, 4);
        const mes = t.dtposted.substring(4, 6);
        const dia = t.dtposted.substring(6, 8);
        const dataFormatada = `${ano}-${mes}-${dia}`;

        // Verificar duplicata por fitid
        if (t.fitid) {
          const existente = await db.query.extratoBancario.findFirst({
            where: eq(extratoBancario.codigoTransacao, t.fitid),
          });
          if (existente) continue;
        }

        await db.insert(extratoBancario).values({
          banco: input.banco,
          conta: input.conta,
          dataTransacao: dataFormatada,
          descricao: t.memo.substring(0, 299),
          valor: String(Math.abs(t.trnamt)),
          tipo: t.trnamt < 0 ? 'debito' : 'credito',
          codigoTransacao: t.fitid,
        });
        inseridas++;
      }

      // Rodar conciliação automática
      const conciliacao = await runConciliacaoAutomatica();

      return { inseridas, transacoes: transacoes.length, ...conciliacao };
    }),

  getExtrato: publicProcedure
    .input(z.object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      tipo: z.enum(['debito', 'credito']).optional(),
      statusConciliacao: z.enum(['pendente', 'conciliado', 'ignorado', 'sem_documento']).optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(extratoBancario.dataTransacao, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(extratoBancario.dataTransacao, input.dataFim));
      if (input?.tipo) conditions.push(eq(extratoBancario.tipo, input.tipo));
      if (input?.statusConciliacao) conditions.push(eq(extratoBancario.statusConciliacao, input.statusConciliacao));

      const rows = await db.query.extratoBancario.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(extratoBancario.dataTransacao)],
      });

      return await Promise.all(rows.map(async (e) => {
        const boleto = e.boletoId ? await db.query.boletos.findFirst({ where: eq(boletos.id, e.boletoId) }) : null;
        // Buscar sugestões
        const sugestoesData = await db.query.boletos.findMany({
          where: and(eq(boletos.conciliacaoTipo, 'sugerida'), eq(boletos.extratoId as never, e.id)),
        });
        const sugestoes = await Promise.all(sugestoesData.map(async (b) => {
          const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, b.fornecedorId) });
          return { ...b, fornecedor: forn };
        }));
        return { ...e, boleto, sugestoes };
      }));
    }),

  conciliarManual: publicProcedure
    .input(z.object({
      extratoId: z.string().uuid(),
      boletoId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const extrato = await db.query.extratoBancario.findFirst({ where: eq(extratoBancario.id, input.extratoId) });
      if (!extrato) throw new Error('Extrato não encontrado');

      await db.update(extratoBancario)
        .set({ statusConciliacao: 'conciliado', boletoId: input.boletoId })
        .where(eq(extratoBancario.id, input.extratoId));

      await db.update(boletos)
        .set({
          status: 'conciliado',
          dataPagamento: extrato.dataTransacao,
          valorPago: extrato.valor,
          conciliacaoTipo: 'manual',
          extratoId: input.extratoId,
          conciliadoEm: new Date(),
        })
        .where(eq(boletos.id, input.boletoId));

      return { success: true };
    }),

  confirmarSugestao: publicProcedure
    .input(z.object({
      extratoId: z.string().uuid(),
      boletoId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const extrato = await db.query.extratoBancario.findFirst({ where: eq(extratoBancario.id, input.extratoId) });
      if (!extrato) throw new Error('Extrato não encontrado');

      await db.update(extratoBancario)
        .set({ statusConciliacao: 'conciliado', boletoId: input.boletoId })
        .where(eq(extratoBancario.id, input.extratoId));

      await db.update(boletos)
        .set({
          status: 'conciliado',
          dataPagamento: extrato.dataTransacao,
          valorPago: extrato.valor,
          conciliacaoTipo: 'sugerida',
          extratoId: input.extratoId,
          conciliadoEm: new Date(),
        })
        .where(eq(boletos.id, input.boletoId));

      return { success: true };
    }),

  ignorarExtrato: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await db.update(extratoBancario)
        .set({ statusConciliacao: 'sem_documento' })
        .where(eq(extratoBancario.id, input));
      return { success: true };
    }),

  getBoletos: publicProcedure
    .input(z.object({
      status: z.enum(['aberto', 'pago', 'vencido', 'cancelado', 'conciliado']).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(boletos.status, input.status));
      if (input?.dataInicio) conditions.push(gte(boletos.dataVencimento, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(boletos.dataVencimento, input.dataFim));

      const rows = await db.query.boletos.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(boletos.dataVencimento)],
      });

      return await Promise.all(rows.map(async (b) => {
        const forn = await db.query.fornecedores.findFirst({ where: eq(fornecedores.id, b.fornecedorId) });
        return { ...b, fornecedor: forn };
      }));
    }),

  getFluxoCaixa: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const extratos = await db.query.extratoBancario.findMany({
        where: and(
          gte(extratoBancario.dataTransacao, input.dataInicio),
          lte(extratoBancario.dataTransacao, input.dataFim)
        ),
        orderBy: [desc(extratoBancario.dataTransacao)],
      });

      const totalCreditos = extratos.filter(e => e.tipo === 'credito').reduce((acc, e) => acc + Number(e.valor), 0);
      const totalDebitos = extratos.filter(e => e.tipo === 'debito').reduce((acc, e) => acc + Number(e.valor), 0);
      const saldoPeriodo = totalCreditos - totalDebitos;

      // Agrupar por dia
      const porDia = new Map<string, { data: string, creditos: number, debitos: number }>();
      for (const e of extratos) {
        const entry = porDia.get(e.dataTransacao) || { data: e.dataTransacao, creditos: 0, debitos: 0 };
        if (e.tipo === 'credito') entry.creditos += Number(e.valor);
        else entry.debitos += Number(e.valor);
        porDia.set(e.dataTransacao, entry);
      }

      return {
        totalCreditos,
        totalDebitos,
        saldoPeriodo,
        porDia: Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data)),
        extratos,
      };
    }),

  runConciliacao: publicProcedure
    .mutation(async () => {
      return await runConciliacaoAutomatica();
    }),
});
