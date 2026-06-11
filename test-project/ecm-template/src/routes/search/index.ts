import type { FastifyInstance } from 'fastify';
import { store } from '../../data/store.js';
import { commonErrors } from '../../schemas/errors.js';

export default async function searchRoutes(app: FastifyInstance) {
  app.get('/search', {
    schema: {
      tags: ['Search'],
      summary: 'Search documents and folders',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, description: 'Search query' },
          type: { type: 'string', enum: ['all', 'documents', 'folders'], default: 'all' },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          folderId: { type: 'string' },
          tagId: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string' },
                  matchedField: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request) => {
    const { q, type = 'all', status, folderId, tagId, page = 1, limit = 20 } = request.query as {
      q: string; type?: string; status?: string; folderId?: string; tagId?: string; page?: number; limit?: number;
    };

    const lower = q.toLowerCase();
    const results: Array<{ id: string; type: string; title: string; description: string; status?: string; matchedField: string; createdAt: string }> = [];

    if (type === 'all' || type === 'documents') {
      let docs = store.documents.filter(d => !d.deletedAt);
      if (status) docs = docs.filter(d => d.status === status);
      if (folderId) docs = docs.filter(d => d.folderId === folderId);
      if (tagId) docs = docs.filter(d => d.tagIds.includes(tagId));

      docs.forEach(d => {
        let matchedField = '';
        if (d.title.toLowerCase().includes(lower)) matchedField = 'title';
        else if (d.description.toLowerCase().includes(lower)) matchedField = 'description';
        if (matchedField) {
          results.push({ id: d.id, type: 'document', title: d.title, description: d.description, status: d.status, matchedField, createdAt: d.createdAt });
        }
      });
    }

    if (type === 'all' || type === 'folders') {
      store.folders
        .filter(f => !f.deletedAt && f.name.toLowerCase().includes(lower))
        .forEach(f => {
          results.push({ id: f.id, type: 'folder', title: f.name, description: '', matchedField: 'name', createdAt: f.createdAt });
        });
    }

    const total = results.length;
    return { query: q, total, page, limit, results: results.slice((page - 1) * limit, page * limit) };
  });

  app.get('/search/suggestions', {
    schema: {
      tags: ['Search'],
      summary: 'Get search suggestions (autocomplete)',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string' }, limit: { type: 'integer', default: 5 } }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' } }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request) => {
    const { q, limit = 5 } = request.query as { q: string; limit?: number };
    const lower = q.toLowerCase();
    const suggestions: Array<{ id: string; label: string; type: string }> = [];

    store.documents
      .filter(d => !d.deletedAt && d.title.toLowerCase().includes(lower))
      .slice(0, limit)
      .forEach(d => suggestions.push({ id: d.id, label: d.title, type: 'document' }));

    store.folders
      .filter(f => !f.deletedAt && f.name.toLowerCase().includes(lower))
      .slice(0, limit)
      .forEach(f => suggestions.push({ id: f.id, label: f.name, type: 'folder' }));

    return suggestions.slice(0, limit);
  });
}
