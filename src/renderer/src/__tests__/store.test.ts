import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileView } from '@shared/types'

const makeView = (path: string, raw: string): FileView => ({
  kind: path.toLowerCase().endsWith('.md') ? 'markdown' : 'text',
  path,
  title: path,
  tags: [],
  frontmatter: {},
  body: raw,
  raw
})

const api = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  renamePath: vi.fn(),
  deletePath: vi.fn(),
  createNote: vi.fn(),
  duplicatePath: vi.fn(),
  movePath: vi.fn(),
  getBacklinks: vi.fn(),
  getOutgoing: vi.fn(),
  resolveNoteLinks: vi.fn(),
  getTree: vi.fn(),
  recentVaults: vi.fn(),
  search: vi.fn(),
  searchTag: vi.fn(),
  historyList: vi.fn(),
  historyView: vi.fn(),
  onIndexProgress: vi.fn(),
  onVaultChanged: vi.fn(),
  onVaultOpened: vi.fn(),
  onOpenFile: vi.fn(),
  openVaultPath: vi.fn(),
  openFolder: vi.fn(),
  getVaultState: vi.fn()
}

;(globalThis as unknown as { window: unknown }).window = { api }

const localStore = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => localStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStore.set(key, value)
    },
    removeItem: (key: string) => {
      localStore.delete(key)
    },
    clear: () => localStore.clear()
  },
  configurable: true,
  writable: true
})

import { isDirty, useStore } from '@/store'

const seedOpen = async (path: string, raw: string): Promise<void> => {
  api.readFile.mockResolvedValue(makeView(path, raw))
  await useStore.getState().openNote(path)
}

const enterDirtyEdit = async (raw: string, draft: string): Promise<void> => {
  await seedOpen('a.md', raw)
  await useStore.getState().setViewMode('edit')
  useStore.getState().updateDraft(draft)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStore.clear()
  api.getBacklinks.mockResolvedValue([])
  api.getOutgoing.mockResolvedValue([])
  api.resolveNoteLinks.mockResolvedValue({})
  api.getTree.mockResolvedValue({ tree: ['a.md', 'b.md'], folders: [] })
  api.recentVaults.mockResolvedValue([])
  api.historyList.mockResolvedValue([])
  api.historyView.mockResolvedValue(null)
  useStore.setState({
    root: '/vault',
    tree: ['a.md', 'b.md'],
    folders: [],
    pinned: [],
    openPath: null,
    selectedPath: null,
    note: null,
    linkMap: {},
    backlinks: [],
    outgoing: [],
    query: '',
    hits: [],
    searchOpen: false,
    scope: 'vault',
    hitCursor: 0,
    searchHistory: [],
    tagFilter: null,
    toast: null,
    pendingWiki: null,
    pendingFind: null,
    viewMode: 'read',
    draft: null,
    conflict: null,
    pendingSwitch: null,
    externalOpen: null,
    pendingExternalFile: null,
    historyOpen: false,
    historyItems: [],
    historyView: null,
    historySelected: null
  })
})

describe('isDirty', () => {
  it('is false without a draft', () => {
    expect(isDirty({ draft: null, note: makeView('a.md', 'raw') })).toBe(false)
  })

  it('is false when the draft equals the note', () => {
    expect(isDirty({ draft: 'raw', note: makeView('a.md', 'raw') })).toBe(false)
  })

  it('is true when the draft differs from the note', () => {
    expect(isDirty({ draft: 'edited', note: makeView('a.md', 'raw') })).toBe(true)
  })

  it('is false without a note', () => {
    expect(isDirty({ draft: 'edited', note: null })).toBe(false)
  })
})

describe('setViewMode', () => {
  it('seeds the draft from the note when entering edit', async () => {
    await seedOpen('a.md', '# hello')
    await useStore.getState().setViewMode('edit')
    expect(useStore.getState().viewMode).toBe('edit')
    expect(useStore.getState().draft).toBe('# hello')
    expect(isDirty(useStore.getState())).toBe(false)
  })

  it('leaves edit cleanly when there are no changes', async () => {
    await seedOpen('a.md', '# hello')
    await useStore.getState().setViewMode('edit')
    await useStore.getState().setViewMode('read')
    expect(useStore.getState().viewMode).toBe('read')
    expect(useStore.getState().draft).toBeNull()
  })

  it('defers switching to read while dirty', async () => {
    await enterDirtyEdit('# hello', '# hello\nmore')
    await useStore.getState().setViewMode('read')
    expect(useStore.getState().viewMode).toBe('edit')
    expect(useStore.getState().pendingSwitch).toEqual({ kind: 'read' })
    expect(useStore.getState().draft).toBe('# hello\nmore')
  })

  it('does nothing without an open note', async () => {
    await useStore.getState().setViewMode('edit')
    expect(useStore.getState().viewMode).toBe('read')
  })
})

describe('openNote guard', () => {
  it('defers opening another note while dirty', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.readFile.mockClear()
    await useStore.getState().openNote('b.md', 'term')
    expect(api.readFile).not.toHaveBeenCalled()
    expect(useStore.getState().pendingSwitch).toEqual({
      kind: 'open',
      path: 'b.md',
      findTerm: 'term'
    })
    expect(useStore.getState().openPath).toBe('a.md')
  })

  it('opens directly when clean', async () => {
    await seedOpen('a.md', '# a')
    await useStore.getState().setViewMode('edit')
    await useStore.getState().openNote('b.md')
    expect(useStore.getState().openPath).toBe('b.md')
    expect(useStore.getState().pendingSwitch).toBeNull()
  })
})

describe('resolveSwitch', () => {
  it('cancel keeps the dirty draft and the modal state cleared', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    await useStore.getState().openNote('b.md')
    await useStore.getState().resolveSwitch('cancel')
    expect(useStore.getState().pendingSwitch).toBeNull()
    expect(useStore.getState().draft).toBe('# a\nedits')
    expect(useStore.getState().openPath).toBe('a.md')
  })

  it('discard drops the draft and opens the target', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    await useStore.getState().openNote('b.md')
    api.readFile.mockResolvedValue(makeView('b.md', '# b'))
    await useStore.getState().resolveSwitch('discard')
    expect(useStore.getState().openPath).toBe('b.md')
    expect(useStore.getState().draft).toBe('# b')
    expect(useStore.getState().pendingSwitch).toBeNull()
    expect(isDirty(useStore.getState())).toBe(false)
  })

  it('save writes the draft first, then opens the target', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    await useStore.getState().openNote('b.md')
    api.writeFile.mockResolvedValue({ ok: true, path: 'a.md', view: makeView('a.md', '# a\nedits') })
    api.readFile.mockResolvedValue(makeView('b.md', '# b'))
    await useStore.getState().resolveSwitch('save')
    expect(api.writeFile).toHaveBeenCalledWith('a.md', '# a\nedits')
    expect(useStore.getState().openPath).toBe('b.md')
    expect(useStore.getState().pendingSwitch).toBeNull()
  })

  it('save failure clears the modal but keeps the draft', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    await useStore.getState().openNote('b.md')
    api.writeFile.mockResolvedValue({ ok: false, error: 'Could not save the file' })
    await useStore.getState().resolveSwitch('save')
    expect(useStore.getState().pendingSwitch).toBeNull()
    expect(useStore.getState().openPath).toBe('a.md')
    expect(useStore.getState().draft).toBe('# a\nedits')
  })
})

describe('saveDraft', () => {
  it('writes, clears the draft and refreshes the note', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.writeFile.mockResolvedValue({ ok: true, path: 'a.md', view: makeView('a.md', '# a\nedits') })
    const saved = await useStore.getState().saveDraft()
    expect(saved).toBe(true)
    expect(api.writeFile).toHaveBeenCalledWith('a.md', '# a\nedits')
    expect(useStore.getState().note?.raw).toBe('# a\nedits')
    expect(useStore.getState().draft).toBeNull()
    expect(useStore.getState().toast).toBe('Saved')
  })

  it('keeps the draft and toasts on failure', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.writeFile.mockResolvedValue({ ok: false, error: 'Could not save the file' })
    const saved = await useStore.getState().saveDraft()
    expect(saved).toBe(false)
    expect(useStore.getState().draft).toBe('# a\nedits')
    expect(useStore.getState().toast).toBe('Could not save the file')
  })

  it('does nothing without a draft', async () => {
    await seedOpen('a.md', '# a')
    const saved = await useStore.getState().saveDraft()
    expect(saved).toBe(false)
    expect(api.writeFile).not.toHaveBeenCalled()
  })

  it('stays in edit with the draft when the saved file cannot be read back', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.writeFile.mockResolvedValue({ ok: false, error: 'Could not read the saved file' })
    const saved = await useStore.getState().saveDraft()
    expect(saved).toBe(false)
    expect(useStore.getState().viewMode).toBe('edit')
    expect(useStore.getState().draft).toBe('# a\nedits')
    expect(useStore.getState().note?.raw).toBe('# a')
    expect(isDirty(useStore.getState())).toBe(true)
    expect(useStore.getState().toast).toBe('Could not read the saved file')
  })
})

describe('revertDraft', () => {
  it('drops the draft and the conflict state', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    useStore.setState({ conflict: 'changed' })
    useStore.getState().revertDraft()
    expect(useStore.getState().draft).toBeNull()
    expect(useStore.getState().conflict).toBeNull()
    expect(useStore.getState().toast).toBe('Changes discarded')
  })
})

describe('handleChanged', () => {
  it('raises a conflict when disk differs from the dirty draft', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.readFile.mockResolvedValue(makeView('a.md', '# external change'))
    await useStore.getState().handleChanged()
    expect(useStore.getState().conflict).toBe('changed')
    expect(useStore.getState().note?.raw).toBe('# external change')
    expect(isDirty(useStore.getState())).toBe(true)
  })

  it('clears the draft when disk matches the dirty draft', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.readFile.mockResolvedValue(makeView('a.md', '# a\nedits'))
    await useStore.getState().handleChanged()
    expect(useStore.getState().conflict).toBeNull()
    expect(useStore.getState().draft).toBeNull()
    expect(isDirty(useStore.getState())).toBe(false)
  })

  it('keeps the editor open with a deleted conflict when the file vanishes', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.readFile.mockResolvedValue(null)
    await useStore.getState().handleChanged()
    expect(useStore.getState().conflict).toBe('deleted')
    expect(useStore.getState().openPath).toBe('a.md')
    expect(useStore.getState().draft).toBe('# a\nedits')
  })

  it('closes a clean open file that vanished', async () => {
    await seedOpen('a.md', '# a')
    api.readFile.mockResolvedValue(null)
    await useStore.getState().handleChanged()
    expect(useStore.getState().openPath).toBeNull()
    expect(useStore.getState().note).toBeNull()
    expect(useStore.getState().toast).toBe('The open file was removed')
  })

  it('does nothing without an open vault', async () => {
    useStore.setState({ root: null })
    await useStore.getState().handleChanged()
    expect(api.getTree).not.toHaveBeenCalled()
  })
})

describe('rename while dirty', () => {
  it('keeps the draft and updates the open path in place', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.renamePath.mockResolvedValue({ ok: true, path: 'renamed.md' })
    const result = await useStore.getState().renameItem('a.md', 'renamed.md')
    expect(result).toBe('renamed.md')
    const state = useStore.getState()
    expect(state.openPath).toBe('renamed.md')
    expect(state.note?.path).toBe('renamed.md')
    expect(state.note?.raw).toBe('# a')
    expect(state.draft).toBe('# a\nedits')
    expect(state.pendingSwitch).toBeNull()
    expect(state.viewMode).toBe('edit')
    expect(isDirty(state)).toBe(true)
    expect(state.tree).toContain('renamed.md')
  })

  it('defers a rename of a closed file without prompting', async () => {
    api.renamePath.mockResolvedValue({ ok: true, path: 'renamed.md' })
    const result = await useStore.getState().renameItem('b.md', 'renamed.md')
    expect(result).toBe('renamed.md')
    expect(useStore.getState().pendingSwitch).toBeNull()
  })
})

describe('conflict actions', () => {
  it('reloadFromDisk adopts the disk baseline', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    useStore.setState({ conflict: 'changed', note: makeView('a.md', '# external change') })
    useStore.getState().reloadFromDisk()
    expect(useStore.getState().draft).toBeNull()
    expect(useStore.getState().conflict).toBeNull()
    expect(isDirty(useStore.getState())).toBe(false)
  })

  it('keepEditing preserves the draft and only clears the banner', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    useStore.setState({ conflict: 'changed' })
    useStore.getState().keepEditing()
    expect(useStore.getState().conflict).toBeNull()
    expect(useStore.getState().draft).toBe('# a\nedits')
  })

  it('closeDeletedFile resets the pane', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    useStore.setState({ conflict: 'deleted' })
    useStore.getState().closeDeletedFile()
    expect(useStore.getState().openPath).toBeNull()
    expect(useStore.getState().viewMode).toBe('read')
    expect(useStore.getState().draft).toBeNull()
    expect(useStore.getState().conflict).toBeNull()
    expect(useStore.getState().toast).toBe('The open file was removed')
  })
})

describe('history', () => {
  const snapshot = (id: number) => ({
    id,
    relPath: 'a.md',
    source: 'change' as const,
    createdAt: 1000 + id,
    size: 9
  })

  it('opens the overlay and loads snapshot metadata', async () => {
    await seedOpen('a.md', '# hi')
    api.historyList.mockResolvedValue([snapshot(7), snapshot(5)])
    await useStore.getState().openHistory()
    expect(api.historyList).toHaveBeenCalledWith('a.md')
    expect(useStore.getState().historyOpen).toBe(true)
    expect(useStore.getState().historyItems).toHaveLength(2)
    expect(useStore.getState().historyView).toBeNull()
    expect(useStore.getState().historySelected).toBeNull()
  })

  it('does nothing without an open file', async () => {
    await useStore.getState().openHistory()
    expect(api.historyList).not.toHaveBeenCalled()
    expect(useStore.getState().historyOpen).toBe(false)
  })

  it('loads the snapshot view on select and closes cleanly', async () => {
    await seedOpen('a.md', '# hi')
    api.historyList.mockResolvedValue([snapshot(7)])
    await useStore.getState().openHistory()
    api.historyView.mockResolvedValue(makeView('a.md', '# older'))
    await useStore.getState().selectHistory(7)
    expect(useStore.getState().historySelected).toBe(7)
    expect(useStore.getState().historyView?.raw).toBe('# older')
    useStore.getState().closeHistory()
    expect(useStore.getState().historyOpen).toBe(false)
    expect(useStore.getState().historyItems).toHaveLength(0)
    expect(useStore.getState().historyView).toBeNull()
  })

  it('toasts when a snapshot view cannot be loaded', async () => {
    await seedOpen('a.md', '# hi')
    await useStore.getState().selectHistory(7)
    expect(useStore.getState().historyView).toBeNull()
    expect(useStore.getState().toast).toBe('Could not load that version')
  })

  it('restores a snapshot when clean', async () => {
    await seedOpen('a.md', '# hi')
    api.historyList.mockResolvedValue([snapshot(7)])
    await useStore.getState().openHistory()
    api.historyView.mockResolvedValue(makeView('a.md', '# older'))
    await useStore.getState().selectHistory(7)
    api.writeFile.mockResolvedValue({ ok: true, path: 'a.md', view: makeView('a.md', '# older') })
    await useStore.getState().restoreHistory()
    expect(api.writeFile).toHaveBeenCalledWith('a.md', '# older')
    expect(useStore.getState().note?.raw).toBe('# older')
    expect(useStore.getState().historyOpen).toBe(false)
    expect(useStore.getState().toast).toBe('Version restored')
  })

  it('blocks restore while the editor is dirty', async () => {
    await enterDirtyEdit('# a', '# a\nedits')
    api.historyList.mockResolvedValue([snapshot(7)])
    await useStore.getState().openHistory()
    api.historyView.mockResolvedValue(makeView('a.md', '# older'))
    await useStore.getState().selectHistory(7)
    api.writeFile.mockClear()
    await useStore.getState().restoreHistory()
    expect(api.writeFile).not.toHaveBeenCalled()
    expect(useStore.getState().note?.raw).toBe('# a')
    expect(useStore.getState().draft).toBe('# a\nedits')
    expect(useStore.getState().historyOpen).toBe(true)
    expect(useStore.getState().toast).toBe('Save or revert your changes first')
  })

  it('keeps edit mode in sync after a restore', async () => {
    await seedOpen('a.md', '# hi')
    await useStore.getState().setViewMode('edit')
    api.historyList.mockResolvedValue([snapshot(7)])
    await useStore.getState().openHistory()
    api.historyView.mockResolvedValue(makeView('a.md', '# older'))
    await useStore.getState().selectHistory(7)
    api.writeFile.mockResolvedValue({ ok: true, path: 'a.md', view: makeView('a.md', '# older') })
    await useStore.getState().restoreHistory()
    expect(useStore.getState().viewMode).toBe('edit')
    expect(useStore.getState().draft).toBe('# older')
    expect(isDirty(useStore.getState())).toBe(false)
  })

  it('does nothing without a selected snapshot', async () => {
    await seedOpen('a.md', '# hi')
    await useStore.getState().restoreHistory()
    expect(api.writeFile).not.toHaveBeenCalled()
  })

  it('reports write failures and keeps the overlay open', async () => {
    await seedOpen('a.md', '# hi')
    api.historyList.mockResolvedValue([snapshot(7)])
    await useStore.getState().openHistory()
    api.historyView.mockResolvedValue(makeView('a.md', '# older'))
    await useStore.getState().selectHistory(7)
    api.writeFile.mockResolvedValue({ ok: false, error: 'Could not save the file' })
    await useStore.getState().restoreHistory()
    expect(useStore.getState().historyOpen).toBe(true)
    expect(useStore.getState().toast).toBe('Could not save the file')
  })
})

describe('pins', () => {
  it('toggles a pin and persists it for the vault', () => {
    useStore.getState().togglePin('a.md')
    expect(useStore.getState().pinned).toEqual(['a.md'])
    expect(localStore.get('vv-pins:/vault')).toBe('["a.md"]')
    useStore.getState().togglePin('b.md')
    expect(useStore.getState().pinned).toEqual(['a.md', 'b.md'])
    useStore.getState().togglePin('a.md')
    expect(useStore.getState().pinned).toEqual(['b.md'])
    expect(localStore.get('vv-pins:/vault')).toBe('["b.md"]')
  })

  it('skips persistence when no vault is open', () => {
    useStore.setState({ root: null })
    useStore.getState().togglePin('a.md')
    expect(useStore.getState().pinned).toEqual(['a.md'])
    expect([...localStore.keys()]).toEqual([])
  })

  it('remaps a pinned file on rename', async () => {
    useStore.setState({ pinned: ['a.md'] })
    api.renamePath.mockResolvedValue({ ok: true, path: 'renamed.md' })
    await useStore.getState().renameItem('a.md', 'renamed.md')
    expect(useStore.getState().pinned).toEqual(['renamed.md'])
    expect(localStore.get('vv-pins:/vault')).toBe('["renamed.md"]')
  })

  it('remaps pins under a renamed folder', async () => {
    useStore.setState({ pinned: ['a.md', 'sub/note.md'] })
    api.renamePath.mockResolvedValue({ ok: true, path: 'moved' })
    await useStore.getState().renameItem('sub', 'moved')
    expect(useStore.getState().pinned).toEqual(['a.md', 'moved/note.md'])
    expect(localStore.get('vv-pins:/vault')).toBe('["a.md","moved/note.md"]')
  })

  it('drops pins under a deleted folder and persists', async () => {
    useStore.setState({ pinned: ['a.md', 'sub/note.md'] })
    api.deletePath.mockResolvedValue({ ok: true, path: 'sub' })
    await useStore.getState().deleteItem('sub')
    expect(useStore.getState().pinned).toEqual(['a.md'])
    expect(localStore.get('vv-pins:/vault')).toBe('["a.md"]')
  })

  it('keeps unrelated pins when a pinned file is deleted', async () => {
    useStore.setState({ pinned: ['a.md', 'b.md'] })
    api.deletePath.mockResolvedValue({ ok: true, path: 'a.md' })
    await useStore.getState().deleteItem('a.md')
    expect(useStore.getState().pinned).toEqual(['b.md'])
  })
})

describe('search scope, cursor and history', () => {
  const mkHit = (path: string) => ({ path, title: path, snippet: '', score: 1 })

  it('applies the folder scope to search results', async () => {
    api.search.mockResolvedValue([mkHit('a.md'), mkHit('sub/b.md')])
    useStore.setState({ query: 'x', scope: 'folder', openPath: 'a.md' })
    await useStore.getState().runSearch()
    expect(useStore.getState().hits.map((h) => h.path)).toEqual(['a.md'])
  })

  it('applies the note scope to search results', async () => {
    api.search.mockResolvedValue([mkHit('a.md'), mkHit('b.md')])
    useStore.setState({ query: 'x', scope: 'note', openPath: 'b.md' })
    await useStore.getState().runSearch()
    expect(useStore.getState().hits.map((h) => h.path)).toEqual(['b.md'])
  })

  it('cycles the scope, resets the cursor and re-runs an active search', async () => {
    api.search.mockResolvedValue([mkHit('a.md')])
    useStore.setState({ query: 'x', scope: 'vault', hitCursor: 0 })
    await useStore.getState().runSearch()
    useStore.setState({ hitCursor: 1 })
    useStore.getState().cycleScope(1)
    expect(useStore.getState().scope).toBe('folder')
    expect(useStore.getState().hitCursor).toBe(0)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(api.search).toHaveBeenCalledTimes(2)
  })

  it('moves the hit cursor with wrap-around and ignores empty results', () => {
    useStore.setState({ hits: [mkHit('a.md'), mkHit('b.md')], hitCursor: 0 })
    useStore.getState().moveHitCursor(-1)
    expect(useStore.getState().hitCursor).toBe(1)
    useStore.getState().moveHitCursor(1)
    expect(useStore.getState().hitCursor).toBe(0)
    useStore.setState({ hits: [] })
    useStore.getState().moveHitCursor(1)
    expect(useStore.getState().hitCursor).toBe(0)
  })

  it('jump opens the current hit and advances the cursor', async () => {
    api.search.mockResolvedValue([mkHit('b.md'), mkHit('a.md')])
    useStore.setState({ query: 'x', scope: 'vault' })
    await useStore.getState().runSearch()
    api.readFile.mockResolvedValue(makeView('b.md', '# b'))
    await useStore.getState().jumpHit(1)
    expect(useStore.getState().openPath).toBe('b.md')
    expect(useStore.getState().hitCursor).toBe(1)
    expect(useStore.getState().searchHistory).toEqual(['x'])
  })

  it('jump records a query even when there are no hits', async () => {
    useStore.setState({ query: '  hello  ', searchHistory: [], hits: [], hitCursor: 0 })
    await useStore.getState().jumpHit(1)
    expect(useStore.getState().searchHistory).toEqual(['hello'])
    expect(localStore.get('vv-search-history')).toBe('["hello"]')
    expect(useStore.getState().hitCursor).toBe(0)
  })

  it('restores a history item and re-runs the search', async () => {
    api.search.mockResolvedValue([mkHit('a.md')])
    useStore.getState().useSearchHistoryItem('alpha')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(useStore.getState().query).toBe('alpha')
    expect(api.search).toHaveBeenCalledWith('alpha')
    expect(useStore.getState().searchHistory).toEqual(['alpha'])
  })

  it('clears the persisted history', () => {
    useStore.setState({ searchHistory: ['x'] })
    localStore.set('vv-search-history', '["x"]')
    useStore.getState().clearSearchHistory()
    expect(useStore.getState().searchHistory).toEqual([])
    expect(localStore.get('vv-search-history')).toBe('[]')
  })
})

describe('file operations', () => {
  it('newNote creates the file and opens it', async () => {
    api.createNote.mockResolvedValue({ ok: true, path: 'sub/Fresh.md' })
    api.readFile.mockResolvedValue(makeView('sub/Fresh.md', '# Fresh'))
    useStore.setState({ tree: ['a.md', 'b.md'] })
    const result = await useStore.getState().newNote('sub', 'Fresh')
    expect(api.createNote).toHaveBeenCalledWith('sub', 'Fresh')
    expect(result).toBe('sub/Fresh.md')
    expect(useStore.getState().openPath).toBe('sub/Fresh.md')
    expect(useStore.getState().tree).toContain('sub/Fresh.md')
    expect(useStore.getState().selectedPath ?? useStore.getState().openPath).toBe('sub/Fresh.md')
  })

  it('newNote surfaces the error and opens nothing', async () => {
    api.createNote.mockResolvedValue({ ok: false, error: 'An item with that name already exists' })
    const result = await useStore.getState().newNote('', 'Fresh')
    expect(result).toBeNull()
    expect(useStore.getState().openPath).toBeNull()
    expect(useStore.getState().toast).toBe('An item with that name already exists')
  })

  it('duplicateNote opens the copy', async () => {
    api.duplicatePath.mockResolvedValue({ ok: true, path: 'a copy.md' })
    api.readFile.mockResolvedValue(makeView('a copy.md', '# a'))
    const result = await useStore.getState().duplicateNote('a.md')
    expect(api.duplicatePath).toHaveBeenCalledWith('a.md')
    expect(result).toBe('a copy.md')
    expect(useStore.getState().openPath).toBe('a copy.md')
    expect(useStore.getState().tree).toContain('a copy.md')
  })

  it('duplicateNote surfaces the error', async () => {
    api.duplicatePath.mockResolvedValue({ ok: false, error: 'That item no longer exists' })
    const result = await useStore.getState().duplicateNote('ghost.md')
    expect(result).toBeNull()
    expect(useStore.getState().toast).toBe('That item no longer exists')
  })

  it('moveItem remaps the tree, pins and open path', async () => {
    api.movePath.mockResolvedValue({ ok: true, path: 'sub/a.md' })
    api.readFile.mockResolvedValue(makeView('sub/a.md', '# a'))
    useStore.setState({ openPath: 'a.md', selectedPath: 'a.md', pinned: ['a.md'], tree: ['a.md', 'b.md'] })
    const result = await useStore.getState().moveItem('a.md', 'sub')
    expect(api.movePath).toHaveBeenCalledWith('a.md', 'sub')
    expect(result).toBe(true)
    expect(useStore.getState().tree).toEqual(['sub/a.md', 'b.md'])
    expect(useStore.getState().pinned).toEqual(['sub/a.md'])
    expect(useStore.getState().openPath).toBe('sub/a.md')
    expect(localStore.get('vv-pins:/vault')).toBe('["sub/a.md"]')
  })

  it('moveItem is a no-op for the current folder and false on failure', async () => {
    api.movePath.mockResolvedValue({ ok: true, path: 'a.md' })
    useStore.setState({ openPath: 'a.md' })
    expect(await useStore.getState().moveItem('a.md', '')).toBe(true)
    expect(useStore.getState().openPath).toBe('a.md')
    api.movePath.mockResolvedValue({ ok: false, error: 'An item with that name already exists' })
    expect(await useStore.getState().moveItem('b.md', '')).toBe(false)
    expect(useStore.getState().toast).toBe('An item with that name already exists')
  })
})

describe('external file open', () => {
  it('opens a supported file inside the vault directly', async () => {
    api.readFile.mockResolvedValue(makeView('sub/note.md', '# n'))
    await useStore.getState().openExternalFile('/vault/sub/note.md')
    expect(useStore.getState().openPath).toBe('sub/note.md')
    expect(useStore.getState().externalOpen).toBeNull()
  })

  it('prompts when the file is outside the vault', async () => {
    await useStore.getState().openExternalFile('/other/note.md')
    expect(useStore.getState().externalOpen).toEqual({
      absPath: '/other/note.md',
      dirty: false
    })
    expect(api.readFile).not.toHaveBeenCalled()
  })

  it('records unsaved changes in the prompt', async () => {
    await enterDirtyEdit('raw', 'edited')
    await useStore.getState().openExternalFile('/other/note.md')
    expect(useStore.getState().externalOpen?.dirty).toBe(true)
  })

  it('toasts for unsupported extensions', async () => {
    await useStore.getState().openExternalFile('C:\\pic.png')
    expect(useStore.getState().toast).toBe("Vault Viewer can't display .png files")
    expect(useStore.getState().externalOpen).toBeNull()
  })

  it('confirmExternalOpen switches vault and queues the file', async () => {
    api.openVaultPath.mockResolvedValue(true)
    useStore.setState({ externalOpen: { absPath: 'C:\\Other Vault\\n.md', dirty: false } })
    await useStore.getState().confirmExternalOpen()
    expect(api.openVaultPath).toHaveBeenCalledWith('C:\\Other Vault')
    expect(useStore.getState().pendingExternalFile).toBe('C:\\Other Vault\\n.md')
    expect(useStore.getState().externalOpen).toBeNull()
  })

  it('confirmExternalOpen clears the queue when the vault fails to open', async () => {
    api.openVaultPath.mockResolvedValue(false)
    useStore.setState({ externalOpen: { absPath: '/other/n.md', dirty: false } })
    await useStore.getState().confirmExternalOpen()
    expect(useStore.getState().pendingExternalFile).toBeNull()
  })

  it('cancelExternalOpen dismisses the prompt', () => {
    useStore.setState({ externalOpen: { absPath: '/other/n.md', dirty: false } })
    useStore.getState().cancelExternalOpen()
    expect(useStore.getState().externalOpen).toBeNull()
  })

  it('drainPendingExternal opens the queued file relative to the new root', async () => {
    api.readFile.mockResolvedValue(makeView('sub/n.md', '# n'))
    useStore.setState({ pendingExternalFile: '/vault/sub/n.md' })
    await useStore.getState().drainPendingExternal()
    expect(useStore.getState().openPath).toBe('sub/n.md')
    expect(useStore.getState().pendingExternalFile).toBeNull()
  })

  it('drainPendingExternal clears the queue when the file is not in the vault', async () => {
    useStore.setState({ pendingExternalFile: '/elsewhere/n.md' })
    await useStore.getState().drainPendingExternal()
    expect(useStore.getState().pendingExternalFile).toBeNull()
    expect(api.readFile).not.toHaveBeenCalled()
  })
})

describe('error-path hardening', () => {
  it('handleChanged keeps state when getTree fails', async () => {
    api.getTree.mockRejectedValue(new Error('disk error'))
    useStore.setState({ tree: ['a.md'], folders: [] })
    await expect(useStore.getState().handleChanged()).resolves.toBeUndefined()
    expect(useStore.getState().tree).toEqual(['a.md'])
  })

  it('runSearch keeps existing hits when the search fails', async () => {
    const hits = [{ path: 'a.md' }] as unknown as ReturnType<typeof Object>[]
    useStore.setState({ query: 'x', hits: hits as never })
    api.search.mockRejectedValue(new Error('db error'))
    await expect(useStore.getState().runSearch()).resolves.toBeUndefined()
    expect(useStore.getState().hits).toEqual(hits)
  })

  it('refreshNoteMeta keeps backlinks when link lookup fails', async () => {
    const backlinks = [{ relPath: 'b.md' }] as never[]
    useStore.setState({ openPath: 'a.md', backlinks, outgoing: [], linkMap: {} })
    api.getBacklinks.mockRejectedValue(new Error('db error'))
    await expect(useStore.getState().refreshNoteMeta()).resolves.toBeUndefined()
    expect(useStore.getState().backlinks).toEqual(backlinks)
  })

  it('openNote toasts when readFile rejects', async () => {
    api.readFile.mockRejectedValue(new Error('vanished'))
    await useStore.getState().openNote('a.md')
    expect(useStore.getState().toast).toBe('Could not read a.md')
    expect(useStore.getState().openPath).toBeNull()
  })

  it('openNote toasts when link lookup rejects', async () => {
    api.readFile.mockResolvedValue(makeView('a.md', '# a'))
    api.resolveNoteLinks.mockRejectedValue(new Error('scan failed'))
    await useStore.getState().openNote('a.md')
    expect(useStore.getState().toast).toBe('Could not read a.md')
    expect(useStore.getState().openPath).toBeNull()
  })
})
