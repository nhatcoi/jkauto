import type { FastifyInstance } from 'fastify';
import { store, nextId, nowIso } from '../../data/store.js';
import { commonErrors } from '../../schemas/errors.js';

const folderSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    parentId: { type: 'string' as const, nullable: true as const },
    createdBy: { type: 'string' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const }
  }
};

export default async function folderRoutes(app: FastifyInstance) {
  app.get('/folders', {
    schema: {
      tags: ['Folders'],
      summary: 'List all folders',
      querystring: {
        type: 'object',
        properties: { parentId: { type: 'string' } }
      },
      response: { 200: { type: 'array', items: folderSchema }, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request) => {
    const { parentId } = request.query as { parentId?: string };
    let folders = store.folders.filter(f => !f.deletedAt);
    if (parentId !== undefined) folders = folders.filter(f => f.parentId === parentId);
    return folders;
  });

  app.post('/folders', {
    schema: {
      tags: ['Folders'],
      summary: 'Create folder',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          parentId: { type: 'string' }
        }
      },
      response: { 201: folderSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { name, parentId = null } = request.body as { name: string; parentId?: string };
    if (parentId && !store.folders.find(f => f.id === parentId && !f.deletedAt)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Parent folder not found' });
    }
    const folder = { id: nextId('fld'), name, parentId, createdBy: request.user.sub, createdAt: nowIso(), updatedAt: nowIso() };
    store.folders.push(folder);
    return reply.status(201).send(folder);
  });

  app.get('/folders/:id', {
    schema: {
      tags: ['Folders'],
      summary: 'Get folder by ID',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: folderSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const folder = store.folders.find(f => f.id === id && !f.deletedAt);
    if (!folder) return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    return folder;
  });

  app.put('/folders/:id', {
    schema: {
      tags: ['Folders'],
      summary: 'Update folder',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          parentId: { type: 'string', nullable: true }
        }
      },
      response: { 200: folderSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const folder = store.folders.find(f => f.id === id && !f.deletedAt);
    if (!folder) return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    if (id === 'fld_root') return reply.status(400).send({ error: 'Bad Request', message: 'Cannot modify root folder' });

    const body = request.body as { name?: string; parentId?: string | null };
    if (body.name) folder.name = body.name;
    if ('parentId' in body) folder.parentId = body.parentId ?? null;
    folder.updatedAt = nowIso();
    return folder;
  });

  app.delete('/folders/:id', {
    schema: {
      tags: ['Folders'],
      summary: 'Delete folder (soft delete)',
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
    if (id === 'fld_root') return reply.status(400).send({ error: 'Bad Request', message: 'Cannot delete root folder' });
    const folder = store.folders.find(f => f.id === id && !f.deletedAt);
    if (!folder) return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    folder.deletedAt = nowIso();
    return { message: 'Folder deleted successfully' };
  });

  app.get('/folders/:id/documents', {
    schema: {
      tags: ['Folders'],
      summary: 'List documents in folder',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string' },
              currentVersion: { type: 'number' },
              createdAt: { type: 'string' }
            }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const folder = store.folders.find(f => f.id === id && !f.deletedAt);
    if (!folder) return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    return store.documents
      .filter(d => d.folderId === id && !d.deletedAt)
      .map(({ id, title, status, currentVersion, createdAt }) => ({ id, title, status, currentVersion, createdAt }));
  });

  app.get('/folders/:id/children', {
    schema: {
      tags: ['Folders'],
      summary: 'List child folders',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: { type: 'array', items: folderSchema }, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const folder = store.folders.find(f => f.id === id && !f.deletedAt);
    if (!folder) return reply.status(404).send({ error: 'Not Found' });
    return store.folders.filter(f => f.parentId === id && !f.deletedAt);
  });
}
