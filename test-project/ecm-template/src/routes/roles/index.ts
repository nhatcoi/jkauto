import type { FastifyInstance } from 'fastify';
import { store, nextId, nowIso } from '../../data/store.js';
import { commonErrors } from '../../schemas/errors.js';

const roleSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    permissions: { type: 'array' as const, items: { type: 'string' as const } },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const }
  }
};

const ALL_PERMISSIONS = [
  'users:read', 'users:write', 'users:delete',
  'docs:read', 'docs:write', 'docs:delete',
  'folders:read', 'folders:write', 'folders:delete',
  'tags:read', 'tags:write', 'tags:delete',
  'roles:read', 'roles:write', 'roles:delete'
];

export default async function roleRoutes(app: FastifyInstance) {
  app.get('/roles', {
    schema: {
      tags: ['Roles'],
      summary: 'List all roles (admin only)',
      response: { 200: { type: 'array', items: roleSchema }, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    return store.roles;
  });

  app.get('/roles/permissions', {
    schema: {
      tags: ['Roles'],
      summary: 'List all available permissions',
      response: { 200: { type: 'array', items: { type: 'string' } }, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    return ALL_PERMISSIONS;
  });

  app.post('/roles', {
    schema: {
      tags: ['Roles'],
      summary: 'Create role (admin only)',
      body: {
        type: 'object',
        required: ['name', 'permissions'],
        properties: {
          name: { type: 'string', minLength: 1 },
          permissions: { type: 'array', items: { type: 'string' } }
        }
      },
      response: { 201: roleSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const { name, permissions } = request.body as { name: string; permissions: string[] };

    if (store.roles.find(r => r.name === name)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Role name already exists' });
    }
    const invalid = permissions.filter(p => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      return reply.status(400).send({ error: 'Bad Request', message: `Invalid permissions: ${invalid.join(', ')}` });
    }

    const role = { id: nextId('role'), name, permissions, createdAt: nowIso(), updatedAt: nowIso() };
    store.roles.push(role);
    return reply.status(201).send(role);
  });

  app.get('/roles/:id', {
    schema: {
      tags: ['Roles'],
      summary: 'Get role by ID',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: roleSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const { id } = request.params as { id: string };
    const role = store.roles.find(r => r.id === id);
    if (!role) return reply.status(404).send({ error: 'Not Found', message: 'Role not found' });
    return role;
  });

  app.put('/roles/:id', {
    schema: {
      tags: ['Roles'],
      summary: 'Update role permissions (admin only)',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          permissions: { type: 'array', items: { type: 'string' } }
        }
      },
      response: { 200: roleSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const { id } = request.params as { id: string };
    const role = store.roles.find(r => r.id === id);
    if (!role) return reply.status(404).send({ error: 'Not Found', message: 'Role not found' });

    const body = request.body as { name?: string; permissions?: string[] };
    if (body.name) role.name = body.name;
    if (body.permissions) {
      const invalid = body.permissions.filter(p => !ALL_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        return reply.status(400).send({ error: 'Bad Request', message: `Invalid permissions: ${invalid.join(', ')}` });
      }
      role.permissions = body.permissions;
    }
    role.updatedAt = nowIso();
    return role;
  });

  app.delete('/roles/:id', {
    schema: {
      tags: ['Roles'],
      summary: 'Delete role (admin only)',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const { id } = request.params as { id: string };
    const builtIn = ['role_admin', 'role_editor', 'role_viewer'];
    if (builtIn.includes(id)) return reply.status(400).send({ error: 'Bad Request', message: 'Cannot delete built-in role' });

    const idx = store.roles.findIndex(r => r.id === id);
    if (idx === -1) return reply.status(404).send({ error: 'Not Found', message: 'Role not found' });
    store.roles.splice(idx, 1);
    return { message: 'Role deleted successfully' };
  });
}
