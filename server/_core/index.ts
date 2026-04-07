import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { appRouter } from '../index';
import { db } from '../db/index';
import { runSeed } from '../db/seed';
import { sql } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => ({ req, res }),
}));

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  app.get('*', (_, res) => res.sendFile(path.join(publicPath, 'index.html')));
}

async function waitForDb(retries = 10, delay = 3000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await db.execute(sql`SELECT 1`);
      console.log('✅ Banco de dados conectado.');
      return;
    } catch {
      console.log(`⏳ Aguardando banco de dados... (tentativa ${i}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('❌ Banco de dados não respondeu após todas as tentativas.');
}

async function start() {
  // 0. Aguardar banco
  await waitForDb();

  // 1. Migrações
  try {
    console.log('🔄 Rodando migrações...');
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    console.log('✅ Migrações concluídas.');
  } catch (err) {
    console.error('⚠️  Erro nas migrações:', err);
  }

  // 2. Seed automático na primeira inicialização
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as total FROM usuarios`);
    const total = Number((result.rows[0] as any)?.total ?? 0);
    if (total === 0) {
      console.log('🌱 Banco vazio → rodando seed inicial...');
      await runSeed();
    } else {
      console.log(`ℹ️  Seed já realizado (${total} usuário(s)).`);
    }
  } catch (err) {
    console.error('⚠️  Erro no seed:', err);
  }

  app.listen(PORT, () => console.log(`🍞 Padaria Gestão rodando na porta ${PORT}`));
}

start();
