import { create } from 'zustand'
import type { Project } from '@jkauto/core'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export interface WorkspaceProject {
  path: string
  project: Project
  activeProfile: string
}

export interface Tab {
  path: string
  title: string
  isDirty: boolean
  projectPath: string
}

interface ProjectStore {
  projects: WorkspaceProject[]
  openTabs: Tab[]
  activeTabPath: string | null

  // derived
  activeProjectPath: string | null
  activeProject: WorkspaceProject | null

  // project ops
  addProject: (path: string, project: Project, activeProfile?: string) => void
  removeProject: (path: string) => void
  updateProject: (path: string, project: Project) => void
  setActiveProject: (path: string) => void
  setActiveProfile: (projectPath: string, profile: string) => void

  // tab ops
  openTab: (path: string, title: string, projectPath: string) => void
  closeTab: (path: string) => void
  closeTabsUnderPath: (dirPath: string) => void
  renameTab: (oldPath: string, newPath: string) => void
  renameTabsUnderPath: (oldDirPath: string, newDirPath: string) => void
  setActiveTab: (path: string) => void
  markTabDirty: (path: string, dirty: boolean) => void
  reorderTab: (from: number, to: number) => void
  reopenLastTab: () => void
  moveTabLeft: () => void
  moveTabRight: () => void
  closedTabHistory: Tab[]

  // compat (single-project patterns still used in some dialogs)
  setProject: (path: string, project: Project) => void
  clearProject: () => void
}

function persistProjects(projects: WorkspaceProject[]) {
  invoke(IpcChannels.WORKSPACE_PROJECTS_SET, projects.map((p) => ({
    path: p.path,
    activeProfile: p.activeProfile,
  }))).catch(() => {})
}

function deriveActiveProjectPath(
  tabs: Tab[],
  activeTabPath: string | null,
  projects: WorkspaceProject[],
): string | null {
  if (activeTabPath) {
    const tab = tabs.find((t) => t.path === activeTabPath)
    if (tab) return tab.projectPath
  }
  return projects[0]?.path ?? null
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  openTabs: [],
  activeTabPath: null,
  activeProjectPath: null,
  activeProject: null,
  closedTabHistory: [],

  addProject: (path, project, activeProfile = 'default') => {
    set((state) => {
      const exists = state.projects.find((p) => p.path === path)
      if (exists) {
        // already open — just focus it
        const updated = state.projects.map((p) =>
          p.path === path ? { ...p, project } : p,
        )
        const activeProjectPath = deriveActiveProjectPath(state.openTabs, state.activeTabPath, updated)
        const activeProject = updated.find((p) => p.path === activeProjectPath) ?? null
        return { projects: updated, activeProjectPath, activeProject }
      }
      const updated = [...state.projects, { path, project, activeProfile }]
      persistProjects(updated)
      const activeProjectPath = deriveActiveProjectPath(state.openTabs, state.activeTabPath, updated)
      const activeProject = updated.find((p) => p.path === activeProjectPath) ?? null
      return { projects: updated, activeProjectPath, activeProject }
    })
  },

  removeProject: (path) => {
    set((state) => {
      const updated = state.projects.filter((p) => p.path !== path)
      const openTabs = state.openTabs.filter((t) => t.projectPath !== path)
      const activeTabPath = openTabs.find((t) => t.path === state.activeTabPath)
        ? state.activeTabPath
        : (openTabs[openTabs.length - 1]?.path ?? null)
      persistProjects(updated)
      const activeProjectPath = deriveActiveProjectPath(openTabs, activeTabPath, updated)
      const activeProject = updated.find((p) => p.path === activeProjectPath) ?? null
      return { projects: updated, openTabs, activeTabPath, activeProjectPath, activeProject }
    })
  },

  updateProject: (path, project) => {
    set((state) => {
      const updated = state.projects.map((p) => (p.path === path ? { ...p, project } : p))
      const activeProject = updated.find((p) => p.path === get().activeProjectPath) ?? null
      return { projects: updated, activeProject }
    })
  },

  setActiveProject: (path) => {
    set((state) => {
      const activeProject = state.projects.find((p) => p.path === path) ?? null
      return { activeProjectPath: path, activeProject }
    })
  },

  setActiveProfile: (projectPath, profile) => {
    set((state) => {
      const updated = state.projects.map((p) =>
        p.path === projectPath ? { ...p, activeProfile: profile } : p,
      )
      persistProjects(updated)
      const activeProject = updated.find((p) => p.path === get().activeProjectPath) ?? null
      return { projects: updated, activeProject }
    })
  },

  openTab: (path, title, projectPath) => {
    set((state) => {
      const exists = state.openTabs.find((t) => t.path === path)
      if (exists) {
        const activeProjectPath = deriveActiveProjectPath(state.openTabs, path, state.projects)
        const activeProject = state.projects.find((p) => p.path === activeProjectPath) ?? null
        return { activeTabPath: path, activeProjectPath, activeProject }
      }
      const openTabs = [...state.openTabs, { path, title, isDirty: false, projectPath }]
      const activeProjectPath = deriveActiveProjectPath(openTabs, path, state.projects)
      const activeProject = state.projects.find((p) => p.path === activeProjectPath) ?? null
      return { openTabs, activeTabPath: path, activeProjectPath, activeProject }
    })
  },

  closeTab: (path) => {
    set((state) => {
      const closingTab = state.openTabs.find((t) => t.path === path)
      const tabs = state.openTabs.filter((t) => t.path !== path)
      const activeTabPath =
        state.activeTabPath === path
          ? (tabs[tabs.length - 1]?.path ?? null)
          : state.activeTabPath
      const activeProjectPath = deriveActiveProjectPath(tabs, activeTabPath, state.projects)
      const activeProject = state.projects.find((p) => p.path === activeProjectPath) ?? null
      const closedTabHistory = closingTab
        ? [...state.closedTabHistory.slice(-19), closingTab]
        : state.closedTabHistory
      return { openTabs: tabs, activeTabPath, activeProjectPath, activeProject, closedTabHistory }
    })
  },

  closeTabsUnderPath: (dirPath) => {
    set((state) => {
      const prefix = dirPath + '/'
      const tabs = state.openTabs.filter((t) => t.path !== dirPath && !t.path.startsWith(prefix))
      const activeTabPath = tabs.find((t) => t.path === state.activeTabPath)?.path
        ?? (tabs[tabs.length - 1]?.path ?? null)
      const activeProjectPath = deriveActiveProjectPath(tabs, activeTabPath, state.projects)
      const activeProject = state.projects.find((p) => p.path === activeProjectPath) ?? null
      return { openTabs: tabs, activeTabPath, activeProjectPath, activeProject }
    })
  },

  renameTab: (oldPath, newPath) => {
    set((state) => {
      const newTitle = newPath.split('/').pop() ?? newPath
      const openTabs = state.openTabs.map((t) =>
        t.path === oldPath ? { ...t, path: newPath, title: newTitle } : t,
      )
      const activeTabPath = state.activeTabPath === oldPath ? newPath : state.activeTabPath
      return { openTabs, activeTabPath }
    })
  },

  renameTabsUnderPath: (oldDirPath, newDirPath) => {
    set((state) => {
      const prefix = oldDirPath + '/'
      const openTabs = state.openTabs.map((t) => {
        if (!t.path.startsWith(prefix)) return t
        const newPath = newDirPath + '/' + t.path.slice(prefix.length)
        return { ...t, path: newPath, title: newPath.split('/').pop() ?? t.title }
      })
      const activeTabPath = state.activeTabPath?.startsWith(prefix)
        ? newDirPath + '/' + state.activeTabPath.slice(prefix.length)
        : state.activeTabPath
      return { openTabs, activeTabPath }
    })
  },

  setActiveTab: (path) => {
    set((state) => {
      const activeProjectPath = deriveActiveProjectPath(state.openTabs, path, state.projects)
      const activeProject = state.projects.find((p) => p.path === activeProjectPath) ?? null
      return { activeTabPath: path, activeProjectPath, activeProject }
    })
  },

  markTabDirty: (path, dirty) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.path === path ? { ...t, isDirty: dirty } : t)),
    }))
  },

  reorderTab: (from, to) => {
    set((state) => {
      if (from === to || from < 0 || to < 0) return {}
      if (from >= state.openTabs.length || to >= state.openTabs.length) return {}
      const openTabs = state.openTabs.slice()
      const [moved] = openTabs.splice(from, 1)
      openTabs.splice(to, 0, moved)
      return { openTabs }
    })
  },

  reopenLastTab: () => {
    set((state) => {
      if (!state.closedTabHistory.length) return {}
      const closedTabHistory = state.closedTabHistory.slice()
      const tab = closedTabHistory.pop()!
      if (!state.projects.find((p) => p.path === tab.projectPath)) return { closedTabHistory }
      if (state.openTabs.find((t) => t.path === tab.path)) {
        return { closedTabHistory, activeTabPath: tab.path }
      }
      const openTabs = [...state.openTabs, { ...tab, isDirty: false }]
      const activeProjectPath = deriveActiveProjectPath(openTabs, tab.path, state.projects)
      const activeProject = state.projects.find((p) => p.path === activeProjectPath) ?? null
      return { closedTabHistory, openTabs, activeTabPath: tab.path, activeProjectPath, activeProject }
    })
  },

  moveTabLeft: () => {
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.path === state.activeTabPath)
      if (idx <= 0) return {}
      const openTabs = state.openTabs.slice()
      const [moved] = openTabs.splice(idx, 1)
      openTabs.splice(idx - 1, 0, moved)
      return { openTabs }
    })
  },

  moveTabRight: () => {
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.path === state.activeTabPath)
      if (idx < 0 || idx >= state.openTabs.length - 1) return {}
      const openTabs = state.openTabs.slice()
      const [moved] = openTabs.splice(idx, 1)
      openTabs.splice(idx + 1, 0, moved)
      return { openTabs }
    })
  },

  // compat
  setProject: (path, project) => get().addProject(path, project),
  clearProject: () => {
    const { activeProjectPath, removeProject } = get()
    if (activeProjectPath) removeProject(activeProjectPath)
  },
}))

// Selector helpers
export const selectProject = (path: string) => (s: ProjectStore) =>
  s.projects.find((p) => p.path === path)
