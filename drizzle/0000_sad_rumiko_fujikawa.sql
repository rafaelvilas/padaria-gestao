CREATE TYPE "public"."criticidade_alerta" AS ENUM('baixa', 'media', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."perfil_usuario" AS ENUM('dono', 'financeiro', 'compras', 'estoque', 'operacao', 'auditoria');--> statement-breakpoint
CREATE TYPE "public"."status_ajuste" AS ENUM('pendente', 'ajustado', 'ignorado');--> statement-breakpoint
CREATE TYPE "public"."status_alerta" AS ENUM('ativo', 'lido', 'resolvido', 'ignorado');--> statement-breakpoint
CREATE TYPE "public"."status_boleto" AS ENUM('aberto', 'pago', 'vencido', 'cancelado', 'conciliado');--> statement-breakpoint
CREATE TYPE "public"."status_conciliacao_extrato" AS ENUM('pendente', 'conciliado', 'ignorado', 'sem_documento');--> statement-breakpoint
CREATE TYPE "public"."status_cotacao" AS ENUM('aberta', 'aprovada', 'rejeitada', 'expirada');--> statement-breakpoint
CREATE TYPE "public"."status_fornecedor" AS ENUM('ativo', 'inativo', 'bloqueado');--> statement-breakpoint
CREATE TYPE "public"."status_inventario" AS ENUM('em_andamento', 'finalizado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_nf" AS ENUM('pendente', 'conciliada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_conciliacao" AS ENUM('automatica', 'sugerida', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tipo_mov_estoque" AS ENUM('entrada_compra', 'saida_venda', 'saida_perda', 'ajuste_inventario', 'ajuste_manual');--> statement-breakpoint
CREATE TYPE "public"."tipo_perda" AS ENUM('desperdicio_operacional', 'vencimento', 'quebra', 'erro_producao', 'desvio_suspeito', 'ajuste_inventario', 'nao_identificada');--> statement-breakpoint
CREATE TYPE "public"."tipo_transacao" AS ENUM('debito', 'credito');--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"criticidade" "criticidade_alerta" NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"mensagem" text NOT NULL,
	"referencia_tipo" varchar(30),
	"referencia_id" uuid,
	"status" "status_alerta" DEFAULT 'ativo',
	"lido_por" uuid,
	"lido_em" timestamp,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "boletos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nf_id" uuid,
	"fornecedor_id" uuid NOT NULL,
	"codigo_barras" varchar(100),
	"nosso_numero" varchar(100),
	"valor" numeric(10, 2) NOT NULL,
	"data_emissao" date,
	"data_vencimento" date NOT NULL,
	"data_pagamento" date,
	"valor_pago" numeric(10, 2),
	"status" "status_boleto" DEFAULT 'aberto',
	"extrato_id" uuid,
	"conciliacao_tipo" "tipo_conciliacao",
	"conciliado_por" uuid,
	"conciliado_em" timestamp,
	"observacoes" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categorias_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(100) NOT NULL,
	"descricao" text
);
--> statement-breakpoint
CREATE TABLE "categorias_produto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(100) NOT NULL,
	"descricao" text
);
--> statement-breakpoint
CREATE TABLE "cotacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" varchar(50),
	"fornecedor_id" uuid NOT NULL,
	"data_cotacao" date NOT NULL,
	"data_validade" date,
	"prazo_pagamento_dias" integer,
	"prazo_entrega_dias" integer,
	"status" "status_cotacao" DEFAULT 'aberta',
	"observacoes" text,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cupons_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_cupom" varchar(50),
	"data_venda" date NOT NULL,
	"hora_venda" time,
	"valor_total" numeric(10, 2) NOT NULL,
	"desconto" numeric(10, 2) DEFAULT '0',
	"valor_liquido" numeric(10, 2) NOT NULL,
	"forma_pagamento" varchar(50),
	"pdv" varchar(50),
	"cancelado" boolean DEFAULT false,
	"importado_por" uuid,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estoque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"quantidade_atual" numeric(10, 3) DEFAULT '0',
	"quantidade_teorica" numeric(10, 3) DEFAULT '0',
	"custo_medio" numeric(10, 4) DEFAULT '0',
	"ultima_entrada" date,
	"ultima_saida" date,
	"ultima_contagem" date,
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "estoque_insumo_id_unique" UNIQUE("insumo_id")
);
--> statement-breakpoint
CREATE TABLE "extrato_bancario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"banco" varchar(50) DEFAULT 'Sicoob',
	"conta" varchar(30),
	"data_transacao" date NOT NULL,
	"descricao" varchar(300) NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"tipo" "tipo_transacao" NOT NULL,
	"saldo" numeric(10, 2),
	"codigo_transacao" varchar(100),
	"status_conciliacao" "status_conciliacao_extrato" DEFAULT 'pendente',
	"boleto_id" uuid,
	"observacoes" text,
	"importado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fichas_tecnicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"versao" integer DEFAULT 1,
	"rendimento" numeric(10, 3) DEFAULT '1',
	"unidade_rendimento" varchar(20) DEFAULT 'un',
	"ativa" boolean DEFAULT true,
	"observacoes" text,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razao_social" varchar(200) NOT NULL,
	"nome_fantasia" varchar(200),
	"cnpj" varchar(18),
	"telefone" varchar(20),
	"email" varchar(150),
	"contato_nome" varchar(100),
	"prazo_medio_dias" integer DEFAULT 0,
	"status" "status_fornecedor" DEFAULT 'ativo',
	"observacoes" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "fornecedores_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "insumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(50),
	"nome" varchar(200) NOT NULL,
	"categoria_id" uuid,
	"unidade_medida" varchar(20) NOT NULL,
	"estoque_minimo" numeric(10, 3) DEFAULT '0',
	"estoque_maximo" numeric(10, 3),
	"dias_validade" integer,
	"fornecedor_principal_id" uuid,
	"custo_medio" numeric(10, 4) DEFAULT '0',
	"ativo" boolean DEFAULT true,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "insumos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "inventarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_contagem" date NOT NULL,
	"status" "status_inventario" DEFAULT 'em_andamento',
	"responsavel_id" uuid,
	"observacoes" text,
	"total_divergencias" integer DEFAULT 0,
	"valor_divergencia" numeric(10, 2) DEFAULT '0',
	"criado_em" timestamp DEFAULT now(),
	"finalizado_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "itens_cotacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cotacao_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"quantidade" numeric(10, 3) NOT NULL,
	"preco_unitario" numeric(10, 4) NOT NULL,
	"unidade_medida" varchar(20),
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "itens_ficha_tecnica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ficha_tecnica_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"quantidade" numeric(10, 4) NOT NULL,
	"unidade_medida" varchar(20) NOT NULL,
	"fator_perda" numeric(5, 4) DEFAULT '0',
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "itens_inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventario_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"quantidade_teorica" numeric(10, 3),
	"quantidade_contada" numeric(10, 3),
	"divergencia" numeric(10, 3),
	"divergencia_percentual" numeric(7, 4),
	"valor_divergencia" numeric(10, 2),
	"custo_unitario" numeric(10, 4),
	"status_ajuste" "status_ajuste" DEFAULT 'pendente',
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "itens_nf" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nf_id" uuid NOT NULL,
	"insumo_id" uuid,
	"descricao_nf" varchar(300) NOT NULL,
	"codigo_produto_fornecedor" varchar(100),
	"quantidade" numeric(10, 3) NOT NULL,
	"unidade_medida" varchar(20),
	"preco_unitario" numeric(10, 4) NOT NULL,
	"valor_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_venda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cupom_id" uuid NOT NULL,
	"produto_id" uuid,
	"descricao_original" varchar(300) NOT NULL,
	"codigo_produto" varchar(100),
	"quantidade" numeric(10, 3) NOT NULL,
	"preco_unitario" numeric(10, 2) NOT NULL,
	"valor_total" numeric(10, 2) NOT NULL,
	"desconto" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "movimentacoes_estoque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"tipo" "tipo_mov_estoque" NOT NULL,
	"quantidade" numeric(10, 3) NOT NULL,
	"custo_unitario" numeric(10, 4),
	"custo_total" numeric(10, 2),
	"referencia_tipo" varchar(30),
	"referencia_id" uuid,
	"data_movimentacao" timestamp NOT NULL,
	"observacoes" text,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notas_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_nf" varchar(50) NOT NULL,
	"serie" varchar(10),
	"fornecedor_id" uuid NOT NULL,
	"data_emissao" date NOT NULL,
	"data_entrada" date,
	"valor_total" numeric(10, 2) NOT NULL,
	"valor_produtos" numeric(10, 2),
	"valor_impostos" numeric(10, 2) DEFAULT '0',
	"valor_frete" numeric(10, 2) DEFAULT '0',
	"cotacao_id" uuid,
	"chave_nfe" varchar(44),
	"status" "status_nf" DEFAULT 'pendente',
	"observacoes" text,
	"importado_por" uuid,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "perdas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"data_perda" date NOT NULL,
	"quantidade" numeric(10, 3) NOT NULL,
	"custo_unitario" numeric(10, 4),
	"valor_total" numeric(10, 2),
	"tipo_perda" "tipo_perda" NOT NULL,
	"descricao" text,
	"inventario_id" uuid,
	"registrado_por" uuid,
	"aprovado_por" uuid,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(50),
	"codigo_barras" varchar(50),
	"nome" varchar(200) NOT NULL,
	"categoria_id" uuid,
	"preco_venda" numeric(10, 2),
	"unidade_venda" varchar(20) DEFAULT 'un',
	"ativo" boolean DEFAULT true,
	"tem_ficha_tecnica" boolean DEFAULT false,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "produtos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "scores_operacionais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_referencia" date NOT NULL,
	"score_geral" numeric(5, 2),
	"score_cmv" numeric(5, 2),
	"score_perdas" numeric(5, 2),
	"score_acuracidade_estoque" numeric(5, 2),
	"score_conciliacao" numeric(5, 2),
	"score_desvios" numeric(5, 2),
	"score_compras" numeric(5, 2),
	"score_fornecedores" numeric(5, 2),
	"detalhes" jsonb,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(100) NOT NULL,
	"email" varchar(150) NOT NULL,
	"senha_hash" varchar(255) NOT NULL,
	"perfil" "perfil_usuario" DEFAULT 'operacao' NOT NULL,
	"ativo" boolean DEFAULT true,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_lido_por_usuarios_id_fk" FOREIGN KEY ("lido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_nf_id_notas_fiscais_id_fk" FOREIGN KEY ("nf_id") REFERENCES "public"."notas_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_conciliado_por_usuarios_id_fk" FOREIGN KEY ("conciliado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacoes" ADD CONSTRAINT "cotacoes_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacoes" ADD CONSTRAINT "cotacoes_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cupons_fiscais" ADD CONSTRAINT "cupons_fiscais_importado_por_usuarios_id_fk" FOREIGN KEY ("importado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrato_bancario" ADD CONSTRAINT "extrato_bancario_boleto_id_boletos_id_fk" FOREIGN KEY ("boleto_id") REFERENCES "public"."boletos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_categoria_id_categorias_insumo_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_fornecedor_principal_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_principal_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventarios" ADD CONSTRAINT "inventarios_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_cotacao" ADD CONSTRAINT "itens_cotacao_cotacao_id_cotacoes_id_fk" FOREIGN KEY ("cotacao_id") REFERENCES "public"."cotacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_cotacao" ADD CONSTRAINT "itens_cotacao_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_ficha_tecnica" ADD CONSTRAINT "itens_ficha_tecnica_ficha_tecnica_id_fichas_tecnicas_id_fk" FOREIGN KEY ("ficha_tecnica_id") REFERENCES "public"."fichas_tecnicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_ficha_tecnica" ADD CONSTRAINT "itens_ficha_tecnica_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_inventario" ADD CONSTRAINT "itens_inventario_inventario_id_inventarios_id_fk" FOREIGN KEY ("inventario_id") REFERENCES "public"."inventarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_inventario" ADD CONSTRAINT "itens_inventario_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_nf" ADD CONSTRAINT "itens_nf_nf_id_notas_fiscais_id_fk" FOREIGN KEY ("nf_id") REFERENCES "public"."notas_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_nf" ADD CONSTRAINT "itens_nf_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_cupom_id_cupons_fiscais_id_fk" FOREIGN KEY ("cupom_id") REFERENCES "public"."cupons_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_cotacao_id_cotacoes_id_fk" FOREIGN KEY ("cotacao_id") REFERENCES "public"."cotacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_importado_por_usuarios_id_fk" FOREIGN KEY ("importado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perdas" ADD CONSTRAINT "perdas_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perdas" ADD CONSTRAINT "perdas_inventario_id_inventarios_id_fk" FOREIGN KEY ("inventario_id") REFERENCES "public"."inventarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perdas" ADD CONSTRAINT "perdas_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perdas" ADD CONSTRAINT "perdas_aprovado_por_usuarios_id_fk" FOREIGN KEY ("aprovado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_categorias_produto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_produto"("id") ON DELETE no action ON UPDATE no action;