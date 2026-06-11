import { v4 as uuid } from 'uuid';

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DocumentVersion {
  version: number;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  folderId: string | null;
  tagIds: string[];
  status: 'draft' | 'published' | 'archived';
  currentVersion: number;
  versions: DocumentVersion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TestStep {
  keyword: string;
  objectRef: string;
  input: string;
  output: string;
  description: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RefreshToken {
  token: string;
  userId: string;
  expiresAt: string;
}

const now = () => new Date().toISOString();

export const store = {
  users: [
    {
      id: 'usr_admin',
      username: 'admin',
      email: 'admin@ecm.local',
      password: 'Admin@123',
      role: 'admin' as const,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'usr_editor',
      username: 'editor',
      email: 'editor@ecm.local',
      password: 'Editor@123',
      role: 'editor' as const,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'usr_viewer',
      username: 'viewer',
      email: 'viewer@ecm.local',
      password: 'Viewer@123',
      role: 'viewer' as const,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    }
  ] as User[],

  roles: [
    {
      id: 'role_admin',
      name: 'admin',
      permissions: ['users:read', 'users:write', 'users:delete', 'docs:read', 'docs:write', 'docs:delete', 'folders:read', 'folders:write', 'folders:delete', 'tags:read', 'tags:write', 'tags:delete'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'role_editor',
      name: 'editor',
      permissions: ['docs:read', 'docs:write', 'folders:read', 'folders:write', 'tags:read', 'tags:write'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'role_viewer',
      name: 'viewer',
      permissions: ['docs:read', 'folders:read', 'tags:read'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    }
  ] as Role[],

  tags: [
    { id: 'tag_1', name: 'Important', color: '#e53e3e', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'tag_2', name: 'Draft', color: '#d69e2e', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'tag_3', name: 'Approved', color: '#38a169', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }
  ] as Tag[],

  folders: [
    { id: 'fld_root', name: 'Root', parentId: null, createdBy: 'usr_admin', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'fld_contracts', name: 'Contracts', parentId: 'fld_root', createdBy: 'usr_admin', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'fld_reports', name: 'Reports', parentId: 'fld_root', createdBy: 'usr_admin', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }
  ] as Folder[],

  documents: [
    {
      id: 'doc_1',
      title: 'Q1 Annual Report',
      description: 'Annual financial report for Q1',
      folderId: 'fld_reports',
      tagIds: ['tag_3'],
      status: 'published' as const,
      currentVersion: 2,
      versions: [
        { version: 1, size: 102400, mimeType: 'application/pdf', uploadedBy: 'usr_editor', uploadedAt: '2025-01-10T08:00:00.000Z' },
        { version: 2, size: 110592, mimeType: 'application/pdf', uploadedBy: 'usr_editor', uploadedAt: '2025-02-01T09:00:00.000Z' }
      ],
      createdBy: 'usr_editor',
      createdAt: '2025-01-10T08:00:00.000Z',
      updatedAt: '2025-02-01T09:00:00.000Z'
    },
    {
      id: 'doc_2',
      title: 'Service Agreement 2025',
      description: 'Standard service agreement template',
      folderId: 'fld_contracts',
      tagIds: ['tag_1', 'tag_2'],
      status: 'draft' as const,
      currentVersion: 1,
      versions: [
        { version: 1, size: 51200, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploadedBy: 'usr_admin', uploadedAt: '2025-03-01T10:00:00.000Z' }
      ],
      createdBy: 'usr_admin',
      createdAt: '2025-03-01T10:00:00.000Z',
      updatedAt: '2025-03-01T10:00:00.000Z'
    }
  ] as Document[],

  refreshTokens: [] as RefreshToken[]
};

export function nextId(prefix: string): string {
  return `${prefix}_${uuid().replace(/-/g, '').slice(0, 8)}`;
}

export function nowIso(): string {
  return now();
}
