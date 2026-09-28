import { create } from 'zustand'
import { ancestorsOf, remapCollapsed } from '@/lib/tree'
import { relFromRoot } from '@/lib/externalPath'
import {
  applyScope,
  cycleScopeValue,
  pushSearchHistory,
  type SearchScope
} from '@/lib/searchScope'
import { SUPPORTED_EXTENSIONS } from '@shared/constants'
import type {
  BacklinkItem,
  FileView,
  IndexProgress,
  LinkMap,
  OpenVaultResult,
  OutgoingItem,
  RecentVault,
  ResolveOutcome,
  SearchHit,
  SnapshotMeta
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
  scope: SearchScope
  hitCursor: number
  searchHistory: string[]
  tagFilter: string | null
  theme: Theme
  toast: string | null
  pendingWiki: { target: string; options: string[] } | null
  pendingFind: string | null
  filter: string
  collapsed: Set<string>
  pinned: string[]
  autoReveal: boolean
  revealTarget: string | null
  revealTick: number
  viewMode: ViewMode
  draft: string | null
  conflict: ConflictState
  pendingSwitch: PendingSwitch | null
  externalOpen: { absPath: string; dirty: boolean } | null
  pendingExternalFile: string | null
  historyOpen: boolean
  historyItems: SnapshotMeta[]
  historyView: FileView | null
  historySelected: number | null
  setFilter: (value: string) => void
  setQuery: (value: string) => void
  setTheme: (value: Theme) => void
  setSearchOpen: (value: boolean) => void
  selectPath: (path: string | null) => void
  toggleFolder: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  togglePin: (path: string) => void
  revealPath: (path: string) => void
  setAutoReveal: (value: boolean) => void
  createFolderAt: (parentRel: string, name: string) => Promise<string | null>
  renameItem: (relPath: string, newName: string) => Promise<string | null>
  deleteItem: (relPath: string) => Promise<boolean>
  newNote: (parentRel: string, name: string) => Promise<string | null>
  duplicateNote: (relPath: string) => Promise<string | null>
  moveItem: (relPath: string, destFolder: string) => Promise<boolean>
  init: () => Promise<void>
  openVaultPath: (path: string) => Promise<boolean>
  openFolder: () => Promise<void>
  openExternalFile: (absPath: string) => Promise<void>
  confirmExternalOpen: () => Promise<void>
  cancelExternalOpen: () => void
  drainPendingExternal: () => Promise<void>
  openNote: (relPath: string, findTerm?: string | null) => Promise<void>
  setViewMode: (mode: ViewMode) => Promise<void>
  updateDraft: (text: string) => void
  saveDraft: () => Promise<boolean>
  revertDraft: () => void
  resolveSwitch: (action: 'save' | 'discard' | 'cancel') => Promise<void>
  reloadFromDisk: () => void
  keepEditing: () => void
  closeDeletedFile: () => void
  openHistory: () => Promise<void>
  selectHistory: (id: number) => Promise<void>
  restoreHistory: () => Promise<void>
  closeHistory: () => void
  runSearch: () => Promise<void>
  clearSearch: () => void
  cycleScope: (delta: number) => void
  moveHitCursor: (delta: number) => void
  jumpHit: (delta: number) => Promise<void>
  openSearchHit: (index: number, closeDropdown: boolean) => Promise<void>
  useSearchHistoryItem: (item: string) => void
  clearSearchHistory: () => void
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

function loadPins(root: string): string[] {
  try {
    const raw = localStorage.getItem(`vv-pins:${root}`)
    if (!raw) return []
    const list: unknown = JSON.parse(raw)
    if (Array.isArray(list)) return list.filter((item): item is string => typeof item === 'string')
  } catch {
    void 0
  }
  return []
}

function savePins(root: string, pinned: string[]): void {
  try {
    localStorage.setItem(`vv-pins:${root}`, JSON.stringify(pinned))
  } catch {
    void 0
  }
}

function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem('vv-search-history')
    if (!raw) return []
    const list: unknown = JSON.parse(raw)
    if (Array.isArray(list)) {
      return list.filter((item): item is string => typeof item === 'string').slice(0, 10)
    }
  } catch {
    void 0
  }
  return []
}

function saveSearchHistory(list: string[]): void {
  try {
    localStorage.setItem('vv-search-history', JSON.stringify(list))
  } catch {
    void 0
  }
}

let initialized = false
let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<StoreState>((set, get) => {
  const recordSearch = (query: string): void => {
    const current = get().searchHistory
    const next = pushSearchHistory(current, query)
    if (next === current) return
    set({ searchHistory: next })
    saveSearchHistory(next)
  }

  const applyPathShift = async (relPath: string, newPath: string): Promise<void> => {
    const shift = (value: string | null): string | null => {
      if (value === relPath) return newPath
      if (value && value.startsWith(`${relPath}/`)) return newPath + value.slice(relPath.length)
      return value
    }
    const { tree, folders, openPath, selectedPath, collapsed, pinned, root } = get()
    const nextPinned = pinned.map((item) => shift(item) ?? item)
    set({
      tree: tree.map((path) => shift(path) ?? path),
      folders: folders.map((path) => shift(path) ?? path),
      collapsed: remapCollapsed(collapsed, relPath, newPath),
      pinned: nextPinned,
      selectedPath: shift(selectedPath)
    })
    if (root && nextPinned.some((item, index) => item !== pinned[index])) savePins(root, nextPinned)
    const nextOpen = shift(openPath)
    if (nextOpen && nextOpen !== openPath) {
      const current = get().note
      set({ openPath: nextOpen, note: current ? { ...current, path: nextOpen } : null })
      await get().refreshNoteMeta()
    }
  }

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
      pinned: loadPins(result.root),
      revealTarget: null,
      viewMode: 'read',
      draft: null,
      conflict: null,
      pendingSwitch: null,
      historyOpen: false,
      historyItems: [],
      historyView: null,
      historySelected: null,
      progress: { phase: 'indexing', indexed: 0, total: result.tree.length }
    })
    const recents = await window.api.recentVaults()
    set({ recents })
    if (get().pendingExternalFile) return
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
    scope: 'vault',
    hitCursor: 0,
    searchHistory: [],
    tagFilter: null,
    theme: 'light',
    toast: null,
    pendingWiki: null,
    pendingFind: null,
    filter: '',
    collapsed: new Set<string>(),
    pinned: [],
    autoReveal: true,
    revealTarget: null,
    revealTick: 0,
    viewMode: 'read',
    draft: null,
    conflict: null,
    pendingSwitch: null,
    externalOpen: null,
    pendingExternalFile: null,
    historyOpen: false,
    historyItems: [],
    historyView: null,
    historySelected: null,

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
    togglePin: (path) => {
      const { root, pinned } = get()
      const next = pinned.includes(path) ? pinned.filter((item) => item !== path) : [...pinned, path]
      if (root) savePins(root, next)
      set({ pinned: next })
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
      if (newPath !== relPath) await applyPathShift(relPath, newPath)
      return newPath
    },
    newNote: async (parentRel, name) => {
      const res = await window.api.createNote(parentRel, name)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return null
      }
      const path = res.path ?? (parentRel ? `${parentRel}/${name}.md` : `${name}.md`)
      if (!get().tree.includes(path)) set({ tree: [...get().tree, path] })
      get().revealPath(path)
      await get().openNote(path)
      return path
    },
    duplicateNote: async (relPath) => {
      const res = await window.api.duplicatePath(relPath)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return null
      }
      const path = res.path
      if (!path) return null
      if (!get().tree.includes(path)) set({ tree: [...get().tree, path] })
      get().revealPath(path)
      await get().openNote(path)
      return path
    },
    moveItem: async (relPath, destFolder) => {
      const res = await window.api.movePath(relPath, destFolder)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return false
      }
      const newPath = res.path ?? relPath
      if (newPath !== relPath) await applyPathShift(relPath, newPath)
      return true
    },
    deleteItem: async (relPath) => {
      const res = await window.api.deletePath(relPath)
      if (!res.ok) {
        if (res.error) get().showToast(res.error)
        return false
      }
      const under = (value: string | null): boolean =>
        value === relPath || (!!value && value.startsWith(`${relPath}/`))
      const { tree, folders, openPath, selectedPath, collapsed, pinned, root } = get()
      const nextPinned = pinned.filter((item) => !under(item))
      set({
        tree: tree.filter((path) => !under(path)),
        folders: folders.filter((path) => !under(path)),
        collapsed: new Set(
          [...collapsed].filter((key) => key !== relPath && !key.startsWith(`${relPath}/`))
        ),
        pinned: nextPinned,
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
      if (root && nextPinned.length !== pinned.length) savePins(root, nextPinned)
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
      set({ searchHistory: loadSearchHistory() })
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
        void (async () => {
          await applyVault(result)
          await get().drainPendingExternal()
        })()
      })
      window.api.onOpenFile((absPath) => {
        void get().openExternalFile(absPath)
      })

      const state = await window.api.getVaultState()
      if (state.root) {
        const { tree, folders } = await window.api.getTree()
        set({
          root: state.root,
          tree,
          folders,
          collapsed: loadCollapsed(state.root),
          pinned: loadPins(state.root)
        })
        const first = firstMarkdown(tree)
        if (first) await get().openNote(first)
      }
    },

    openVaultPath: async (path) => {
      const result = await window.api.openVaultPath(path)
      if (!result) {
        get().showToast('Could not open that folder')
        return false
      }
      return true
    },

    openFolder: async () => {
      const result = await window.api.openFolder()
      if (!result) return
    },

    openExternalFile: async (absPath) => {
      const dot = absPath.lastIndexOf('.')
      const slash = Math.max(absPath.lastIndexOf('/'), absPath.lastIndexOf('\\'))
      const ext = dot > slash ? absPath.slice(dot).toLowerCase() : ''
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        get().showToast(`Vault Viewer can't display ${ext || 'those'} files`)
        return
      }
      const { root } = get()
      if (root) {
        const rel = relFromRoot(root, absPath)
        if (rel) {
          await get().openNote(rel)
          return
        }
      }
      set({ externalOpen: { absPath, dirty: isDirty(get()) } })
    },

    confirmExternalOpen: async () => {
      const pending = get().externalOpen
      if (!pending) return
      const slash = Math.max(pending.absPath.lastIndexOf('/'), pending.absPath.lastIndexOf('\\'))
      const dir = pending.absPath.slice(0, slash)
      set({ externalOpen: null, pendingExternalFile: pending.absPath })
      const ok = await get().openVaultPath(dir)
      if (!ok) set({ pendingExternalFile: null })
    },

    cancelExternalOpen: () => set({ externalOpen: null }),

    drainPendingExternal: async () => {
      const pending = get().pendingExternalFile
      if (!pending) return
      const { root } = get()
      const rel = root ? relFromRoot(root, pending) : null
      set({ pendingExternalFile: null })
      if (rel) await get().openNote(rel)
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
        selectedPath: null,
        historyOpen: false,
        historyItems: [],
        historyView: null,
        historySelected: null
      })
      get().showToast('The open file was removed')
    },

    openHistory: async () => {
      const { openPath } = get()
      if (!openPath) return
      const items = await window.api.historyList(openPath)
      set({ historyOpen: true, historyItems: items, historyView: null, historySelected: null })
    },

    selectHistory: async (id) => {
      const view = await window.api.historyView(id)
      if (!view) {
        get().showToast('Could not load that version')
        return
      }
      set({ historySelected: id, historyView: view })
    },

    restoreHistory: async () => {
      const { openPath, historyView, root, viewMode } = get()
      if (!root || !openPath || !historyView) return
      if (isDirty(get())) {
        get().showToast('Save or revert your changes first')
        return
      }
      const res = await window.api.writeFile(openPath, historyView.raw)
      if (!res.ok || !res.view) {
        get().showToast(res.error ?? 'Could not restore that version')
        return
      }
      set({
        note: res.view,
        draft: viewMode === 'edit' ? res.view.raw : null,
        conflict: null,
        historyOpen: false,
        historyItems: [],
        historyView: null,
        historySelected: null
      })
      await get().refreshNoteMeta()
      get().showToast('Version restored')
    },

    closeHistory: () =>
      set({ historyOpen: false, historyView: null, historySelected: null, historyItems: [] }),

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
      const { query, tagFilter, scope, openPath } = get()
      if (tagFilter) {
        const hits = await window.api.searchTag(tagFilter)
        set({ hits: applyScope(hits, scope, openPath), searchOpen: true, hitCursor: 0 })
        return
      }
      const trimmed = query.trim()
      if (!trimmed) {
        set({ hits: [], hitCursor: 0 })
        return
      }
      const hits = await window.api.search(trimmed)
      set({ hits: applyScope(hits, scope, openPath), searchOpen: true, hitCursor: 0 })
    },

    clearSearch: () =>
      set({ query: '', hits: [], tagFilter: null, searchOpen: false, hitCursor: 0 }),

    cycleScope: (delta) => {
      const scope = cycleScopeValue(get().scope, delta)
      set({ scope, hitCursor: 0 })
      if (get().query.trim() || get().tagFilter) void get().runSearch()
    },

    moveHitCursor: (delta) => {
      const { hits, hitCursor } = get()
      if (!hits.length) return
      set({ hitCursor: (((hitCursor + delta) % hits.length) + hits.length) % hits.length })
    },

    jumpHit: async (delta) => {
      recordSearch(get().query)
      const { hits, hitCursor } = get()
      if (!hits.length) return
      const index = Math.min(Math.max(hitCursor, 0), hits.length - 1)
      await get().openSearchHit(index, false)
      set({ hitCursor: (((index + delta) % hits.length) + hits.length) % hits.length })
    },

    openSearchHit: async (index, closeDropdown) => {
      const { hits, tagFilter, query } = get()
      const hit = hits[index]
      if (!hit) return
      recordSearch(query)
      const term = tagFilter ?? query.trim().split(/\s+/)[0] ?? null
      if (closeDropdown) set({ searchOpen: false })
      await get().openNote(hit.path, term)
    },

    useSearchHistoryItem: (item) => {
      recordSearch(item)
      set({ query: item })
      void get().runSearch()
    },

    clearSearchHistory: () => {
      set({ searchHistory: [] })
      saveSearchHistory([])
    },

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
