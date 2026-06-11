import type { FastifyInstance } from 'fastify';
import { store, nextId, nowIso } from '../../data/store.js';
import { commonErrors } from '../../schemas/errors.js';

const tagSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    color: { type: 'string' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const }
  }
};

export default async function tagRoutes(app: FastifyInstance) {
  app.get('/tags', {
    schema: {
      tags: ['Tags'],
      summary: 'List all tags',
      response: { 200: { type: 'array', items: tagSchema }, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async () => store.tags);

  app.post('/tags', {
    schema: {
      tags: ['Tags'],
      summary: 'Create tag',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'string', default: '#718096' }
        }
      },
      response: { 201: tagSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { name, color = '#718096' } = request.body as { name: string; color?: string };
    if (store.tags.find(t => t.name.toLowerCase() === name.toLowerCase())) {
      return reply.status(409).send({ error: 'Conflict', message: 'Tag name already exists' });
    }
    const tag = { id: nextId('tag'), name, color, createdAt: nowIso(), updatedAt: nowIso() };
    store.tags.push(tag);
    return reply.status(201).send(tag);
  });

  app.get('/tags/:id', {
    schema: {
      tags: ['Tags'],
      summary: 'Get tag by ID',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: tagSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tag = store.tags.find(t => t.id === id);
    if (!tag) return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    return tag;
  });

  app.put('/tags/:id', {
    schema: {
      tags: ['Tags'],
      summary: 'Update tag',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'string' }
        }
      },
      response: { 200: tagSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const tag = store.tags.find(t => t.id === id);
    if (!tag) return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });

    const body = request.body as { name?: string; color?: string };
    if (body.name) {
      const dup = store.tags.find(t => t.id !== id && t.name.toLowerCase() === body.name!.toLowerCase());
      if (dup) return reply.status(409).send({ error: 'Conflict', message: 'Tag name already exists' });
      tag.name = body.name;
    }
    if (body.color) tag.color = body.color;
    tag.updatedAt = nowIso();
    return tag;
  });

  app.delete('/tags/:id', {
    schema: {
      tags: ['Tags'],
      summary: 'Delete tag',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
    const { id } = request.params as { id: string };
    const idx = store.tags.findIndex(t => t.id === id);
    if (idx === -1) return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });

    store.tags.splice(idx, 1);
    store.documents.forEach(d => { d.tagIds = d.tagIds.filter(t => t !== id); });
    return { message: 'Tag deleted successfully' };
  });
}
