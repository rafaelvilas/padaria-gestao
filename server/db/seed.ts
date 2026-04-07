import { db } from './index';
import {
  usuarios, fornecedores, categoriasInsumo, insumos,
  categoriasProduto, produtos, fichasTecnicas, itensFichaTecnica, estoque
} from './schema';
import { createHash } from 'crypto';

function hashSenha(senha: string): string {
  return createHash('sha256').update(senha).digest('hex');
}

export async function runSeed() {
  console.log('Iniciando seed...');

  // 1. Usuário admin
  const [admin] = await db.insert(usuarios).values({
    nome: 'Administrador',
    email: 'admin@padaria.com',
    senhaHash: hashSenha('admin123'),
    perfil: 'dono',
    ativo: true,
  }).returning();
  console.log('Usuário admin criado:', admin.email);

  // 2. Fornecedores
  const [fornMoinho, fornLatic, fornDist, fornOvos, fornAcucar] = await db.insert(fornecedores).values([
    {
      razaoSocial: 'Moinho Premium Ltda',
      nomeFantasia: 'Moinho Premium',
      cnpj: '12.345.678/0001-90',
      telefone: '(11) 99999-0001',
      email: 'vendas@moinhopremiun.com',
      contatoNome: 'Carlos Silva',
      prazoMedioDias: 30,
      status: 'ativo',
    },
    {
      razaoSocial: 'Laticínios Del Valle S.A.',
      nomeFantasia: 'Del Valle',
      cnpj: '12.345.678/0002-71',
      telefone: '(11) 99999-0002',
      email: 'pedidos@delvalle.com',
      contatoNome: 'Maria Santos',
      prazoMedioDias: 15,
      status: 'ativo',
    },
    {
      razaoSocial: 'Distribuidora XYZ Comércio Ltda',
      nomeFantasia: 'Distribuidora XYZ',
      cnpj: '12.345.678/0003-52',
      telefone: '(11) 99999-0003',
      email: 'comercial@distxyz.com',
      contatoNome: 'João Pereira',
      prazoMedioDias: 28,
      status: 'ativo',
    },
    {
      razaoSocial: 'Granja Ovos do Campo ME',
      nomeFantasia: 'Ovos do Campo',
      cnpj: '12.345.678/0004-33',
      telefone: '(11) 99999-0004',
      email: 'ovos@campo.com',
      contatoNome: 'Pedro Campos',
      prazoMedioDias: 7,
      status: 'ativo',
    },
    {
      razaoSocial: 'Açúcar São Paulo Indústria S.A.',
      nomeFantasia: 'Açúcar SP',
      cnpj: '12.345.678/0005-14',
      telefone: '(11) 99999-0005',
      email: 'vendas@acucarsp.com',
      contatoNome: 'Ana Ferreira',
      prazoMedioDias: 30,
      status: 'ativo',
    },
  ]).returning();
  console.log('5 fornecedores criados');

  // 3. Categorias de insumo
  const [catFarinaceos, catLaticinios, catOutros] = await db.insert(categoriasInsumo).values([
    { nome: 'Farináceos', descricao: 'Farinhas, amidos e similares' },
    { nome: 'Laticínios', descricao: 'Leite, manteiga, queijo e similares' },
    { nome: 'Outros', descricao: 'Demais ingredientes e insumos' },
  ]).returning();
  console.log('3 categorias de insumo criadas');

  // 4. Insumos
  const insumosData = await db.insert(insumos).values([
    {
      codigo: 'INS-001',
      nome: 'Farinha de Trigo Especial',
      categoriaId: catFarinaceos.id,
      unidadeMedida: 'kg',
      estoqueMinimo: '50',
      estoqueMaximo: '500',
      diasValidade: 180,
      fornecedorPrincipalId: fornMoinho.id,
      custoMedio: '3.50',
    },
    {
      codigo: 'INS-002',
      nome: 'Açúcar Refinado',
      categoriaId: catOutros.id,
      unidadeMedida: 'kg',
      estoqueMinimo: '30',
      estoqueMaximo: '300',
      diasValidade: 365,
      fornecedorPrincipalId: fornAcucar.id,
      custoMedio: '4.20',
    },
    {
      codigo: 'INS-003',
      nome: 'Manteiga com Sal',
      categoriaId: catLaticinios.id,
      unidadeMedida: 'kg',
      estoqueMinimo: '10',
      estoqueMaximo: '100',
      diasValidade: 90,
      fornecedorPrincipalId: fornLatic.id,
      custoMedio: '28.00',
    },
    {
      codigo: 'INS-004',
      nome: 'Ovos',
      categoriaId: catOutros.id,
      unidadeMedida: 'un',
      estoqueMinimo: '120',
      estoqueMaximo: '600',
      diasValidade: 30,
      fornecedorPrincipalId: fornOvos.id,
      custoMedio: '0.65',
    },
    {
      codigo: 'INS-005',
      nome: 'Leite Integral',
      categoriaId: catLaticinios.id,
      unidadeMedida: 'L',
      estoqueMinimo: '20',
      estoqueMaximo: '200',
      diasValidade: 7,
      fornecedorPrincipalId: fornLatic.id,
      custoMedio: '4.80',
    },
    {
      codigo: 'INS-006',
      nome: 'Fermento Biológico Fresco',
      categoriaId: catOutros.id,
      unidadeMedida: 'g',
      estoqueMinimo: '500',
      estoqueMaximo: '5000',
      diasValidade: 14,
      fornecedorPrincipalId: fornDist.id,
      custoMedio: '0.03',
    },
    {
      codigo: 'INS-007',
      nome: 'Chocolate em Pó 50%',
      categoriaId: catOutros.id,
      unidadeMedida: 'kg',
      estoqueMinimo: '5',
      estoqueMaximo: '50',
      diasValidade: 365,
      fornecedorPrincipalId: fornDist.id,
      custoMedio: '22.00',
    },
    {
      codigo: 'INS-008',
      nome: 'Sal Refinado',
      categoriaId: catOutros.id,
      unidadeMedida: 'kg',
      estoqueMinimo: '5',
      estoqueMaximo: '50',
      diasValidade: 1095,
      fornecedorPrincipalId: fornDist.id,
      custoMedio: '2.00',
    },
    {
      codigo: 'INS-009',
      nome: 'Óleo de Soja',
      categoriaId: catOutros.id,
      unidadeMedida: 'L',
      estoqueMinimo: '10',
      estoqueMaximo: '100',
      diasValidade: 365,
      fornecedorPrincipalId: fornDist.id,
      custoMedio: '7.50',
    },
    {
      codigo: 'INS-010',
      nome: 'Creme de Leite',
      categoriaId: catLaticinios.id,
      unidadeMedida: 'L',
      estoqueMinimo: '5',
      estoqueMaximo: '50',
      diasValidade: 30,
      fornecedorPrincipalId: fornLatic.id,
      custoMedio: '12.00',
    },
  ]).returning();
  console.log('10 insumos criados');

  const [ins_farinha, ins_acucar, ins_manteiga, ins_ovos, ins_leite, ins_fermento, ins_chocolate, ins_sal, ins_oleo, ins_creme] = insumosData;

  // 5. Categorias de produto
  const [catPaes, catBolos, catDoces] = await db.insert(categoriasProduto).values([
    { nome: 'Pães', descricao: 'Pães artesanais e industriais' },
    { nome: 'Bolos', descricao: 'Bolos e tortas' },
    { nome: 'Doces', descricao: 'Doces, brigadeiros e similares' },
  ]).returning();
  console.log('3 categorias de produto criadas');

  // 6. Produtos
  const produtosData = await db.insert(produtos).values([
    {
      codigo: 'PRD-001',
      nome: 'Pão Francês',
      categoriaId: catPaes.id,
      precoVenda: '0.65',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-002',
      nome: 'Pão de Forma',
      categoriaId: catPaes.id,
      precoVenda: '8.50',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-003',
      nome: 'Bolo de Chocolate',
      categoriaId: catBolos.id,
      precoVenda: '45.00',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-004',
      nome: 'Coxinha',
      categoriaId: catDoces.id,
      precoVenda: '4.50',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-005',
      nome: 'Croissant',
      categoriaId: catPaes.id,
      precoVenda: '7.50',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-006',
      nome: 'Brigadeiro',
      categoriaId: catDoces.id,
      precoVenda: '2.50',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-007',
      nome: 'Torta de Morango',
      categoriaId: catBolos.id,
      precoVenda: '65.00',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-008',
      nome: 'Pão de Queijo',
      categoriaId: catPaes.id,
      precoVenda: '3.50',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-009',
      nome: 'Cupcake',
      categoriaId: catDoces.id,
      precoVenda: '8.00',
      unidadeVenda: 'un',
      ativo: true,
    },
    {
      codigo: 'PRD-010',
      nome: 'Sonho',
      categoriaId: catPaes.id,
      precoVenda: '4.00',
      unidadeVenda: 'un',
      ativo: true,
    },
  ]).returning();
  console.log('10 produtos criados');

  const [prd_paofrances, prd_paoforma, prd_bolocho, prd_coxinha, prd_croissant] = produtosData;

  // 7. Fichas técnicas simples
  // Ficha Pão Francês
  const [fichaFrances] = await db.insert(fichasTecnicas).values({
    produtoId: prd_paofrances.id,
    versao: 1,
    rendimento: '50',
    unidadeRendimento: 'un',
    ativa: true,
    observacoes: 'Rende 50 unidades de 50g',
    criadoPor: admin.id,
  }).returning();

  await db.insert(itensFichaTecnica).values([
    { fichaTecnicaId: fichaFrances.id, insumoId: ins_farinha.id, quantidade: '1.000', unidadeMedida: 'kg', fatorPerda: '0.02' },
    { fichaTecnicaId: fichaFrances.id, insumoId: ins_fermento.id, quantidade: '15', unidadeMedida: 'g', fatorPerda: '0' },
    { fichaTecnicaId: fichaFrances.id, insumoId: ins_sal.id, quantidade: '0.020', unidadeMedida: 'kg', fatorPerda: '0' },
  ]);

  // Ficha Bolo de Chocolate
  const [fichaBoloChoco] = await db.insert(fichasTecnicas).values({
    produtoId: prd_bolocho.id,
    versao: 1,
    rendimento: '1',
    unidadeRendimento: 'un',
    ativa: true,
    observacoes: 'Bolo de 18cm',
    criadoPor: admin.id,
  }).returning();

  await db.insert(itensFichaTecnica).values([
    { fichaTecnicaId: fichaBoloChoco.id, insumoId: ins_farinha.id, quantidade: '0.250', unidadeMedida: 'kg', fatorPerda: '0.01' },
    { fichaTecnicaId: fichaBoloChoco.id, insumoId: ins_acucar.id, quantidade: '0.300', unidadeMedida: 'kg', fatorPerda: '0' },
    { fichaTecnicaId: fichaBoloChoco.id, insumoId: ins_ovos.id, quantidade: '4', unidadeMedida: 'un', fatorPerda: '0' },
    { fichaTecnicaId: fichaBoloChoco.id, insumoId: ins_leite.id, quantidade: '0.200', unidadeMedida: 'L', fatorPerda: '0' },
    { fichaTecnicaId: fichaBoloChoco.id, insumoId: ins_chocolate.id, quantidade: '0.100', unidadeMedida: 'kg', fatorPerda: '0' },
    { fichaTecnicaId: fichaBoloChoco.id, insumoId: ins_manteiga.id, quantidade: '0.100', unidadeMedida: 'kg', fatorPerda: '0' },
  ]);

  // Ficha Croissant
  const [fichaCroissant] = await db.insert(fichasTecnicas).values({
    produtoId: prd_croissant.id,
    versao: 1,
    rendimento: '12',
    unidadeRendimento: 'un',
    ativa: true,
    observacoes: 'Rende 12 unidades',
    criadoPor: admin.id,
  }).returning();

  await db.insert(itensFichaTecnica).values([
    { fichaTecnicaId: fichaCroissant.id, insumoId: ins_farinha.id, quantidade: '0.500', unidadeMedida: 'kg', fatorPerda: '0.02' },
    { fichaTecnicaId: fichaCroissant.id, insumoId: ins_manteiga.id, quantidade: '0.250', unidadeMedida: 'kg', fatorPerda: '0.01' },
    { fichaTecnicaId: fichaCroissant.id, insumoId: ins_leite.id, quantidade: '0.150', unidadeMedida: 'L', fatorPerda: '0' },
    { fichaTecnicaId: fichaCroissant.id, insumoId: ins_acucar.id, quantidade: '0.050', unidadeMedida: 'kg', fatorPerda: '0' },
    { fichaTecnicaId: fichaCroissant.id, insumoId: ins_fermento.id, quantidade: '10', unidadeMedida: 'g', fatorPerda: '0' },
  ]);

  // Ficha Pão de Forma
  const [fichaForma] = await db.insert(fichasTecnicas).values({
    produtoId: prd_paoforma.id,
    versao: 1,
    rendimento: '1',
    unidadeRendimento: 'un',
    ativa: true,
    observacoes: 'Forma padrão 500g',
    criadoPor: admin.id,
  }).returning();

  await db.insert(itensFichaTecnica).values([
    { fichaTecnicaId: fichaForma.id, insumoId: ins_farinha.id, quantidade: '0.500', unidadeMedida: 'kg', fatorPerda: '0.02' },
    { fichaTecnicaId: fichaForma.id, insumoId: ins_leite.id, quantidade: '0.200', unidadeMedida: 'L', fatorPerda: '0' },
    { fichaTecnicaId: fichaForma.id, insumoId: ins_oleo.id, quantidade: '0.030', unidadeMedida: 'L', fatorPerda: '0' },
    { fichaTecnicaId: fichaForma.id, insumoId: ins_acucar.id, quantidade: '0.030', unidadeMedida: 'kg', fatorPerda: '0' },
    { fichaTecnicaId: fichaForma.id, insumoId: ins_fermento.id, quantidade: '10', unidadeMedida: 'g', fatorPerda: '0' },
    { fichaTecnicaId: fichaForma.id, insumoId: ins_sal.id, quantidade: '0.010', unidadeMedida: 'kg', fatorPerda: '0' },
  ]);

  // Ficha Coxinha
  const [fichaCoxinha] = await db.insert(fichasTecnicas).values({
    produtoId: prd_coxinha.id,
    versao: 1,
    rendimento: '20',
    unidadeRendimento: 'un',
    ativa: true,
    observacoes: 'Rende 20 unidades',
    criadoPor: admin.id,
  }).returning();

  await db.insert(itensFichaTecnica).values([
    { fichaTecnicaId: fichaCoxinha.id, insumoId: ins_farinha.id, quantidade: '0.500', unidadeMedida: 'kg', fatorPerda: '0.02' },
    { fichaTecnicaId: fichaCoxinha.id, insumoId: ins_leite.id, quantidade: '0.500', unidadeMedida: 'L', fatorPerda: '0' },
    { fichaTecnicaId: fichaCoxinha.id, insumoId: ins_oleo.id, quantidade: '0.500', unidadeMedida: 'L', fatorPerda: '0' },
    { fichaTecnicaId: fichaCoxinha.id, insumoId: ins_sal.id, quantidade: '0.010', unidadeMedida: 'kg', fatorPerda: '0' },
  ]);

  // Atualizar produtos com temFichaTecnica
  const { produtos: produtosSchema } = await import('./schema');
  const { eq } = await import('drizzle-orm');
  await db.update(produtosSchema).set({ temFichaTecnica: true }).where(
    eq(produtosSchema.id, prd_paofrances.id)
  );
  await db.update(produtosSchema).set({ temFichaTecnica: true }).where(
    eq(produtosSchema.id, prd_paoforma.id)
  );
  await db.update(produtosSchema).set({ temFichaTecnica: true }).where(
    eq(produtosSchema.id, prd_bolocho.id)
  );
  await db.update(produtosSchema).set({ temFichaTecnica: true }).where(
    eq(produtosSchema.id, prd_coxinha.id)
  );
  await db.update(produtosSchema).set({ temFichaTecnica: true }).where(
    eq(produtosSchema.id, prd_croissant.id)
  );
  console.log('5 fichas técnicas criadas');

  // 8. Estoque inicial
  await db.insert(estoque).values([
    { insumoId: ins_farinha.id, quantidadeAtual: '150', quantidadeTeorica: '150', custoMedio: '3.50', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_acucar.id, quantidadeAtual: '80', quantidadeTeorica: '80', custoMedio: '4.20', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_manteiga.id, quantidadeAtual: '25', quantidadeTeorica: '25', custoMedio: '28.00', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_ovos.id, quantidadeAtual: '240', quantidadeTeorica: '240', custoMedio: '0.65', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_leite.id, quantidadeAtual: '40', quantidadeTeorica: '40', custoMedio: '4.80', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_fermento.id, quantidadeAtual: '2000', quantidadeTeorica: '2000', custoMedio: '0.03', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_chocolate.id, quantidadeAtual: '12', quantidadeTeorica: '12', custoMedio: '22.00', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_sal.id, quantidadeAtual: '20', quantidadeTeorica: '20', custoMedio: '2.00', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_oleo.id, quantidadeAtual: '30', quantidadeTeorica: '30', custoMedio: '7.50', ultimaEntrada: new Date().toISOString().split('T')[0] },
    { insumoId: ins_creme.id, quantidadeAtual: '15', quantidadeTeorica: '15', custoMedio: '12.00', ultimaEntrada: new Date().toISOString().split('T')[0] },
  ]);
  console.log('Estoque inicial criado para 10 insumos');

  console.log('\n✅ Seed concluído!');
  console.log('🔑 Login: admin@padaria.com / admin123');
}

// Execução direta via CLI: pnpm db:seed
if (process.argv[1]?.includes('seed')) {
  runSeed().catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  }).finally(() => process.exit(0));
}
