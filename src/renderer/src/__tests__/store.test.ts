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
  getBacklinks: vi.fn(),
  getOutgoing: vi.fn(),
  resolveNoteLinks: vi.fn(),
  getTree: vi.fn(),
  recentVaults: vi.fn(),
  search: vi.fn(),
  searchTag: vi.fn(),
  onIndexProgress: vi.fn(),
  onVaultChanged: vi.fn(),
  onVaultOpened: vi.fn(),
  getVaultState: vi.fn()
}

;(globalThis as unknown as { window: unknown }).window = { api }

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
  api.getBacklinks.mockResolvedValue([])
  api.getOutgoing.mockResolvedValue([])
  api.resolveNoteLinks.mockResolvedValue({})
  api.getTree.mockResolvedValue({ tree: ['a.md', 'b.md'], folders: [] })
  api.recentVaults.mockResolvedValue([])
  useStore.setState({
    root: '/vault',
    tree: ['a.md', 'b.md'],
    folders: [],
    openPath: null,
    selectedPath: null,
    note: null,
    linkMap: {},
    backlinks: [],
    outgoing: [],
    query: '',
    hits: [],
    searchOpen: false,
    tagFilter: null,
    toast: null,
    pendingWiki: null,
    pendingFind: null,
    viewMode: 'read',
    draft: null,
    conflict: null,
    pendingSwitch: null
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
