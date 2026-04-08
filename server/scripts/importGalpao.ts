/**
 * Script de importação das Notas Técnicas do Galpão
 * Lê os 198 arquivos xlsx e popula: categoriasProduto, categoriasInsumo, insumos, produtos, fichasTecnicas, itensFichaTecnica
 *
 * Uso: pnpm tsx server/scripts/importGalpao.ts
 */

import 'dotenv/config';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/index.js';
import {
  categoriasProduto,
  categoriasInsumo,
  insumos,
  produtos,
  fichasTecnicas,
  itensFichaTecnica,
  estoque,
  movimentacoesEstoque,
  inventarios,
  itensInventario,
  itensCotacao,
  cotacoes,
  itensVenda,
  cuponsFiscais,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ─── CONFIGURAÇÃO ───────────────────────────────────────────────────────────

const BASE_PATH =
  'C:\\Users\\rafae\\OneDrive - Udiaço Comércio e Indústria de Ferro e Aço Ltda\\UDC\\Clientes\\Galpão\\Sistema Galpão\\Notas Tecnicas';

const CATEGORIAS_PRODUTO = [
  { nome: 'BAR', descricao: 'Bebidas e drinks do bar' },
  { nome: 'CAFÉ', descricao: 'Cafeteria e bebidas quentes' },
  { nome: 'CONFEITARIA', descricao: 'Bolos, tortas e doces' },
  { nome: 'COZINHA', descricao: 'Pratos quentes e frios da cozinha' },
  { nome: 'EXECUTIVO', descricao: 'Pratos do menu executivo' },
  { nome: 'PADARIA', descricao: 'Pães, salgados de padaria' },
  { nome: 'PIZZARIA', descricao: 'Pizzas e massas' },
  { nome: 'SALGADOS', descricao: 'Salgados e lanches' },
];

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface Ingrediente {
  nome: string;
  nomeNormalizado: string;
  qtd: number;
  unidade: string;
  precoCompra: number;
  rendimento: number;
}

interface Receita {
  arquivo: string;
  categoria: string;
  nomePrato: string;
  precoVenda: number | null;
  cmvAlvo: number | null;
  custoFicha: number | null;
  ingredientes: Ingrediente[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarUnidade(unidade: string): string {
  const u = String(unidade || '').toUpperCase().trim();
  if (u === 'KG' || u === 'KGS') return 'kg';
  if (u === 'G' || u === 'GR' || u === 'GRS') return 'g';
  if (u === 'L' || u === 'LT' || u === 'LTS' || u === 'LITRO' || u === 'LITROS') return 'l';
  if (u === 'ML') return 'ml';
  if (u === 'UN' || u === 'UND' || u === 'UNID' || u === 'UNIDADE' || u === 'PC' || u === 'PÇ') return 'un';
  if (u === 'CX' || u === 'CAIXA') return 'cx';
  if (u === 'FT' || u === 'FATIA') return 'fatia';
  if (u === 'PT' || u === 'PCT' || u === 'PACOTE') return 'pct';
  if (u === 'POR' || u === 'PORÇ' || u === 'PORÇÃO') return 'porção';
  return u.toLowerCase() || 'un';
}

function toFloat(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).replace(',', '.').replace(/[^0-9.\-]/g, '');
  return parseFloat(s) || 0;
}

function getCellValue(ws: XLSX.WorkSheet, col: string, row: number): unknown {
  const ref = `${col}${row}`;
  const cell = ws[ref];
  if (!cell) return undefined;
  return cell.v; // valor calculado (sem fórmulas)
}

// ─── PARSER DO XLSX ───────────────────────────────────────────────────────────

function parseNotaTecnica(filePath: string, categoria: string): Receita | null {
  let wb: XLSX.WorkBook;
  try {
    const buf = fs.readFileSync(filePath);
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: false, cellNF: false });
  } catch (err) {
    console.warn(`  ⚠ Erro ao ler "${path.basename(filePath)}": ${(err as Error).message}`);
    return null;
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;

  // Nome do prato: célula C2 (ou B2, ou D2)
  const fileName = path.basename(filePath, '.xlsx');
  const nomePratoRaw =
    getCellValue(ws, 'C', 2) ||
    getCellValue(ws, 'D', 2) ||
    getCellValue(ws, 'B', 2) ||
    sheetName ||
    fileName;
  const nomePrato = String(nomePratoRaw).replace('Nome do Prato:', '').trim() || fileName;

  // Preço de venda: K6 = "Preço de Venda" na seção POR PREÇO
  // Fallback: N7 = "Preço sugerido" na seção POR CMV
  const precoVendaK6 = toFloat(getCellValue(ws, 'K', 6));
  const precoVendaN7 = toFloat(getCellValue(ws, 'N', 7));
  const precoVenda = precoVendaK6 > 1 ? precoVendaK6 : precoVendaN7 > 1 ? precoVendaN7 : null;

  // CMV alvo: N6 = "CMV Desejado" (decimal como 0.22 = 22% ou já em % como 22)
  const cmvRaw = toFloat(getCellValue(ws, 'N', 6));
  const cmvAlvo = cmvRaw > 0 && cmvRaw <= 1 ? cmvRaw * 100 : cmvRaw > 1 && cmvRaw <= 100 ? cmvRaw : null;

  // Custo total da ficha: H19 = "Total" (soma de todos os itens)
  const custoFichaRaw = toFloat(getCellValue(ws, 'H', 19));
  const custoFicha = custoFichaRaw > 0 ? custoFichaRaw : null;

  const ingredientes: Ingrediente[] = [];

  // Lê linhas 5 até 30 (limite seguro)
  for (let row = 5; row <= 30; row++) {
    const nomeInsumo = getCellValue(ws, 'B', row);
    if (!nomeInsumo || String(nomeInsumo).trim() === '') continue;
    const nomeStr = String(nomeInsumo).trim();
    // Pula linhas que são cabeçalhos ou totais
    if (
      nomeStr.toUpperCase().includes('TOTAL') ||
      nomeStr.toUpperCase().includes('INSUMO') ||
      nomeStr.toUpperCase().includes('NOME DO')
    ) continue;

    const qtd = toFloat(getCellValue(ws, 'C', row));
    const unidade = normalizarUnidade(String(getCellValue(ws, 'D', row) || 'un'));
    const precoCompra = toFloat(getCellValue(ws, 'E', row));
    const rendimento = toFloat(getCellValue(ws, 'F', row)) || 1;

    if (qtd <= 0 && precoCompra <= 0) continue; // linha vazia de fórmula

    ingredientes.push({
      nome: nomeStr,
      nomeNormalizado: normalizarNome(nomeStr),
      qtd,
      unidade,
      precoCompra,
      rendimento,
    });
  }

  if (ingredientes.length === 0) {
    console.warn(`  ⚠ Sem ingredientes encontrados: ${fileName}`);
    return null;
  }

  return { arquivo: fileName, categoria, nomePrato, precoVenda, cmvAlvo, custoFicha, ingredientes };
}

// ─── LEITURA DOS ARQUIVOS ─────────────────────────────────────────────────────

function lerTodasAsReceitas(): Receita[] {
  const receitas: Receita[] = [];
  const categoriasDir = fs.readdirSync(BASE_PATH);

  for (const catDir of categoriasDir) {
    const catPath = path.join(BASE_PATH, catDir);
    if (!fs.statSync(catPath).isDirectory()) continue;
    // Normaliza nome: CAFE → CAFÉ
    const catNome = catDir.toUpperCase()
      .replace('CAFE', 'CAFÉ')
      .replace('PIZZARIA', 'PIZZARIA'); // já correto
    if (!CATEGORIAS_PRODUTO.find(c => c.nome === catNome)) {
      console.warn(`  ⚠ Categoria desconhecida: ${catDir} (normalizado: ${catNome})`);
    }

    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.xlsx') || f.endsWith('.XLSX'));
    for (const file of files) {
      const filePath = path.join(catPath, file);
      const receita = parseNotaTecnica(filePath, catNome);
      if (receita) receitas.push(receita);
    }
  }

  return receitas;
}

// ─── DEDUPLICAÇÃO DE INSUMOS ──────────────────────────────────────────────────

function deduplicarInsumos(receitas: Receita[]): Map<string, { nome: string; unidade: string; preco: number }> {
  // Chave: nomeNormalizado → { nome original mais frequente, unidade mais frequente, preço mais recente }
  const mapa = new Map<string, { nome: string; unidade: string; preco: number; count: number }>();

  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      const existing = mapa.get(ing.nomeNormalizado);
      if (!existing) {
        mapa.set(ing.nomeNormalizado, { nome: ing.nome, unidade: ing.unidade, preco: ing.precoCompra, count: 1 });
      } else {
        existing.count++;
        // Usa o preço mais alto (mais atualizado geralmente), a unidade mais frequente
        if (ing.precoCompra > existing.preco) existing.preco = ing.precoCompra;
      }
    }
  }

  // Retorna só nome/unidade/preco
  const result = new Map<string, { nome: string; unidade: string; preco: number }>();
  for (const [key, val] of mapa) {
    result.set(key, { nome: val.nome, unidade: val.unidade, preco: val.preco });
  }
  return result;
}

// ─── IMPORTAÇÃO PRINCIPAL ─────────────────────────────────────────────────────

async function importar() {
  console.log('\n🍞 IMPORTAÇÃO NOTAS TÉCNICAS GALPÃO\n' + '='.repeat(50));

  // 1. Ler todos os arquivos
  console.log('\n📂 Lendo arquivos xlsx...');
  const receitas = lerTodasAsReceitas();
  console.log(`  ✓ ${receitas.length} receitas lidas`);

  if (receitas.length === 0) {
    console.error('Nenhuma receita encontrada. Verifique o caminho BASE_PATH.');
    process.exit(1);
  }

  // 2. Deduplicar insumos
  const insumosMap = deduplicarInsumos(receitas);
  console.log(`  ✓ ${insumosMap.size} insumos únicos identificados`);

  // 3. Detectar duplicatas de prato entre categorias
  const pratoNomes = new Map<string, string>();
  const receitasFiltradas: Receita[] = [];
  for (const r of receitas) {
    const chave = normalizarNome(r.nomePrato);
    if (pratoNomes.has(chave)) {
      console.log(`  ℹ Duplicata ignorada: "${r.nomePrato}" (${r.categoria}) já existe em ${pratoNomes.get(chave)}`);
      continue;
    }
    pratoNomes.set(chave, r.categoria);
    receitasFiltradas.push(r);
  }
  console.log(`  ✓ ${receitasFiltradas.length} receitas únicas (${receitas.length - receitasFiltradas.length} duplicatas removidas)`);

  // ─── DB ──────────────────────────────────────────────────────────────────

  // 4. Limpar dados dependentes (ordem respeita FK constraints)
  console.log('\n🗑  Limpando dados anteriores...');
  await db.delete(itensInventario);
  await db.delete(inventarios);
  await db.delete(movimentacoesEstoque);
  await db.delete(estoque);
  await db.delete(itensCotacao);
  await db.delete(cotacoes);
  await db.delete(itensFichaTecnica);
  await db.delete(fichasTecnicas);
  await db.delete(itensVenda);      // referencia produtos
  await db.delete(cuponsFiscais);
  await db.delete(produtos);
  await db.delete(categoriasProduto);
  await db.delete(insumos);
  await db.delete(categoriasInsumo);
  console.log('  ✓ Limpo');

  // 5. Criar categoria de insumo (uma única: "INSUMOS GALPÃO")
  console.log('\n📋 Criando categorias de insumo...');
  const [catInsumo] = await db
    .insert(categoriasInsumo)
    .values({ nome: 'INSUMOS GALPÃO', descricao: 'Insumos importados das notas técnicas' })
    .returning();
  console.log(`  ✓ Categoria insumo criada: ${catInsumo.id}`);

  // 6. Criar categorias de produto
  console.log('\n📋 Criando categorias de produto...');
  const catProdutoMap = new Map<string, string>(); // nome → id
  for (const cat of CATEGORIAS_PRODUTO) {
    const [inserted] = await db.insert(categoriasProduto).values(cat).returning();
    catProdutoMap.set(cat.nome, inserted.id);
    console.log(`  ✓ ${cat.nome}`);
  }

  // 7. Inserir insumos
  console.log(`\n🧂 Inserindo ${insumosMap.size} insumos...`);
  const insumoIdMap = new Map<string, string>(); // nomeNormalizado → id

  const insumosParaInserir = Array.from(insumosMap.entries()).map(([nomeNorm, dados]) => ({
    nome: dados.nome,
    categoriaId: catInsumo.id,
    unidadeMedida: dados.unidade,
    custoMedio: String(dados.preco),
    ativo: true,
  }));

  // Insere em lotes de 100
  const LOTE = 100;
  const idsInsumos: string[] = [];
  for (let i = 0; i < insumosParaInserir.length; i += LOTE) {
    const lote = insumosParaInserir.slice(i, i + LOTE);
    const inserted = await db.insert(insumos).values(lote).returning({ id: insumos.id, nome: insumos.nome });
    inserted.forEach(r => idsInsumos.push(r.id));
  }

  // Mapeia nome normalizado → id
  const todosInsumos = await db.select({ id: insumos.id, nome: insumos.nome }).from(insumos);
  for (const ins of todosInsumos) {
    insumoIdMap.set(normalizarNome(ins.nome), ins.id);
  }
  console.log(`  ✓ ${todosInsumos.length} insumos inseridos`);

  // 8. Inserir produtos + fichas técnicas + itens
  console.log(`\n🍽  Inserindo ${receitasFiltradas.length} produtos e fichas técnicas...`);
  let produtosOk = 0;
  let fichasOk = 0;
  let itensOk = 0;
  let erros = 0;

  for (const receita of receitasFiltradas) {
    try {
      const catId = catProdutoMap.get(receita.categoria);
      if (!catId) {
        console.warn(`  ⚠ Categoria não encontrada para: ${receita.nomePrato} (${receita.categoria})`);
        erros++;
        continue;
      }

      // Produto
      const [produto] = await db
        .insert(produtos)
        .values({
          nome: receita.nomePrato,
          categoriaId: catId,
          precoVenda: receita.precoVenda ? String(receita.precoVenda) : null,
          unidadeVenda: 'un',
          ativo: true,
          temFichaTecnica: true,
        })
        .returning();
      produtosOk++;

      // Ficha técnica
      const [ficha] = await db
        .insert(fichasTecnicas)
        .values({
          produtoId: produto.id,
          versao: 1,
          rendimento: '1',
          unidadeRendimento: 'un',
          cmvAlvo: receita.cmvAlvo ? String(receita.cmvAlvo.toFixed(2)) : null,
          custoFicha: receita.custoFicha ? String(receita.custoFicha.toFixed(4)) : null,
          ativa: true,
          observacoes: `Importado de: ${receita.arquivo}`,
        })
        .returning();
      fichasOk++;

      // Itens da ficha
      const itensParaInserir = [];
      for (const ing of receita.ingredientes) {
        const insumoId = insumoIdMap.get(ing.nomeNormalizado);
        if (!insumoId) {
          console.warn(`  ⚠ Insumo não mapeado: "${ing.nome}" em "${receita.nomePrato}"`);
          continue;
        }
        const fatorPerda = ing.rendimento > 0 && ing.rendimento < 1
          ? String((1 - ing.rendimento).toFixed(4))
          : '0';

        itensParaInserir.push({
          fichaTecnicaId: ficha.id,
          insumoId,
          quantidade: String(ing.qtd),
          unidadeMedida: ing.unidade,
          fatorPerda,
        });
      }

      if (itensParaInserir.length > 0) {
        await db.insert(itensFichaTecnica).values(itensParaInserir);
        itensOk += itensParaInserir.length;
      }
    } catch (err) {
      console.error(`  ✗ Erro em "${receita.nomePrato}": ${(err as Error).message}`);
      erros++;
    }
  }

  // ─── RESUMO ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('✅ IMPORTAÇÃO CONCLUÍDA');
  console.log(`   Categorias produto : ${CATEGORIAS_PRODUTO.length}`);
  console.log(`   Insumos únicos     : ${todosInsumos.length}`);
  console.log(`   Produtos           : ${produtosOk}`);
  console.log(`   Fichas técnicas    : ${fichasOk}`);
  console.log(`   Itens ficha        : ${itensOk}`);
  if (erros > 0) console.log(`   ⚠ Erros           : ${erros}`);
  console.log('='.repeat(50) + '\n');

  process.exit(0);
}

importar().catch(err => {
  console.error('❌ Falha fatal:', err);
  process.exit(1);
});
