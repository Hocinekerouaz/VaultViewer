import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFolder, createNote, duplicateNote, isValidName, movePath, renamePath, writeNote } from '../ops'

let dir: string

const exists = async (rel: string): Promise<boolean> => {
  try {
    await stat(join(dir, rel))
    return true
  } catch {
    return false
  }
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vv-ops-'))
  await mkdir(join(dir, 'projects'))
  await writeFile(join(dir, 'note.md'), '# note')
  await writeFile(join(dir, 'other.md'), '# other')
  await mkdir(join(dir, 'projects', 'deep'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('isValidName', () => {
  it('accepts normal names', () => {
    expect(isValidName('inbox')).toBe(true)
    expect(isValidName('My Note.md')).toBe(true)
    expect(isValidName('projects')).toBe(true)
  })

  it('rejects separators, traversal, dots and bad whitespace', () => {
    expect(isValidName('')).toBe(false)
    expect(isValidName('.')).toBe(false)
    expect(isValidName('..')).toBe(false)
    expect(isValidName('.hidden')).toBe(false)
    expect(isValidName('a/b')).toBe(false)
    expect(isValidName('a\\b')).toBe(false)
    expect(isValidName('a:b')).toBe(false)
    expect(isValidName('a?b')).toBe(false)
    expect(isValidName('trail.')).toBe(false)
    expect(isValidName('trail ')).toBe(false)
    expect(isValidName(' lead')).toBe(false)
  })
})

describe('createFolder', () => {
  it('creates a folder at the vault root', async () => {
    const result = await createFolder(dir, '', 'inbox')
    expect(result).toEqual({ ok: true, path: 'inbox' })
    expect(await exists('inbox')).toBe(true)
  })

  it('creates a nested folder', async () => {
    const result = await createFolder(dir, 'inbox', 'sub')
    expect(result.ok).toBe(true)
    expect(await exists('inbox/sub')).toBe(true)
  })

  it('rejects an existing name', async () => {
    const result = await createFolder(dir, '', 'inbox')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already exists/)
  })

  it('rejects invalid names and traversal in the parent', async () => {
    expect((await createFolder(dir, '', 'bad/name')).ok).toBe(false)
    expect((await createFolder(dir, '../evil', 'x')).ok).toBe(false)
  })

  it('rejects a missing parent and a file used as parent', async () => {
    expect((await createFolder(dir, 'ghost', 'x')).ok).toBe(false)
    expect((await createFolder(dir, 'note.md', 'x')).ok).toBe(false)
  })
})

describe('renamePath', () => {
  it('renames a file within its folder', async () => {
    const result = await renamePath(dir, 'other.md', 'renamed.md')
    expect(result).toEqual({ ok: true, path: 'renamed.md' })
    expect(await exists('other.md')).toBe(false)
    expect(await exists('renamed.md')).toBe(true)
  })

  it('renames a folder and keeps its children', async () => {
    const result = await renamePath(dir, 'projects', 'work')
    expect(result).toEqual({ ok: true, path: 'work' })
    expect(await exists('work/deep')).toBe(true)
    const entries = await readdir(join(dir, 'work'))
    expect(entries).toContain('deep')
  })

  it('is a no-op when the name is unchanged', async () => {
    const result = await renamePath(dir, 'work', 'work')
    expect(result).toEqual({ ok: true, path: 'work' })
  })

  it('rejects a name whose target already exists', async () => {
    await writeFile(join(dir, 'taken.md'), 'x')
    const result = await renamePath(dir, 'renamed.md', 'taken.md')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already exists/)
    expect(await exists('renamed.md')).toBe(true)
  })

  it('rejects invalid input, missing source and the vault root', async () => {
    expect((await renamePath(dir, 'renamed.md', 'bad:name')).ok).toBe(false)
    expect((await renamePath(dir, 'ghost.md', 'x.md')).ok).toBe(false)
    expect((await renamePath(dir, '', 'x')).ok).toBe(false)
    expect((await renamePath(dir, '..', 'x')).ok).toBe(false)
  })
})

describe('writeNote', () => {
  it('overwrites an existing file with utf8 content', async () => {
    const result = await writeNote(dir, 'note.md', '# rewritten\ncafé ✓')
    expect(result).toEqual({ ok: true, path: 'note.md' })
    expect(await readFile(join(dir, 'note.md'), 'utf8')).toBe('# rewritten\ncafé ✓')
  })

  it('writes into a subfolder', async () => {
    const result = await writeNote(dir, 'work/deep/x.md', 'deep content')
    expect(result.ok).toBe(true)
    expect(await readFile(join(dir, 'work/deep/x.md'), 'utf8')).toBe('deep content')
  })

  it('recreates a file that no longer exists', async () => {
    await rm(join(dir, 'recreated.md'), { force: true })
    const result = await writeNote(dir, 'recreated.md', 'back')
    expect(result.ok).toBe(true)
    expect(await readFile(join(dir, 'recreated.md'), 'utf8')).toBe('back')
  })

  it('allows empty content', async () => {
    const result = await writeNote(dir, 'recreated.md', '')
    expect(result.ok).toBe(true)
    expect(await readFile(join(dir, 'recreated.md'), 'utf8')).toBe('')
  })

  it('rejects traversal and invalid paths', async () => {
    expect((await writeNote(dir, '../evil.md', 'x')).ok).toBe(false)
    expect((await writeNote(dir, '', 'x')).ok).toBe(false)
    expect((await writeNote(dir, '.', 'x')).ok).toBe(false)
    expect((await writeNote(dir, '..', 'x')).ok).toBe(false)
  })

  it('rejects writing to a folder', async () => {
    const result = await writeNote(dir, 'work', 'x')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/folder/)
  })

  it('fails when the parent folder is missing', async () => {
    const result = await writeNote(dir, 'ghost/file.md', 'x')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no longer exists/)
  })
})

describe('createNote', () => {
  it('creates a note at the vault root with a heading', async () => {
    const result = await createNote(dir, '', 'Fresh')
    expect(result).toEqual({ ok: true, path: 'Fresh.md' })
    expect(await readFile(join(dir, 'Fresh.md'), 'utf8')).toBe('# Fresh\n')
  })

  it('creates a note inside a folder and strips a trailing .md', async () => {
    const result = await createNote(dir, 'work', 'Plan.md')
    expect(result).toEqual({ ok: true, path: 'work/Plan.md' })
    expect(await exists('work/Plan.md')).toBe(true)
  })

  it('rejects duplicates and invalid names', async () => {
    expect((await createNote(dir, '', 'Fresh')).ok).toBe(false)
    expect((await createNote(dir, '', 'bad/name')).ok).toBe(false)
    expect((await createNote(dir, '', '.hidden')).ok).toBe(false)
  })

  it('fails when the parent is missing or is a file', async () => {
    expect((await createNote(dir, 'ghost', 'x')).ok).toBe(false)
    expect((await createNote(dir, 'note.md', 'x')).ok).toBe(false)
  })
})

describe('duplicateNote', () => {
  it('copies a file next to itself with a copy suffix', async () => {
    const result = await duplicateNote(dir, 'Fresh.md')
    expect(result).toEqual({ ok: true, path: 'Fresh copy.md' })
    expect(await readFile(join(dir, 'Fresh copy.md'), 'utf8')).toBe('# Fresh\n')
    expect(await exists('Fresh.md')).toBe(true)
  })

  it('numbers further copies', async () => {
    const result = await duplicateNote(dir, 'Fresh.md')
    expect(result).toEqual({ ok: true, path: 'Fresh copy 2.md' })
  })

  it('duplicates inside a folder', async () => {
    const result = await duplicateNote(dir, 'work/Plan.md')
    expect(result).toEqual({ ok: true, path: 'work/Plan copy.md' })
  })

  it('rejects missing sources, folders and invalid paths', async () => {
    expect((await duplicateNote(dir, 'ghost.md')).ok).toBe(false)
    expect((await duplicateNote(dir, 'projects')).ok).toBe(false)
    expect((await duplicateNote(dir, '')).ok).toBe(false)
  })
})

describe('movePath', () => {
  it('moves a file into a folder and back to the root', async () => {
    expect(await movePath(dir, 'Fresh.md', 'inbox')).toEqual({ ok: true, path: 'inbox/Fresh.md' })
    expect(await exists('inbox/Fresh.md')).toBe(true)
    expect(await exists('Fresh.md')).toBe(false)
    expect(await movePath(dir, 'inbox/Fresh.md', '')).toEqual({ ok: true, path: 'Fresh.md' })
    expect(await exists('Fresh.md')).toBe(true)
  })

  it('is a no-op when the destination is the current folder', async () => {
    const result = await movePath(dir, 'Fresh.md', '')
    expect(result).toEqual({ ok: true, path: 'Fresh.md' })
  })

  it('rejects a destination whose name already exists', async () => {
    await writeFile(join(dir, 'inbox', 'dupe.md'), 'a')
    await writeFile(join(dir, 'dupe.md'), 'b')
    const result = await movePath(dir, 'dupe.md', 'inbox')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already exists/)
    expect(await exists('dupe.md')).toBe(true)
  })

  it('rejects missing sources and folders, and folders moving into themselves', async () => {
    await mkdir(join(dir, 'inbox', 'sub'), { recursive: true })
    expect((await movePath(dir, 'ghost.md', '')).ok).toBe(false)
    expect((await movePath(dir, 'inbox', 'ghost')).ok).toBe(false)
    expect((await movePath(dir, 'inbox', 'inbox')).ok).toBe(false)
    expect((await movePath(dir, 'inbox', 'inbox/sub')).ok).toBe(false)
    expect((await movePath(dir, '', 'inbox')).ok).toBe(false)
  })
})
