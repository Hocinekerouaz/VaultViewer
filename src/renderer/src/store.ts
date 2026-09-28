import { create } from 'zustand'
import { ancestorsOf, remapCollapsed } from '@/lib/tree'
import type {
  BacklinkItem,
  FileView,
  IndexProgress,
  LinkMap,
  OpenVaultResult,
  OutgoingItem,
  RecentVault,
  ResolveOutcome,
  SearchHit
} from '@shared/types'

type Theme = 'light' | 'dark'

export type ViewMode = 'read' | 'edit'
export type ConflictState = 'changed' | 'deleted' | null
export type PendingSwitch =
  | { kind: 'open'; path: string; findTerm: string | null }
  | { kind: 'read' }

export function isDirty(state: { draft: string | null; note: FileView | null }): boolean {
  return state.draft !== null && state.note !== null && state.draft !== state.note.raw
}

interface StoreState {
  root: string | null
  tree: string[]
  folders: string[]
  recents: RecentVault[]
  openPath: string | null
  selectedPath: string | null
  note: FileView | null
  linkMap: LinkMap
  backlinks: BacklinkItem[]
  outgoing: OutgoingItem[]
  progress: IndexProgress | null
  query: string
  hits: SearchHit[]
  searchOpen: boolean
  tagFilter: string | null
  theme: Theme
  toast: string | null
  pendingWiki: { target: string; options: string[] } | null
  pendingFind: string | null
  filter: string
  collapsed: Set<string>
  autoReveal: boolean
  revealTarget: string | null
  revealTick: number
  viewMode: ViewMode
  draft: string | null
  conflict: ConflictState
  pendingSwitch: PendingSwitch | null
  setFilter: (value: string) => void
  setQuery: (value: string) => void
  setTheme: (value: Theme) => void
  setSearchOpen: (value: boolean) => void
  selectPath: (path: string | null) => void
  toggleFolder: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  revealPath: (path: string) => void
  setAutoReveal: (value: boolean) => void
  createFolderAt: (parentRel: string, name: string) => Promise<string | null>
  renameItem: (relPath: string, newName: string) => Promise<string | null>
  deleteItem: (relPath: string) => Promise<boolean>
  init: () => Promise<void>
  openVaultPath: (path: string) => Promise<void>
  openFolder: () => Promise<void>
  openNote: (relPath: string, findTerm?: string | null) => Promise<void>
  setViewMode: (mode: ViewMode) => Promise<void>
  updateDraft: (text: string) => void
  saveDraft: () => Promise<boolean>
  revertDraft: () => void
  resolveSwitch: (action: 'save' | 'discard' | 'cancel') => Promise<void>
  reloadFromDisk: () => void
  keepEditing: () => void
  closeDeletedFile: () => void
  runSearch: () => Promise<void>
  clearSearch: () => void
  clickWiki: (target: string) => void
  clickTag: (tag: string) => Promise<void>
  dismissWiki: () => void
  showToast: (message: string) => void
  refreshNoteMeta: () => Promise<void>
  handleChanged: () => Promise<void>
}

function firstMarkdown(tree: string[]): string | null {
  return tree.find((path) => path.toLowerCase().endsWith('.md')) ?? tree[0] ?? null
}

function loadCollapsed(root: string): Set<string> {
  try {
    const raw = localStorage.getItem(`vv-collapsed:${root}`)
    if (!raw) return new Set()
    const list: unknown = JSON.parse(raw)
    if (Array.isArray(list)) return new Set(list.filter((item): item is string => typeof item === 'string'))
  } catch {
    void 0
  }
  return new Set()
}

let initialized = false
let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<StoreState>((set, get) => {
  const applyVault = async (result: OpenVaultResult): Promise<void> => {
    set({
      root: result.root,
      tree: result.tree,
      folders: result.folders,
      openPath: null,
      selectedPath: null,
      note: null,
      linkMap: {},
      backlinks: [],
      outgoing: [],
      pendingWiki: null,
      pendingFind: null,
      collapsed: loadCollapsed(result.root),
      revealTarget: null,
      viewMode: 'read',
      draft: null,
      conflict: null,
      pendingSwitch: null,
      progress: { phase: 'indexing', indexed: 0, total: result.tree.length }
    })
    const recents = await window.api.recentVaults()
    set({ recents })
    const first = firstMarkdown(result.tree)
    if (first) await get().openNote(first)
  }

  const doOpen = async (relPath: string, findTerm?: string | null): Promise<void> => {
    const [note, backlinks, outgoing, linkMap] = await Promise.all([
      window.api.readFile(relPath),
      window.api.getBacklinks(relPath),
      window.api.getOutgoing(relPath),
      window.api.resolveNoteLinks(relPath)
    ])
    if (!note) {
      get().showToast(`Could not read ${relPath}`)
      return
    }
    set({
      openPath: relPath,
      selectedPath: relPath,
      note,
      backlinks,
      outgoing,
      linkMap,
      pendingFind: findTerm ?? null,
      draft: get().viewMode === 'edit' ? note.raw : null,
      conflict: null
    })
  }

  return {
    root: null,
    tree: [],
    folders: [],
    recents: [],
    openPath: null,
    selectedPath: null,
    note: null,
    linkMap: {},
    backlinks: [],
    outgoing: [],
    progress: null,
    query: '',
    hits: [],
    searchOpen: false,
    tagFilter: null,
    theme: 'light',
    toast: null,
    pendingWiki: null,
    pendingFind: null,
    filter: '',
    collapsed: new Set<string>(),
    autoReveal: true,
    revealTarget: null,
    revealTick: 0,
    viewMode: 'read',
    draft: null,
    conflict: null,
    pendingSwitch: null,

    setFilter: (value) => set({ filter: value }),
    setQuery: (value) => set({ query: value }),
    setSearchOpen: (value) => set({ searchOpen: value }),
    selectPath: (path) => set({ selectedPath: path }),
    toggleFolder: (key) => {
      const next = new Set(get().collapsed)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      set({ collapsed: next })
    },
    expandAll: () => set({ collapsed: new Set<string>() }),
    collapseAll: () => set({ collapsed: new Set(get().folders) }),
    revealPath: (path) => {
      const next = new Set(get().collapsed)
      for (const ancestor of ancestorsOf(path)) next.delete(ancestor)
      set({ collapsed: next, revealTarget: path, revealTick: get().revealTick + 1 })
    },
    setAutoReveal: (value) => {
      localStorage.setItem('vv-autoreveal', value ? '1' : '0')
      set({ autoReveal: value })
    },
    createFolderAt: async (parentRel, name) => {
      const res = await window.api.createFolder(parentRel, name)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return null
      }
      const path = res.path ?? (parentRel ? `${parentRel}/${name}` : name)
      if (!get().folders.includes(path)) set({ folders: [...get().folders, path] })
      get().revealPath(path)
      return path
    },
    renameItem: async (relPath, newName) => {
      const res = await window.api.renamePath(relPath, newName)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return null
      }
      const newPath = res.path ?? relPath
      if (newPath === relPath) return newPath
      const shift = (value: string | null): string | null => {
        if (value === relPath) return newPath
        if (value && value.startsWith(`${relPath}/`)) return newPath + value.slice(relPath.length)
        return value
      }
      const { tree, folders, openPath, selectedPath, collapsed } = get()
      set({
        tree: tree.map((path) => shift(path) ?? path),
        folders: folders.map((path) => shift(path) ?? path),
        collapsed: remapCollapsed(collapsed, relPath, newPath),
        selectedPath: shift(selectedPath)
      })
      const nextOpen = shift(openPath)
      if (nextOpen && nextOpen !== openPath) {
        const current = get().note
        set({ openPath: nextOpen, note: current ? { ...current, path: nextOpen } : null })
        await get().refreshNoteMeta()
      }
      return newPath
    },
    deleteItem: async (relPath) => {
      const res = await window.api.deletePath(relPath)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return false
      }
      const under = (value: string | null): boolean =>
        value === relPath || (!!value && value.startsWith(`${relPath}/`))
      const { tree, folders, openPath, selectedPath, collapsed } = get()
      set({
        tree: tree.filter((path) => !under(path)),
        folders: folders.filter((path) => !under(path)),
        collapsed: new Set(
          [...collapsed].filter((key) => key !== relPath && !key.startsWith(`${relPath}/`))
        ),
        selectedPath: under(selectedPath) ? null : selectedPath,
        ...(under(openPath)
          ? {
              openPath: null,
              note: null,
              backlinks: [],
              outgoing: [],
              linkMap: {},
              pendingWiki: null,
              pendingFind: null,
              viewMode: 'read' as const,
              draft: null,
              conflict: null,
              pendingSwitch: null
            }
          : {})
      })
      get().showToast('Moved to the Recycle Bin')
      return true
    },
    setTheme: (value) => {
      localStorage.setItem('vv-theme', value)
      document.documentElement.dataset.theme = value
      set({ theme: value })
    },

    init: async () => {
      const stored = localStorage.getItem('vv-theme')
      if (stored === 'dark' || stored === 'light') {
        document.documentElement.dataset.theme = stored
        set({ theme: stored })
      }
      const storedAuto = localStorage.getItem('vv-autoreveal')
      if (storedAuto === '0') set({ autoReveal: false })
      if (storedAuto === '1') set({ autoReveal: true })
      const recents = await window.api.recentVaults()
      set({ recents })
      if (initialized) return
      initialized = true

      window.api.onIndexProgress((progress) => {
        set({ progress })
        if (progress.phase === 'done') void get().refreshNoteMeta()
      })
      window.api.onVaultChanged(() => {
        void get().handleChanged()
      })
      window.api.onVaultOpened((result) => {
        void applyVault(result)
      })

      const state = await window.api.getVaultState()
      if (state.root) {
        const { tree, folders } = await window.api.getTree()
        set({
          root: state.root,
          tree,
          folders,
          collapsed: loadCollapsed(state.root)
        })
        const first = firstMarkdown(tree)
        if (first) await get().openNote(first)
      }
    },

    openVaultPath: async (path) => {
      const result = await window.api.openVaultPath(path)
      if (!result) get().showToast('Could not open that folder')
    },

    openFolder: async () => {
      const result = await window.api.openFolder()
      if (!result) return
    },

    openNote: async (relPath, findTerm) => {
      if (isDirty(get())) {
        set({ pendingSwitch: { kind: 'open', path: relPath, findTerm: findTerm ?? null } })
        return
      }
      await doOpen(relPath, findTerm)
    },

    setViewMode: async (mode) => {
      const state = get()
      if (mode === state.viewMode || !state.note) return
      if (mode === 'read') {
        if (isDirty(state)) {
          set({ pendingSwitch: { kind: 'read' } })
          return
        }
        set({ viewMode: 'read', draft: null, conflict: null })
        return
      }
      set({ viewMode: 'edit', draft: state.note.raw, conflict: null })
    },

    updateDraft: (text) => set({ draft: text }),

    saveDraft: async () => {
      const { openPath, draft, root } = get()
      if (!root || !openPath || draft === null) return false
      const res = await window.api.writeFile(openPath, draft)
      if (!res.ok || !res.view) {
        get().showToast(res.error ?? 'Could not save the file')
        return false
      }
      set({ note: res.view, draft: null, conflict: null })
      await get().refreshNoteMeta()
      get().showToast('Saved')
      return true
    },

    revertDraft: () => {
      set({ draft: null, conflict: null })
      get().showToast('Changes discarded')
    },

    resolveSwitch: async (action) => {
      const pending = get().pendingSwitch
      if (!pending) return
      if (action === 'cancel') {
        set({ pendingSwitch: null })
        return
      }
      if (action === 'discard') {
        set({ draft: null, conflict: null, pendingSwitch: null })
        if (pending.kind === 'read') {
          set({ viewMode: 'read' })
          return
        }
        await doOpen(pending.path, pending.findTerm)
        return
      }
      const saved = await get().saveDraft()
      set({ pendingSwitch: null })
      if (!saved) return
      if (pending.kind === 'read') {
        set({ viewMode: 'read' })
        return
      }
      await doOpen(pending.path, pending.findTerm)
    },

    reloadFromDisk: () => set({ draft: null, conflict: null }),

    keepEditing: () => set({ conflict: null }),

    closeDeletedFile: () => {
      set({
        viewMode: 'read',
        draft: null,
        conflict: null,
        openPath: null,
        note: null,
        backlinks: [],
        outgoing: [],
        linkMap: {},
        selectedPath: null
      })
      get().showToast('The open file was removed')
    },

    refreshNoteMeta: async () => {
      const { openPath } = get()
      if (!openPath) return
      const [backlinks, outgoing, linkMap] = await Promise.all([
        window.api.getBacklinks(openPath),
        window.api.getOutgoing(openPath),
        window.api.resolveNoteLinks(openPath)
      ])
      set({ backlinks, outgoing, linkMap })
    },

    handleChanged: async () => {
      if (!get().root) return
      const { tree, folders } = await window.api.getTree()
      set({ tree, folders })
      const { openPath } = get()
      if (openPath) {
        const note = await window.api.readFile(openPath)
        if (note) {
          const draft = get().draft
          if (draft !== null) {
            if (draft === note.raw) set({ note, draft: null, conflict: null })
            else set({ note, conflict: 'changed' })
          } else {
            set({ note })
          }
          await get().refreshNoteMeta()
        } else if (get().viewMode === 'edit' && get().draft !== null) {
          set({ conflict: 'deleted' })
        } else {
          set({
            openPath: null,
            note: null,
            backlinks: [],
            outgoing: [],
            linkMap: {},
            selectedPath: get().selectedPath === openPath ? null : get().selectedPath
          })
          get().showToast('The open file was removed')
        }
      }
      if (get().searchOpen || get().query || get().tagFilter) await get().runSearch()
    },

    runSearch: async () => {
      const { query, tagFilter } = get()
      if (tagFilter) {
        const hits = await window.api.searchTag(tagFilter)
        set({ hits, searchOpen: true })
        return
      }
      const trimmed = query.trim()
      if (!trimmed) {
        set({ hits: [], searchOpen: false })
        return
      }
      const hits = await window.api.search(trimmed)
      set({ hits, searchOpen: true })
    },

    clearSearch: () => set({ query: '', hits: [], tagFilter: null, searchOpen: false }),

    clickWiki: (target) => {
      const outcome: ResolveOutcome | undefined = get().linkMap[target]
      if (!outcome || outcome.status === 'missing') {
        get().showToast(`No note matches [[${target}]]`)
        return
      }
      if (outcome.status === 'ok') {
        void get().openNote(outcome.path)
        return
      }
      set({ pendingWiki: { target, options: outcome.options } })
    },

    clickTag: async (tag) => {
      set({ tagFilter: tag, query: '', hits: [], searchOpen: true })
      const hits = await window.api.searchTag(tag)
      set({ hits })
    },

    dismissWiki: () => set({ pendingWiki: null }),

    showToast: (message) => {
      set({ toast: message })
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), 2800)
    }
  }
})
