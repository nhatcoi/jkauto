const BASE = '/api';

function getToken() {
  return localStorage.getItem('ecm_token');
}

export function setToken(token: string) {
  localStorage.setItem('ecm_token', token);
}

export function clearToken() {
  localStorage.removeItem('ecm_token');
  localStorage.removeItem('ecm_user');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  if (res.status === 401 && path !== '/auth/login') {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ accessToken: string; user: { id: string; username: string; role: string } }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password })
      }),
    register: (username: string, email: string, password: string) =>
      request<{ id: string; username: string; email: string; role: string; createdAt: string }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ username, email, password })
      }),
    me: () => request<{ id: string; username: string; email: string; role: string }>('/auth/me')
  },
  stats: () => request<{ users: number; documents: number; folders: number; tags: number }>('/stats'),
  documents: {
    list: (params?: Record<string, string | number>) =>
      request<{ data: Document[]; total: number; page: number; limit: number }>('/documents?' + new URLSearchParams(params as Record<string, string> ?? {})),
    get: (id: string) => request<Document>(`/documents/${id}`),
    create: (body: Partial<Document>) => request<Document>('/documents', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Document>) => request<Document>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' })
  },
  folders: {
    list: () => request<Folder[]>('/folders'),
    create: (body: { name: string; parentId?: string }) => request<Folder>('/folders', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<{ message: string }>(`/folders/${id}`, { method: 'DELETE' })
  },
  tags: {
    list: () => request<Tag[]>('/tags'),
    create: (body: { name: string; color?: string }) => request<Tag>('/tags', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<{ message: string }>(`/tags/${id}`, { method: 'DELETE' })
  },
  users: {
    list: (params?: { role?: string }) => request<{ data: User[]; total: number }>('/users?' + new URLSearchParams(params as Record<string, string> ?? {})),
    delete: (id: string) => request<{ message: string }>(`/users/${id}`, { method: 'DELETE' })
  },
  roles: {
    list: () => request<Role[]>('/roles'),
    create: (body: { name: string; permissions: string[] }) => request<Role>('/roles', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<{ message: string }>(`/roles/${id}`, { method: 'DELETE' })
  },
  search: (q: string) => request<{ results: SearchResult[]; total: number }>(`/search?q=${encodeURIComponent(q)}`)
};

export interface Document {
  id: string; title: string; description: string; folderId: string | null;
  tagIds: string[]; status: 'draft' | 'published' | 'archived';
  currentVersion: number; createdBy: string; createdAt: string; updatedAt: string;
}
export interface Folder { id: string; name: string; parentId: string | null; createdBy: string; createdAt: string; updatedAt: string; }
export interface Tag { id: string; name: string; color: string; createdAt: string; }
export interface User { id: string; username: string; email: string; role: string; createdAt: string; }
export interface Role { id: string; name: string; permissions: string[]; createdAt: string; }
export interface SearchResult { id: string; type: string; title: string; description: string; status?: string; matchedField: string; }
