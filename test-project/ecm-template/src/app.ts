import Fastify from 'fastify';
import cors from '@fastify/cors';
import db from './db.js';
import swaggerPlugin from './plugins/swagger.js';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth/index.js';
import userRoutes from './routes/users/index.js';
import folderRoutes from './routes/folders/index.js';
import tagRoutes from './routes/tags/index.js';
import documentRoutes from './routes/documents/index.js';
import roleRoutes from './routes/roles/index.js';
import searchRoutes from './routes/search/index.js';

export async function buildApp() {
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cors, { origin: true });
  await app.register(swaggerPlugin);
  await app.register(jwtPlugin);

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(folderRoutes);
  await app.register(tagRoutes);
  await app.register(documentRoutes);
  await app.register(roleRoutes);
  await app.register(searchRoutes);

  app.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      security: [],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            uptime: { type: 'number' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));

  app.get('/stats', {
    schema: {
      tags: ['System'],
      summary: 'System statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            users: { type: 'number' },
            documents: { type: 'number' },
            folders: { type: 'number' },
            tags: { type: 'number' }
          }
        }
      }
    },
    preHandler: [app.authenticate]
  }, async () => {
    const { store } = await import('./data/store.js');
    const users = (db.prepare('SELECT COUNT(*) as n FROM users WHERE deleted_at IS NULL').get() as { n: number }).n;
    return {
      users,
      documents: store.documents.filter(d => !d.deletedAt).length,
      folders: store.folders.filter(f => !f.deletedAt).length,
      tags: store.tags.length
    };
  });

  return app;
}
