import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../../db.js';
import { commonErrors } from '../../schemas/errors.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register new user',
      security: [],
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          role: { type: 'string', enum: ['admin', 'editor', 'viewer'], default: 'viewer' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        ...commonErrors
      }
    }
  }, async (request, reply) => {
    const { username, email, password, role = 'viewer' } = request.body as {
      username: string; email: string; password: string; role?: string;
    };

    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Username already exists' });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Email already exists' });
    }

    const id = `usr_${uuid().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, username, email, bcrypt.hashSync(password, 10), role, now, now);

    return reply.status(201).send({ id, username, email, role, createdAt: now });
  });

  app.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login and get JWT tokens',
      security: [],
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        },
        ...commonErrors
      }
    }
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = db.prepare(
      'SELECT id, username, role, password_hash FROM users WHERE username = ? AND deleted_at IS NULL'
    ).get(username) as { id: string; username: string; role: string; password_hash: string } | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const accessToken = app.jwt.sign({ sub: user.id, username: user.username, role: user.role });
    const refreshToken = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(refreshToken, user.id, expiresAt);

    return { accessToken, refreshToken, expiresIn: 3600, user: { id: user.id, username: user.username, role: user.role } };
  });

  app.post('/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      security: [],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            expiresIn: { type: 'number' }
          }
        },
        ...commonErrors
      }
    }
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    const stored = db.prepare('SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?').get(refreshToken) as
      { user_id: string; expires_at: string } | undefined;

    if (!stored || new Date(stored.expires_at) < new Date()) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ? AND deleted_at IS NULL').get(stored.user_id) as
      { id: string; username: string; role: string } | undefined;
    if (!user) return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });

    const accessToken = app.jwt.sign({ sub: user.id, username: user.username, role: user.role });
    return { accessToken, expiresIn: 3600 };
  });

  app.post('/auth/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout and revoke refresh token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } }
      },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request) => {
    const { refreshToken } = request.body as { refreshToken: string };
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    return { message: 'Logged out successfully' };
  });

  app.get('/auth/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Get current authenticated user',
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        ...commonErrors
      }
    },
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const user = db.prepare(
      'SELECT id, username, email, role, created_at as createdAt FROM users WHERE id = ? AND deleted_at IS NULL'
    ).get(request.user.sub) as { id: string; username: string; email: string; role: string; createdAt: string } | undefined;
    if (!user) return reply.status(404).send({ error: 'Not Found' });
    return user;
  });
}
