/**
 * Script de importação dos relatórios de vendas DataMaxi (PDF)
 * Lê todos os PDFs de "Relatório de Vendas" e popula: cuponsFiscais + itensVenda
 *
 * Uso: pnpm import:vendas
 */

import 'dotenv/config';
import pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/index.js';
import { cuponsFiscais, itensVenda, produtos } from '../db/schema.js';

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────

const PDF_DIR =
  'C:\\Users\\rafae\\OneDrive - Udiaço Comércio e Indústria de Ferro e Aço Ltda\\UDC\\Clientes\\Galpão\\Sistema Galpão\\Relatório de Vendas';

const LOTE_INSERT = 200;

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface ItemVendaParsed {
  codigoProduto: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
}

interface CupomParsed {
  numeroCupom: string;
  dataVenda: string;   // YYYY-MM-DD
  horaVenda: string;   // HH:MM:SS
  valorLiquido: number;
  desconto: number;
  valorTotal: number;  // bruto = liquido + desconto
  formaPagamento: string;
  pdv: string;
  cancelado: boolean;
  itens: ItemVendaParsed[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toFloat(s: string): number {
  if (!s) return 0;
  const str = String(s).trim();
  // Aceita apenas strings que parecem números reais (máx 8 dígitos inteiros + 4 decimais)
  // Rejeita chaves SAT/NFC-e e outros números gigantes
  if (!/^\d{1,8}([.,]\d{1,6})?$/.test(str)) return 0;
  return parseFloat(str.replace(',', '.')) || 0;
}

function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLixo(linha: string): boolean {
  // Filtra apenas rodapés textuais — NÃO filtra números (podem ser códigos de produto)
  return (
    linha.startsWith('Movimento - Consulta') ||
    linha.startsWith('Loja:') ||
    linha.startsWith('© Datamaxi') ||
    /^Pagina\s+\d+\s+de$/.test(linha) ||
    linha === 'Página'
    // ⚠ NÃO filtrar números genéricos — "1024" (nº de página) é raro e inofensivo;
    //   filtrar "\d{4}" matava códigos de produto como 1426, 1794, etc.
  );
}

function parsearDataHora(dataHoraStr: string): { data: string; hora: string } {
  // Formato: "03/01/2026 07:17" ou "03/01/2026 07:17:00"
  const [datePart, timePart] = (dataHoraStr || '').split(' ');
  if (!datePart) return { data: '', hora: '00:00:00' };
  const [d, m, y] = datePart.split('/');
  const data = y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
  const hora = timePart ? (timePart.includes(':') ? timePart + (timePart.split(':').length === 2 ? ':00' : '') : '00:00:00') : '00:00:00';
  return { data, hora };
}

// ─── PARSER PRINCIPAL ─────────────────────────────────────────────────────────

/**
 * Parseia o texto extraído do PDF e retorna uma lista de cupons com itens.
 *
 * Estrutura do PDF DataMaxi:
 *
 * [CABEÇALHO DE VENDA — 11 colunas de headers, depois 11 valores]
 * Venda | Caixa | Data/Hora | Cartão | Total | Desconto |
 * Código Devolução | Série ECF | Número ECF | COO | Usuário
 *
 * [LINHA CPF/CHAVE — ignorar]
 *
 * [ITENS — 9 colunas de headers, depois grupos de 9 valores por item]
 * Código | Produto | Quantidade | Valor Unitário | Valor Total |
 * Cartão | Terminal | Usuário | Data/Hora Produto
 *
 * [PAGAMENTO — começa com "Espécies da Venda"]
 * Espécies da Venda | Valor | Troco | % Sobre Total.
 * [método | valor | troco | %] × n formas de pagamento
 */
function parsearTexto(texto: string): CupomParsed[] {
  const linhas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !isLixo(l));

  const cupons: CupomParsed[] = [];
  let i = 0;

  // Headers fixos que identificamos
  const SALE_HEADERS = ['Venda', 'Caixa', 'Data/Hora', 'Cartão', 'Total', 'Desconto',
    'Código Devolução', 'Série ECF', 'Número ECF', 'COO', 'Usuário'];
  const ITEM_HEADERS = ['Código', 'Produto', 'Quantidade', 'Valor Unitário', 'Valor Total',
    'Cartão', 'Terminal', 'Usuário', 'Data/Hora Produto'];

  while (i < linhas.length) {
    // Detecta início de venda: linha "Venda" seguida de "Caixa"
    if (linhas[i] === 'Venda' && linhas[i + 1] === 'Caixa') {
      // Pula os 11 headers de cabeçalho de venda
      i += SALE_HEADERS.length; // i agora aponta para o 1º valor

      // Coleta os 11 valores da venda
      const numeroCupom   = linhas[i] ?? '';  i++;
      const caixa         = linhas[i] ?? '';  i++;
      const dataHoraStr   = linhas[i] ?? '';  i++;
      /* cartão */                             i++;
      const totalStr      = linhas[i] ?? '0'; i++;
      const descontoStr   = linhas[i] ?? '0'; i++;
      /* Código Devolução */ const codDev = linhas[i] ?? '0'; i++;
      /* Série ECF */                          i++;
      /* Número ECF */                         i++;
      /* COO */                                i++;
      /* Usuário */                            i++;

      const cancelado = toFloat(codDev) !== 0;
      const desconto = toFloat(descontoStr);
      const valorLiquido = toFloat(totalStr);
      const valorBruto = valorLiquido + desconto;
      const { data: dataVenda, hora: horaVenda } = parsearDataHora(dataHoraStr);

      if (!dataVenda) { /* venda sem data válida — pula */ continue; }

      // Pula linha(s) CPF/Chave SAT (pode vir em 1 ou 2 linhas)
      while (i < linhas.length && (
        linhas[i].includes('CPF/CNPJ') ||
        linhas[i].includes('Chave SAT') ||
        linhas[i].includes('NFC-e:') ||
        linhas[i].startsWith('SAT/')
      )) i++;

      // Pula headers de itens (pode repetir em quebras de página)
      function pularHeadersItens() {
        if (linhas[i] === 'Código' && linhas[i + 1] === 'Produto') {
          i += ITEM_HEADERS.length;
        }
      }
      pularHeadersItens();

      // Detecta fim de seção de itens: "Espécies da Venda" (tolerante a encoding)
      function isEspecies(linha: string): boolean {
        const norm = normalizarNome(linha);
        return norm === 'ESPECIES DA VENDA' || norm.startsWith('ESPECIES DA VEN');
      }

      // Lê itens até encontrar pagamento ou nova venda
      const itens: ItemVendaParsed[] = [];
      while (
        i < linhas.length &&
        !isEspecies(linhas[i]) &&
        !(linhas[i] === 'Venda' && linhas[i + 1] === 'Caixa')
      ) {
        // Quebra de página pode reinserir headers — pular se aparecerem
        if (linhas[i] === 'Código' && linhas[i + 1] === 'Produto') {
          i += ITEM_HEADERS.length;
          continue;
        }

        // 9 valores por item: codigo, produto, qtd, precoUnit, total, cartao, terminal, user, dataHora
        const codProduto   = linhas[i] ?? ''; i++;
        const nomeProduto  = linhas[i] ?? ''; i++;
        const qtdStr       = linhas[i] ?? '0'; i++;
        const unitStr      = linhas[i] ?? '0'; i++;
        const totalItemStr = linhas[i] ?? '0'; i++;
        /* cartão */    i++;
        /* terminal */  i++;
        /* usuário */   i++;
        /* data/hora */ i++;

        const qtd = toFloat(qtdStr);
        const precoUnit = toFloat(unitStr);
        const valTotal = toFloat(totalItemStr);

        // Valida item real: nome não é header, quantidade > 0
        const nomeUpperNorm = normalizarNome(nomeProduto);
        const isHeader = ['PRODUTO', 'QUANTIDADE', 'VALOR UNITARIO', 'VALOR TOTAL',
          'CARTAO', 'TERMINAL', 'USUARIO', 'DATA/HORA PRODUTO', 'CODIGO'].includes(nomeUpperNorm);

        if (nomeProduto && qtd > 0 && !isHeader && !isEspecies(nomeProduto)) {
          itens.push({
            codigoProduto: codProduto,
            descricao: nomeProduto,
            quantidade: qtd,
            precoUnitario: precoUnit,
            valorTotal: valTotal,
          });
        }
      }

      // Lê forma de pagamento principal
      let formaPagamento = '';
      if (i < linhas.length && isEspecies(linhas[i])) {
        i++; // skip "Espécies da Venda"
        i++; // skip "Valor"
        i++; // skip "Troco"
        i++; // skip "% Sobre Total."

        // Lê grupos de [método, valor, troco, %] até próxima venda ou fim
        while (
          i < linhas.length &&
          linhas[i] !== 'Venda' &&
          linhas[i] !== 'Espécies da Venda'
        ) {
          const metodo = linhas[i]; i++;
          /* valor */ i++;
          /* troco */ i++;
          /* %     */ i++;

          // Ignora linhas de desconto; pega o primeiro método real de pagamento
          if (formaPagamento === '' && !metodo.toLowerCase().startsWith('desconto')) {
            formaPagamento = metodo;
          }
        }
      }

      cupons.push({
        numeroCupom,
        dataVenda,
        horaVenda,
        valorLiquido,
        desconto,
        valorTotal: valorBruto,
        formaPagamento,
        pdv: caixa,
        cancelado,
        itens,
      });
    } else {
      i++;
    }
  }

  return cupons;
}

// ─── ALIASES POS → FICHA ─────────────────────────────────────────────────────
// Mapeamentos explícitos: nome normalizado no POS → nome normalizado no sistema
// Adicione aqui quando o POS usa um nome diferente do nome na ficha técnica
// Mapeamento: normalizarNome(nomePOS) → nomeProdutoDB (exato, antes de normalizar)
// Use quando o POS tem grafia diferente do nome na ficha técnica
const ALIASES: Record<string, string> = {
  // Café
  'CAPUCCINO BRASILEIRO':          'CAPPUCCINO BRASILEIRO',
  'CAFE MACHIATTO':                'CAFÉ MACCHIATO',
  'SALTED CARAMEL LATTE':          'SALTED CARAMELO LATTE',
  'CAFE ORANGE COFFEE':            'ORANGE COFFEE',

  // Padaria / Pães
  'CROISSANT 70G':                 'CROISANT TRADICIONAL',
  'PAIN AU CHOCOLAT 50G':          'PAIN CHOCOLAT',
  'PAO DE QUEIJO PEQUENO':         'PAO DE QUEIJO P',
  'PAO DE QUEIJO GRANDE':          'PAO DE QUEIJO P',       // sem "G" no DB — mesma ficha
  'CIABATA NA CHAPA':              'CIABATA NA CHAPA',      // força match exato se norm falhar

  // Salgados / Ovos
  'OVO NA CIABATA':                'OVO NA CIABATTA',       // DB tem duplo T
  'OVO NO CROISSANT':              'OVO NA CIABATTA',       // mesma ficha base
  'OVOS MEXIDOS SIMPLES 3 OVOS':   'OMELETE 3 OVOS',
  'OVOS MEXIDOS COM QUEIJO':       'OMELETE 3 OVOS',

  // Confeitaria
  'NY ROLL NUTELLA':               'NY ROLL NUTTELA',       // DB tem duplo T
  'NY ROLL DOCE DE LEITE':         'NY ROLL NUTTELA',       // mesma ficha base

  // Saladas / Executivo
  'EXE SALADA VERDE':              'SALADA VERDE COM PARMESAO E BALSAMICO',
  'SALADA VERDE':                  'SALADA VERDE COM PARMESAO E BALSAMICO',

  // Pães — o POS vende pelo nome final, as fichas são as massas
  'PAO ITALIANO':                  'MASSA ITALIANO',
  'BAGUETE MUCARELA':              'MASSA BAGUETE',
  'BAGUETE TRADICAO 350G':         'MASSA BAGUETE',
  'BAGUETE TRADICIONAL':           'MASSA BAGUETE',
  'SEMI ITALIANO COM PARMESAO':    'MASSA SEMI ITALIANO',
  'PAO FUNCIONAL':                 'PAO FUNCIONAL',           // idêntico, força match

  // Cookies
  'COOKIE NUTELLA':                'COOKIE DE NUTELA',

  // Integral
  'PAO DE FORMA 100 INTEGRAL':     '100% INTEGRAL',
  'PAO INTEGRAL':                  '100% INTEGRAL',

  // Panquecas
  'PANQUECAS':                     'MASSA PANQUECA AMERICANA',
  'PANQUECA AMERICANA':            'MASSA PANQUECA AMERICANA',

  // Tortas — mapeadas para a massa de torta (melhor aproximação disponível)
  'TORTA DE PALMITO FATIA':        'MASSA DE TORTA',
  'TORTA DE FRANGO FATIA':         'MASSA DE TORTA',

  // Coxinhas — mapeadas para a massa (fichas de insumo disponíveis)
  'COXINHA DE FRANGO':             'MASSA COXINHA',
  'COXINHA DE FRANGO COM CATUPIRY':'MASSA COXINHA',

  // Bebidas / Drinks
  'PINK LEMONADE GALPAO':          'PINK LIMONADE',   // typo no DB
  'PINK LEMONADE':                 'PINK LIMONADE',

  // Cookies
  'COOKIE CHOCO CHIP':             'COOKIE CHOCOCHIP',
  'COOKIE CHOCOLATE CHIP':         'COOKIE CHOCOCHIP',

  // Saladas
  'SALADA DE FRUTAS 100G':         'SALADA DE FRUTAS 100/200',
  'SALADA DE FRUTAS 200G':         'SALADA DE FRUTAS 100/200',

  // Pratos / Executivos
  'STROGONOFF DE CARNE':           'MOLHO STROGONOFF',
  'STROGONOFF DE FRANGO':          'MOLHO STROGONOFF',
  'PICADINHO DE CARNE':            'PICADINHO DE MIGNON',
  'TOAST DE PARMA E FIGO':         'PARMAE FIGO',
  'TOAST PARMA E FIGO':            'PARMAE FIGO',

  // Choux
  'CHOUX CREAM E MORANGO':         'MASSA CHOUX',
  'CHOUX MORANGO':                 'MASSA CHOUX',

  // Mistos e sanduíches
  'PAO NA CHAPA NO CROISSANT':     'CROISANT TRADICIONAL',
  'PAO NA CHAPA NA CIABATA':       'CIABATA NA CHAPA',
  'PAO NA CHAPA NO BRIOCHE':       'CIABATA NA CHAPA',   // melhor aproximação disponível
  'OVO NO BRIOCHE':                'OVO NA CIABATTA',
  'OVO NO PAO DE SEMOLINA':        'OVO NA CIABATTA',

  // Chá / Infusões
  'CAFE CHAI LATTE':               'CHAI LATTE',

  // Omelete
  'OMELETE SIMPLES 3 OVOS':        'OMELETE 3 OVOS',
  'OMELETE COM QUEIJO 3 OVOS':     'OMELETE 3 OVOS',

  // Outros pratos executivos
  'FILE DE FRANGO COM CUSCUZ':     'CUSCUZ',
  'IOGURTE COM GELEIA E GRANOLA':  'GRANOLA GALPÃO',

  // Pizza
  'PIZZA FRACIONADA':              'DISCO DE PIZZA',
  'PIZZA FATIA':                   'DISCO DE PIZZA',

  // Tortas doces
  'TORTA DE CARAMELO E CHOCOLATE INDIVIDUAL': 'TORTA DE CARAMELO SALGADO',
  'TORTA DE CARAMELO INDIVIDUAL':  'TORTA DE CARAMELO SALGADO',

  // Empada
  'EMPADA DE PALMITO':             'RECHEIO DE PALMITO',

  // Joelho
  'JOELHO DE QUATRO QUEIJOS':      'JOELHO DE PRESUNTO E QUEIJO',
  'JOELHO QUATRO QUEIJOS':         'JOELHO DE PRESUNTO E QUEIJO',

  // Ovo em pão italiano
  'OVO NO ITALIANO':               'OVO NA CIABATTA',
  'OVO COM QUEIJO NO ITALIANO':    'OVO NA CIABATTA',

  // Risoto / massas variantes do POS
  'RISOTO':                        'RISOTO PRE COZIDO',
  'RISOTO EXECUTIVO':              'RISOTO PRE COZIDO',

  // Filés
  'FILE A PARMEGIANA':             'FILE PARMEGIANA',
  'FILE DE FRANGO A PARMEGIANA':   'FILE PARMEGIANA FRANGO',
  'FILE FRANGO PARMEGIANA':        'FILE PARMEGIANA FRANGO',

  // Tortas doces individuais
  'TORTA DE BRIGADEIRO INDIVIDUAL':'TORTINHA BRIGADEIRO',
  'TORTA BRIGADEIRO':              'TORTINHA BRIGADEIRO',
};

// ─── MATCHING DE PRODUTOS ─────────────────────────────────────────────────────

type ProdutoRow = { id: string; nome: string; codigo: string | null };

function buildMatchIndex(prods: ProdutoRow[]): Map<string, string> {
  // nomeNormalizado → produtoId (múltiplas entradas por produto para máxima cobertura)
  const idx = new Map<string, string>();
  for (const p of prods) {
    const norm = normalizarNome(p.nome);
    idx.set(norm, p.id);
    // Também indexa com ortografia normalizada (CAPPUCCINO → CAPUCCINO etc.)
    idx.set(normalizarNome(normOrtografia(norm)), p.id);
    // Também indexa sem qualificadores
    const semQual = normalizarNome(stripQualificadores(norm));
    if (semQual) idx.set(semQual, p.id);
    if (p.codigo) idx.set(p.codigo.toUpperCase(), p.id);
  }
  return idx;
}

// Remove qualificadores de tamanho/peso do nome do POS para melhorar matching
// Ex: "CROISSANT 70G" → "CROISSANT", "PAO DE QUEIJO PEQUENO" → "PAO DE QUEIJO"
const QUALIFICADORES = /\s+(PEQUENO|GRANDE|MEDIO|P\b|G\b|M\b|\d+G\b|\d+GR\b|\d+ML\b|\d+L\b|\d+KG\b|FATIA|UNID|TRADICIONAL|ATU|EXE|COM CATUPIRY|SIMPLES|ARTESANAL|SEMPRE PURA|ZERO|LIGHT)(\s+.*)?$/;

function stripQualificadores(nome: string): string {
  return nome.replace(QUALIFICADORES, '').trim();
}

// Normaliza ortografia comum: duplicação de consoantes, variações
function normOrtografia(nome: string): string {
  return nome
    .replace(/CAPPUCCINO/g, 'CAPUCCINO')  // duplo P → simples
    .replace(/CAPUCCINO/g, 'CAPUCCINO')   // já OK
    .replace(/CROISSANT/g, 'CROISSANT')
    .replace(/\bSTROGONOFF\b/g, 'STROGONOFF')
    .replace(/\bSTROGNOF\b/g, 'STROGONOFF');
}

function matchProduto(
  desc: string,
  codigo: string,
  idx: Map<string, string>,
  prods: ProdutoRow[]
): string | null {
  // 0. ALIASES explícitos: nome POS → nome ficha técnica
  const normDescRaw = normalizarNome(desc);
  const aliasTarget = ALIASES[normDescRaw];
  if (aliasTarget) {
    const aliasId = idx.get(normalizarNome(aliasTarget));
    if (aliasId) return aliasId;
  }

  // 1. Por código do POS
  if (codigo && idx.has(codigo.toUpperCase())) return idx.get(codigo.toUpperCase())!;

  const normDesc = normDescRaw;

  // 2. Nome exato normalizado
  if (idx.has(normDesc)) return idx.get(normDesc)!;

  // 3. Nome com ortografia normalizada
  const normOrt = normalizarNome(normOrtografia(desc));
  if (idx.has(normOrt)) return idx.get(normOrt)!;

  // 4. Sem qualificadores de tamanho
  const semQual = normalizarNome(stripQualificadores(normDesc));
  if (semQual && idx.has(semQual)) return idx.get(semQual)!;

  // 5. O nome do DB (sem qualificadores) é prefixo do nome do POS
  //    Ex: "PAO DE QUEIJO" ⊆ "PAO DE QUEIJO PEQUENO"
  //    Prefere o match mais longo (mais específico)
  let bestId: string | null = null;
  let bestLen = 0;
  for (const p of prods) {
    const normNome = normalizarNome(p.nome);
    if (normDesc.startsWith(normNome) && normNome.length > bestLen) {
      bestId = p.id;
      bestLen = normNome.length;
    }
    // Também testa sem qualificadores dos dois lados
    if (semQual && semQual.startsWith(normNome) && normNome.length > bestLen) {
      bestId = p.id;
      bestLen = normNome.length;
    }
  }
  if (bestId) return bestId;

  // 6. O nome do POS é prefixo do nome do DB
  for (const p of prods) {
    const normNome = normalizarNome(p.nome);
    if (normNome.startsWith(normDesc + ' ') || normNome === normDesc) {
      return p.id;
    }
  }

  return null;
}

// ─── IMPORTAÇÃO PRINCIPAL ─────────────────────────────────────────────────────

async function importar() {
  console.log('\n💰 IMPORTAÇÃO DE VENDAS — RELATÓRIOS DataMaxi\n' + '='.repeat(55));

  // 1. Listar PDFs
  const pdfs = fs.readdirSync(PDF_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(PDF_DIR, f))
    .sort();

  if (pdfs.length === 0) {
    console.error('Nenhum PDF encontrado em:', PDF_DIR);
    process.exit(1);
  }
  console.log(`\n📄 ${pdfs.length} PDFs encontrados:`);
  pdfs.forEach(p => console.log(`   • ${path.basename(p)}`));

  // 2. Carregar produtos para matching
  console.log('\n🔍 Carregando produtos do banco...');
  const produtosDB: ProdutoRow[] = await db.select({
    id: produtos.id,
    nome: produtos.nome,
    codigo: produtos.codigo,
  }).from(produtos);
  const matchIdx = buildMatchIndex(produtosDB);
  console.log(`   ✓ ${produtosDB.length} produtos carregados`);


  // 3. Limpar dados anteriores de vendas
  console.log('\n🗑  Limpando vendas anteriores...');
  await db.delete(itensVenda);
  await db.delete(cuponsFiscais);
  console.log('   ✓ Limpo');

  // 4. Processar cada PDF
  let totalCupons = 0;
  let totalItens = 0;
  let totalMatchados = 0;
  let totalNaoMatchados = 0;
  const naoMatchados = new Map<string, number>(); // desc → contagem

  for (const pdfPath of pdfs) {
    const nomeArq = path.basename(pdfPath);
    console.log(`\n📑 Processando: ${nomeArq}`);

    const buf = fs.readFileSync(pdfPath);
    let texto: string;
    try {
      const parsed = await pdfParse(buf);
      texto = parsed.text;
      console.log(`   Páginas: ${parsed.numpages}`);
    } catch (err) {
      console.error(`   ✗ Erro ao parsear PDF: ${(err as Error).message}`);
      continue;
    }

    const cupons = parsearTexto(texto);
    console.log(`   Cupons detectados: ${cupons.length}`);
    if (cupons.length === 0) continue;

    // Insere em lotes
    for (let start = 0; start < cupons.length; start += LOTE_INSERT) {
      const lote = cupons.slice(start, start + LOTE_INSERT);

      const cuponRows = lote.map(c => ({
        numeroCupom: c.numeroCupom,
        dataVenda: c.dataVenda,
        horaVenda: c.horaVenda || null,
        valorTotal: String(c.valorTotal.toFixed(2)),
        desconto: String(c.desconto.toFixed(2)),
        valorLiquido: String(c.valorLiquido.toFixed(2)),
        formaPagamento: c.formaPagamento || null,
        pdv: c.pdv || null,
        cancelado: c.cancelado,
      }));

      const insertedCupons = await db
        .insert(cuponsFiscais)
        .values(cuponRows)
        .returning({ id: cuponsFiscais.id });

      // Monta itens deste lote
      const itensDoBatch: (typeof itensVenda.$inferInsert)[] = [];

      for (let j = 0; j < lote.length; j++) {
        const cupom = lote[j];
        const cupomId = insertedCupons[j]?.id;
        if (!cupomId) continue;

        for (const item of cupom.itens) {
          const produtoId = matchProduto(item.descricao, item.codigoProduto, matchIdx, produtosDB);

          if (produtoId) {
            totalMatchados++;
          } else {
            totalNaoMatchados++;
            const cnt = naoMatchados.get(item.descricao) || 0;
            naoMatchados.set(item.descricao, cnt + 1);
          }

          itensDoBatch.push({
            cupomId,
            produtoId: produtoId ?? null,
            descricaoOriginal: item.descricao,
            codigoProduto: item.codigoProduto || null,
            quantidade: String(item.quantidade),
            precoUnitario: String(item.precoUnitario.toFixed(2)),
            valorTotal: String(item.valorTotal.toFixed(2)),
            desconto: '0',
          });
        }
      }

      if (itensDoBatch.length > 0) {
        // Insere itens em sub-lotes de 500
        for (let si = 0; si < itensDoBatch.length; si += 500) {
          await db.insert(itensVenda).values(itensDoBatch.slice(si, si + 500));
        }
      }

      totalCupons += lote.length;
      totalItens += itensDoBatch.length;
    }

    console.log(`   ✓ Inseridos`);
  }

  // 5. Resumo
  const cobertura = totalItens > 0 ? ((totalMatchados / totalItens) * 100).toFixed(1) : '0';

  console.log('\n' + '='.repeat(55));
  console.log('✅ IMPORTAÇÃO CONCLUÍDA');
  console.log(`   Cupons fiscais  : ${totalCupons.toLocaleString('pt-BR')}`);
  console.log(`   Itens de venda  : ${totalItens.toLocaleString('pt-BR')}`);
  console.log(`   Matchados (ficha): ${totalMatchados.toLocaleString('pt-BR')} (${cobertura}%)`);
  console.log(`   Sem ficha        : ${totalNaoMatchados.toLocaleString('pt-BR')}`);

  if (naoMatchados.size > 0) {
    console.log('\n📋 Top 20 produtos sem ficha técnica (por frequência de venda):');
    Array.from(naoMatchados.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([nome, cnt]) => console.log(`   [${cnt}×] ${nome}`));
  }

  console.log('='.repeat(55) + '\n');
  process.exit(0);
}

importar().catch(err => {
  console.error('❌ Falha fatal:', err);
  process.exit(1);
});
