import { pgTable, uuid, varchar, text, boolean, integer, decimal, date, timestamp, time, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// --- ENUMS ---
export const perfilEnum = pgEnum('perfil_usuario', ['dono', 'financeiro', 'compras', 'estoque', 'operacao', 'auditoria']);
export const statusFornecedorEnum = pgEnum('status_fornecedor', ['ativo', 'inativo', 'bloqueado']);
export const statusCotacaoEnum = pgEnum('status_cotacao', ['aberta', 'aprovada', 'rejeitada', 'expirada']);
export const statusNfEnum = pgEnum('status_nf', ['pendente', 'conciliada', 'cancelada']);
export const statusBoletoEnum = pgEnum('status_boleto', ['aberto', 'pago', 'vencido', 'cancelado', 'conciliado']);
export const tipoConciliacaoEnum = pgEnum('tipo_conciliacao', ['automatica', 'sugerida', 'manual']);
export const tipoTransacaoEnum = pgEnum('tipo_transacao', ['debito', 'credito']);
export const statusConciliacaoEnum = pgEnum('status_conciliacao_extrato', ['pendente', 'conciliado', 'ignorado', 'sem_documento']);
export const tipoMovEstoqueEnum = pgEnum('tipo_mov_estoque', ['entrada_compra', 'saida_venda', 'saida_perda', 'ajuste_inventario', 'ajuste_manual']);
export const statusInventarioEnum = pgEnum('status_inventario', ['em_andamento', 'finalizado', 'cancelado']);
export const statusAjusteEnum = pgEnum('status_ajuste', ['pendente', 'ajustado', 'ignorado']);
export const tipoPerdaEnum = pgEnum('tipo_perda', ['desperdicio_operacional', 'vencimento', 'quebra', 'erro_producao', 'desvio_suspeito', 'ajuste_inventario', 'nao_identificada']);
export const criticidadeAlertaEnum = pgEnum('criticidade_alerta', ['baixa', 'media', 'alta', 'critica']);
export const statusAlertaEnum = pgEnum('status_alerta', ['ativo', 'lido', 'resolvido', 'ignorado']);

// --- TABELAS ---
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar('nome', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).unique().notNull(),
  senhaHash: varchar('senha_hash', { length: 255 }).notNull(),
  perfil: perfilEnum('perfil').notNull().default('operacao'),
  ativo: boolean('ativo').default(true),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const fornecedores = pgTable('fornecedores', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  razaoSocial: varchar('razao_social', { length: 200 }).notNull(),
  nomeFantasia: varchar('nome_fantasia', { length: 200 }),
  cnpj: varchar('cnpj', { length: 18 }).unique(),
  telefone: varchar('telefone', { length: 20 }),
  email: varchar('email', { length: 150 }),
  contatoNome: varchar('contato_nome', { length: 100 }),
  prazoMedioDias: integer('prazo_medio_dias').default(0),
  status: statusFornecedorEnum('status').default('ativo'),
  observacoes: text('observacoes'),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const categoriasInsumo = pgTable('categorias_insumo', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar('nome', { length: 100 }).notNull(),
  descricao: text('descricao'),
});

export const insumos = pgTable('insumos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  codigo: varchar('codigo', { length: 50 }).unique(),
  nome: varchar('nome', { length: 200 }).notNull(),
  categoriaId: uuid('categoria_id').references(() => categoriasInsumo.id),
  unidadeMedida: varchar('unidade_medida', { length: 20 }).notNull(),
  estoqueMinimo: decimal('estoque_minimo', { precision: 10, scale: 3 }).default('0'),
  estoqueMaximo: decimal('estoque_maximo', { precision: 10, scale: 3 }),
  diasValidade: integer('dias_validade'),
  fornecedorPrincipalId: uuid('fornecedor_principal_id').references(() => fornecedores.id),
  custoMedio: decimal('custo_medio', { precision: 10, scale: 4 }).default('0'),
  ativo: boolean('ativo').default(true),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const categoriasProduto = pgTable('categorias_produto', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar('nome', { length: 100 }).notNull(),
  descricao: text('descricao'),
});

export const produtos = pgTable('produtos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  codigo: varchar('codigo', { length: 50 }).unique(),
  codigoBarras: varchar('codigo_barras', { length: 50 }),
  nome: varchar('nome', { length: 200 }).notNull(),
  categoriaId: uuid('categoria_id').references(() => categoriasProduto.id),
  precoVenda: decimal('preco_venda', { precision: 10, scale: 2 }),
  unidadeVenda: varchar('unidade_venda', { length: 20 }).default('un'),
  ativo: boolean('ativo').default(true),
  temFichaTecnica: boolean('tem_ficha_tecnica').default(false),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const fichasTecnicas = pgTable('fichas_tecnicas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  produtoId: uuid('produto_id').notNull().references(() => produtos.id),
  versao: integer('versao').default(1),
  rendimento: decimal('rendimento', { precision: 10, scale: 3 }).default('1'),
  unidadeRendimento: varchar('unidade_rendimento', { length: 20 }).default('un'),
  cmvAlvo: decimal('cmv_alvo', { precision: 5, scale: 2 }),   // % alvo ex: 28.00
  custoFicha: decimal('custo_ficha', { precision: 10, scale: 4 }), // custo total calculado na importação
  ativa: boolean('ativa').default(true),
  observacoes: text('observacoes'),
  criadoPor: uuid('criado_por').references(() => usuarios.id),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const itensFichaTecnica = pgTable('itens_ficha_tecnica', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  fichaTecnicaId: uuid('ficha_tecnica_id').notNull().references(() => fichasTecnicas.id),
  insumoId: uuid('insumo_id').notNull().references(() => insumos.id),
  quantidade: decimal('quantidade', { precision: 10, scale: 4 }).notNull(),
  unidadeMedida: varchar('unidade_medida', { length: 20 }).notNull(),
  fatorPerda: decimal('fator_perda', { precision: 5, scale: 4 }).default('0'),
  observacoes: text('observacoes'),
});

export const cotacoes = pgTable('cotacoes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  numero: varchar('numero', { length: 50 }),
  fornecedorId: uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  dataCotacao: date('data_cotacao').notNull(),
  dataValidade: date('data_validade'),
  prazoPagamentoDias: integer('prazo_pagamento_dias'),
  prazoEntregaDias: integer('prazo_entrega_dias'),
  status: statusCotacaoEnum('status').default('aberta'),
  observacoes: text('observacoes'),
  criadoPor: uuid('criado_por').references(() => usuarios.id),
  criadoEm: timestamp('criado_em').default(sql`now()`),
});

export const itensCotacao = pgTable('itens_cotacao', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  cotacaoId: uuid('cotacao_id').notNull().references(() => cotacoes.id),
  insumoId: uuid('insumo_id').notNull().references(() => insumos.id),
  quantidade: decimal('quantidade', { precision: 10, scale: 3 }).notNull(),
  precoUnitario: decimal('preco_unitario', { precision: 10, scale: 4 }).notNull(),
  unidadeMedida: varchar('unidade_medida', { length: 20 }),
  observacoes: text('observacoes'),
});

export const notasFiscais = pgTable('notas_fiscais', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  numeroNf: varchar('numero_nf', { length: 50 }).notNull(),
  serie: varchar('serie', { length: 10 }),
  fornecedorId: uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  dataEmissao: date('data_emissao').notNull(),
  dataEntrada: date('data_entrada'),
  valorTotal: decimal('valor_total', { precision: 10, scale: 2 }).notNull(),
  valorProdutos: decimal('valor_produtos', { precision: 10, scale: 2 }),
  valorImpostos: decimal('valor_impostos', { precision: 10, scale: 2 }).default('0'),
  valorFrete: decimal('valor_frete', { precision: 10, scale: 2 }).default('0'),
  cotacaoId: uuid('cotacao_id').references(() => cotacoes.id),
  chaveNfe: varchar('chave_nfe', { length: 44 }),
  status: statusNfEnum('status').default('pendente'),
  observacoes: text('observacoes'),
  importadoPor: uuid('importado_por').references(() => usuarios.id),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const itensNf = pgTable('itens_nf', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nfId: uuid('nf_id').notNull().references(() => notasFiscais.id),
  insumoId: uuid('insumo_id').references(() => insumos.id),
  descricaoNf: varchar('descricao_nf', { length: 300 }).notNull(),
  codigoProdutoFornecedor: varchar('codigo_produto_fornecedor', { length: 100 }),
  quantidade: decimal('quantidade', { precision: 10, scale: 3 }).notNull(),
  unidadeMedida: varchar('unidade_medida', { length: 20 }),
  precoUnitario: decimal('preco_unitario', { precision: 10, scale: 4 }).notNull(),
  valorTotal: decimal('valor_total', { precision: 10, scale: 2 }).notNull(),
});

export const boletos = pgTable('boletos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nfId: uuid('nf_id').references(() => notasFiscais.id),
  fornecedorId: uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  codigoBarras: varchar('codigo_barras', { length: 100 }),
  nossoNumero: varchar('nosso_numero', { length: 100 }),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  dataEmissao: date('data_emissao'),
  dataVencimento: date('data_vencimento').notNull(),
  dataPagamento: date('data_pagamento'),
  valorPago: decimal('valor_pago', { precision: 10, scale: 2 }),
  status: statusBoletoEnum('status').default('aberto'),
  extratoId: uuid('extrato_id'),
  conciliacaoTipo: tipoConciliacaoEnum('conciliacao_tipo'),
  conciliadoPor: uuid('conciliado_por').references(() => usuarios.id),
  conciliadoEm: timestamp('conciliado_em'),
  observacoes: text('observacoes'),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const extratoBancario = pgTable('extrato_bancario', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  banco: varchar('banco', { length: 50 }).default('Sicoob'),
  conta: varchar('conta', { length: 30 }),
  dataTransacao: date('data_transacao').notNull(),
  descricao: varchar('descricao', { length: 300 }).notNull(),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  tipo: tipoTransacaoEnum('tipo').notNull(),
  saldo: decimal('saldo', { precision: 10, scale: 2 }),
  codigoTransacao: varchar('codigo_transacao', { length: 100 }),
  statusConciliacao: statusConciliacaoEnum('status_conciliacao').default('pendente'),
  boletoId: uuid('boleto_id').references(() => boletos.id),
  observacoes: text('observacoes'),
  importadoEm: timestamp('importado_em').default(sql`now()`),
});

export const cuponsFiscais = pgTable('cupons_fiscais', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  numeroCupom: varchar('numero_cupom', { length: 50 }),
  dataVenda: date('data_venda').notNull(),
  horaVenda: time('hora_venda'),
  valorTotal: decimal('valor_total', { precision: 10, scale: 2 }).notNull(),
  desconto: decimal('desconto', { precision: 10, scale: 2 }).default('0'),
  valorLiquido: decimal('valor_liquido', { precision: 10, scale: 2 }).notNull(),
  formaPagamento: varchar('forma_pagamento', { length: 50 }),
  pdv: varchar('pdv', { length: 50 }),
  cancelado: boolean('cancelado').default(false),
  importadoPor: uuid('importado_por').references(() => usuarios.id),
  criadoEm: timestamp('criado_em').default(sql`now()`),
});

export const itensVenda = pgTable('itens_venda', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  cupomId: uuid('cupom_id').notNull().references(() => cuponsFiscais.id),
  produtoId: uuid('produto_id').references(() => produtos.id),
  descricaoOriginal: varchar('descricao_original', { length: 300 }).notNull(),
  codigoProduto: varchar('codigo_produto', { length: 100 }),
  quantidade: decimal('quantidade', { precision: 10, scale: 3 }).notNull(),
  precoUnitario: decimal('preco_unitario', { precision: 10, scale: 2 }).notNull(),
  valorTotal: decimal('valor_total', { precision: 10, scale: 2 }).notNull(),
  desconto: decimal('desconto', { precision: 10, scale: 2 }).default('0'),
});

export const estoque = pgTable('estoque', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  insumoId: uuid('insumo_id').notNull().unique().references(() => insumos.id),
  quantidadeAtual: decimal('quantidade_atual', { precision: 10, scale: 3 }).default('0'),
  quantidadeTeorica: decimal('quantidade_teorica', { precision: 10, scale: 3 }).default('0'),
  custoMedio: decimal('custo_medio', { precision: 10, scale: 4 }).default('0'),
  ultimaEntrada: date('ultima_entrada'),
  ultimaSaida: date('ultima_saida'),
  ultimaContagem: date('ultima_contagem'),
  atualizadoEm: timestamp('atualizado_em').default(sql`now()`),
});

export const movimentacoesEstoque = pgTable('movimentacoes_estoque', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  insumoId: uuid('insumo_id').notNull().references(() => insumos.id),
  tipo: tipoMovEstoqueEnum('tipo').notNull(),
  quantidade: decimal('quantidade', { precision: 10, scale: 3 }).notNull(),
  custoUnitario: decimal('custo_unitario', { precision: 10, scale: 4 }),
  custoTotal: decimal('custo_total', { precision: 10, scale: 2 }),
  referenciaTipo: varchar('referencia_tipo', { length: 30 }),
  referenciaId: uuid('referencia_id'),
  dataMovimentacao: timestamp('data_movimentacao').notNull(),
  observacoes: text('observacoes'),
  criadoPor: uuid('criado_por').references(() => usuarios.id),
  criadoEm: timestamp('criado_em').default(sql`now()`),
});

export const inventarios = pgTable('inventarios', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  dataContagem: date('data_contagem').notNull(),
  status: statusInventarioEnum('status').default('em_andamento'),
  responsavelId: uuid('responsavel_id').references(() => usuarios.id),
  observacoes: text('observacoes'),
  totalDivergencias: integer('total_divergencias').default(0),
  valorDivergencia: decimal('valor_divergencia', { precision: 10, scale: 2 }).default('0'),
  criadoEm: timestamp('criado_em').default(sql`now()`),
  finalizadoEm: timestamp('finalizado_em'),
});

export const itensInventario = pgTable('itens_inventario', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  inventarioId: uuid('inventario_id').notNull().references(() => inventarios.id),
  insumoId: uuid('insumo_id').notNull().references(() => insumos.id),
  quantidadeTeorica: decimal('quantidade_teorica', { precision: 10, scale: 3 }),
  quantidadeContada: decimal('quantidade_contada', { precision: 10, scale: 3 }),
  divergencia: decimal('divergencia', { precision: 10, scale: 3 }),
  divergenciaPercentual: decimal('divergencia_percentual', { precision: 7, scale: 4 }),
  valorDivergencia: decimal('valor_divergencia', { precision: 10, scale: 2 }),
  custoUnitario: decimal('custo_unitario', { precision: 10, scale: 4 }),
  statusAjuste: statusAjusteEnum('status_ajuste').default('pendente'),
  observacoes: text('observacoes'),
});

export const perdas = pgTable('perdas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  insumoId: uuid('insumo_id').notNull().references(() => insumos.id),
  dataPerda: date('data_perda').notNull(),
  quantidade: decimal('quantidade', { precision: 10, scale: 3 }).notNull(),
  custoUnitario: decimal('custo_unitario', { precision: 10, scale: 4 }),
  valorTotal: decimal('valor_total', { precision: 10, scale: 2 }),
  tipoPerda: tipoPerdaEnum('tipo_perda').notNull(),
  descricao: text('descricao'),
  inventarioId: uuid('inventario_id').references(() => inventarios.id),
  registradoPor: uuid('registrado_por').references(() => usuarios.id),
  aprovadoPor: uuid('aprovado_por').references(() => usuarios.id),
  criadoEm: timestamp('criado_em').default(sql`now()`),
});

export const alertas = pgTable('alertas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tipo: varchar('tipo', { length: 50 }).notNull(),
  criticidade: criticidadeAlertaEnum('criticidade').notNull(),
  titulo: varchar('titulo', { length: 200 }).notNull(),
  mensagem: text('mensagem').notNull(),
  referenciaTipo: varchar('referencia_tipo', { length: 30 }),
  referenciaId: uuid('referencia_id'),
  status: statusAlertaEnum('status').default('ativo'),
  lidoPor: uuid('lido_por').references(() => usuarios.id),
  lidoEm: timestamp('lido_em'),
  criadoEm: timestamp('criado_em').default(sql`now()`),
});

export const scoresOperacionais = pgTable('scores_operacionais', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  dataReferencia: date('data_referencia').notNull(),
  scoreGeral: decimal('score_geral', { precision: 5, scale: 2 }),
  scoreCmv: decimal('score_cmv', { precision: 5, scale: 2 }),
  scorePerdas: decimal('score_perdas', { precision: 5, scale: 2 }),
  scoreAcuracidadeEstoque: decimal('score_acuracidade_estoque', { precision: 5, scale: 2 }),
  scoreConciliacao: decimal('score_conciliacao', { precision: 5, scale: 2 }),
  scoreDesvios: decimal('score_desvios', { precision: 5, scale: 2 }),
  scoreCompras: decimal('score_compras', { precision: 5, scale: 2 }),
  scoreFornecedores: decimal('score_fornecedores', { precision: 5, scale: 2 }),
  detalhes: jsonb('detalhes'),
  criadoEm: timestamp('criado_em').default(sql`now()`),
});
