import Fastify from 'fastify';

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/api/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  app.get('/api/products', async () => {
    return [
      { id: '1', name: 'Mock Laptop', price: 999.99 },
      { id: '2', name: 'Mock Mouse', price: 29.99 },
      { id: '3', name: 'Mock Keyboard', price: 79.99 }
    ];
  });

  return app;
}
