import type { FastifyInstance } from 'fastify';
import { store, nextId, nowIso } from '../../data/store.js';
import { commonErrors } from '../../schemas/errors.js';

const docSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    title: { type: 'string' as const },
    description: { type: 'string' as const },
    folderId: { type: 'string' as const, nullable: true as const },
    tagIds: { type: 'array' as const, items: { type: 'string' as const } },
    status: { type: 'string' as const },
    currentVersion: { type: 'number' as const },
    createdBy: { type: 'string' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const }
  }
};

export default async function documentRoutes(app: FastifyInstance) {
  app.get('/documents', {
    schema: {
      tags: ['Documents'],
      summary: 'List documents',
      querystring: {
        type: 'object',
        properties: {
          folderId: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          tagId: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: docSchema },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request) => {
    const { folderId, status, tagId, page = 1, limit = 20 } = request.query as {
      folderId?: string; status?: string; tagId?: string; page?: number; limit?: number;
    };
    let docs = store.documents.filter(d => !d.deletedAt);
    if (folderId) docs = docs.filter(d => d.folderId === folderId);
    if (status) docs = docs.filter(d => d.status === status);
    if (tagId) docs = docs.filter(d => d.tagIds.includes(tagId));

    const total = docs.length;
    const data = docs.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  });

  app.post('/documents', {
    schema: {
      tags: ['Documents'],
      summary: 'Create document',
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', default: '' },
          folderId: { type: 'string', nullable: true },
          tagIds: { type: 'array', items: { type: 'string' }, default: [] },
          status: { type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' }
        }
      },
      response: { 201: docSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { title, description = '', folderId = null, tagIds = [], status = 'draft' } = request.body as {
      title: string; description?: string; folderId?: string | null; tagIds?: string[]; status?: 'draft' | 'published' | 'archived';
    };

    if (folderId && !store.folders.find(f => f.id === folderId && !f.deletedAt)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    }

    const doc = {
      id: nextId('doc'),
      title,
      description,
      folderId,
      tagIds,
      status,
      currentVersion: 0,
      versions: [],
      createdBy: request.user.sub,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    store.documents.push(doc);
    return reply.status(201).send(doc);
  });

  app.get('/documents/:id', {
    schema: {
      tags: ['Documents'],
      summary: 'Get document by ID',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: docSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = store.documents.find(d => d.id === id && !d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Document not found' });
    return doc;
  });

  app.put('/documents/:id', {
    schema: {
      tags: ['Documents'],
      summary: 'Update document metadata',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          folderId: { type: 'string', nullable: true },
          tagIds: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] }
        }
      },
      response: { 200: docSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const doc = store.documents.find(d => d.id === id && !d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Document not found' });

    const body = request.body as {
      title?: string; description?: string; folderId?: string | null; tagIds?: string[]; status?: 'draft' | 'published' | 'archived';
    };
    if (body.title) doc.title = body.title;
    if (body.description !== undefined) doc.description = body.description;
    if ('folderId' in body) doc.folderId = body.folderId ?? null;
    if (body.tagIds) doc.tagIds = body.tagIds;
    if (body.status) doc.status = body.status;
    doc.updatedAt = nowIso();
    return doc;
  });

  app.delete('/documents/:id', {
    schema: {
      tags: ['Documents'],
      summary: 'Delete document (soft delete)',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const doc = store.documents.find(d => d.id === id && !d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Document not found' });
    doc.deletedAt = nowIso();
    return { message: 'Document deleted successfully' };
  });

  app.post('/documents/:id/upload', {
    schema: {
      tags: ['Documents'],
      summary: 'Upload new document version',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['filename', 'mimeType', 'size'],
        properties: {
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          size: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'number' },
            size: { type: 'number' },
            mimeType: { type: 'string' },
            uploadedAt: { type: 'string' }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (!['admin', 'editor'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const doc = store.documents.find(d => d.id === id && !d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Document not found' });

    const { mimeType, size } = request.body as { filename: string; mimeType: string; size: number };
    const newVersion = doc.currentVersion + 1;
    const versionEntry = { version: newVersion, size, mimeType, uploadedBy: request.user.sub, uploadedAt: nowIso() };
    doc.versions.push(versionEntry);
    doc.currentVersion = newVersion;
    doc.updatedAt = nowIso();
    return versionEntry;
  });

  app.get('/documents/:id/download', {
    schema: {
      tags: ['Documents'],
      summary: 'Get download info for document version',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: { version: { type: 'integer' } }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            documentId: { type: 'string' },
            version: { type: 'number' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
            url: { type: 'string' }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { version } = request.query as { version?: number };
    const doc = store.documents.find(d => d.id === id && !d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Document not found' });
    if (doc.currentVersion === 0) return reply.status(404).send({ error: 'Not Found', message: 'No file uploaded yet' });

    const v = version ?? doc.currentVersion;
    const vEntry = doc.versions.find(ver => ver.version === v);
    if (!vEntry) return reply.status(404).send({ error: 'Not Found', message: `Version ${v} not found` });

    return { documentId: id, version: vEntry.version, mimeType: vEntry.mimeType, size: vEntry.size, url: `/files/${id}/v${vEntry.version}` };
  });

  app.get('/documents/:id/versions', {
    schema: {
      tags: ['Documents'],
      summary: 'Get version history',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              version: { type: 'number' },
              size: { type: 'number' },
              mimeType: { type: 'string' },
              uploadedBy: { type: 'string' },
              uploadedAt: { type: 'string' }
            }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = store.documents.find(d => d.id === id && !d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Document not found' });
    return doc.versions;
  });

  app.patch('/documents/:id/restore', {
    schema: {
      tags: ['Documents'],
      summary: 'Restore deleted document',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: docSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
    const { id } = request.params as { id: string };
    const doc = store.documents.find(d => d.id === id && d.deletedAt);
    if (!doc) return reply.status(404).send({ error: 'Not Found', message: 'Deleted document not found' });
    delete doc.deletedAt;
    doc.updatedAt = nowIso();
    return doc;
  });
}
