import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFolder, isValidName, renamePath } from '../ops'

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
