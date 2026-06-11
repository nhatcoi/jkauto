import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import db from '../../db.js';
import { commonErrors } from '../../schemas/errors.js';

const userSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    username: { type: 'string' as const },
    email: { type: 'string' as const },
    role: { type: 'string' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const }
  }
};

type UserRow = { id: string; username: string; email: string; role: string; createdAt: string; updatedAt: string };

export default async function userRoutes(app: FastifyInstance) {
  app.get('/users', {
    schema: {
      tags: ['Users'],
      summary: 'List all users (admin only)',
      querystring: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: userSchema },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
    const { role, page = 1, limit = 20 } = request.query as { role?: string; page?: number; limit?: number };

    const where = role ? 'WHERE deleted_at IS NULL AND role = ?' : 'WHERE deleted_at IS NULL';
    const args = role ? [role] : [];
    const all = db.prepare(
      `SELECT id, username, email, role, created_at as createdAt, updated_at as updatedAt FROM users ${where}`
    ).all(...args) as UserRow[];

    const total = all.length;
    const data = all.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  });

  app.get('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: { 200: userSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.user.role !== 'admin' && request.user.sub !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const user = db.prepare(
      'SELECT id, username, email, role, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ? AND deleted_at IS NULL'
    ).get(id) as UserRow | undefined;
    if (!user) return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    return user;
  });

  app.put('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'editor', 'viewer'] }
        }
      },
      response: { 200: userSchema, ...commonErrors }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.user.role !== 'admin' && request.user.sub !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!user) return reply.status(404).send({ error: 'Not Found', message: 'User not found' });

    const body = request.body as { email?: string; role?: string };
    const now = new Date().toISOString();

    if (body.email) db.prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?').run(body.email, now, id);
    if (body.role && request.user.role === 'admin') db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(body.role, now, id);

    return db.prepare(
      'SELECT id, username, email, role, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?'
    ).get(id) as UserRow;
  });

  app.delete('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user (admin only, soft delete)',
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
    if (id === request.user.sub) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot delete yourself' });
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!user) return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    return { message: 'User deleted successfully' };
  });

  app.put('/users/:id/password', {
    schema: {
      tags: ['Users'],
      summary: 'Change user password',
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 }
        }
      },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.user.sub !== id && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL').get(id) as
      { password_hash: string } | undefined;
    if (!user) return reply.status(404).send({ error: 'Not Found' });

    if (request.user.role !== 'admin' && !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Current password is incorrect' });
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(bcrypt.hashSync(newPassword, 10), new Date().toISOString(), id);
    return { message: 'Password changed successfully' };
  });
}
