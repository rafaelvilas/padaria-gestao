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

async function start() {
  // 1. Migrações
  try {
    console.log('🔄 Rodando migrações...');
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
    console.log('✅ Migrações concluídas.');
  } catch (err) {
    console.error('⚠️  Erro nas migrações (continuando):', err);
  }

  // 2. Seed automático na primeira inicialização (banco vazio)
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as total FROM usuarios`);
    const total = Number((result.rows[0] as any)?.total ?? 0);
    if (total === 0) {
      console.log('🌱 Banco vazio. Rodando seed inicial...');
      await runSeed();
    } else {
      console.log(`ℹ️  Banco já inicializado (${total} usuário(s)). Pulando seed.`);
    }
  } catch (err) {
    console.error('⚠️  Erro no seed automático (continuando):', err);
  }

  app.listen(PORT, () => console.log(`🍞 Padaria Gestão rodando na porta ${PORT}`));
}

start();
