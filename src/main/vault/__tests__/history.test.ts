import type { Database } from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as queries from '../../db/queries'
import { openDatabase } from '../../db/schema'
import {
  captureChange,
  captureDelete,
  MAX_SNAPSHOT_CHARS,
  MAX_SNAPSHOTS_PER_PATH
} from '../history'

let dir: string
let root: string
let db: Database

const seedNote = (relPath: string, content: string): void => {
  queries.upsertNote(db, relPath, 'title', [], content, Date.now())
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'vv-hist-'))
  root = join(dir, 'vault')
  mkdirSync(root)
  db = openDatabase(join(dir, 'index.db'))
})

afterAll(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM snapshots;')
  queries.wipeAll(db)
})

describe('captureChange', () => {
  it('stores the previous content as a snapshot', () => {
    seedNote('a.md', 'old content')
    writeFileSync(join(root, 'a.md'), 'new content')
    expect(captureChange(root, db, 'a.md')).toBe(true)
    const items = queries.listSnapshots(db, 'a.md')
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('change')
    expect(queries.getSnapshot(db, items[0].id)?.content).toBe('old content')
  })

  it('skips when the file content did not change', () => {
    seedNote('a.md', 'same')
    writeFileSync(join(root, 'a.md'), 'same')
    expect(captureChange(root, db, 'a.md')).toBe(false)
    expect(queries.listSnapshots(db, 'a.md')).toHaveLength(0)
  })

  it('skips paths that were never indexed', () => {
    writeFileSync(join(root, 'b.md'), 'x')
    expect(captureChange(root, db, 'b.md')).toBe(false)
    expect(queries.listSnapshots(db, 'b.md')).toHaveLength(0)
  })

  it('skips unsupported extensions', () => {
    seedNote('c.png', 'x')
    writeFileSync(join(root, 'c.png'), 'y')
    expect(captureChange(root, db, 'c.png')).toBe(false)
  })

  it('skips when the file no longer exists on disk', () => {
    seedNote('gone.md', 'x')
    expect(captureChange(root, db, 'gone.md')).toBe(false)
  })

  it('skips content larger than the size guard', () => {
    seedNote('big.md', 'x'.repeat(MAX_SNAPSHOT_CHARS + 1))
    writeFileSync(join(root, 'big.md'), 'y')
    expect(captureChange(root, db, 'big.md')).toBe(false)
    expect(queries.listSnapshots(db, 'big.md')).toHaveLength(0)
  })

  it('dedupes against the latest snapshot for the path', () => {
    seedNote('a.md', 'one')
    writeFileSync(join(root, 'a.md'), 'two')
    expect(captureChange(root, db, 'a.md')).toBe(true)
    seedNote('a.md', 'two')
    writeFileSync(join(root, 'a.md'), 'one')
    expect(captureChange(root, db, 'a.md')).toBe(true)
    seedNote('a.md', 'two')
    writeFileSync(join(root, 'a.md'), 'three')
    expect(captureChange(root, db, 'a.md')).toBe(false)
    expect(queries.listSnapshots(db, 'a.md')).toHaveLength(2)
  })
})

describe('captureDelete', () => {
  it('stores the indexed content with source delete', () => {
    seedNote('a.md', 'bye')
    expect(captureDelete(db, 'a.md')).toBe(true)
    const items = queries.listSnapshots(db, 'a.md')
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('delete')
    expect(queries.getSnapshot(db, items[0].id)?.content).toBe('bye')
  })

  it('skips paths that were never indexed', () => {
    expect(captureDelete(db, 'missing.md')).toBe(false)
    expect(queries.listSnapshots(db, 'missing.md')).toHaveLength(0)
  })
})

describe('listSnapshots', () => {
  it('returns newest first with metadata', () => {
    queries.insertSnapshot(db, 'a.md', 'older', 'change', 1000)
    queries.insertSnapshot(db, 'a.md', 'newer', 'delete', 2000)
    const items = queries.listSnapshots(db, 'a.md')
    expect(items).toHaveLength(2)
    expect('content' in items[0]).toBe(false)
    expect(items[0].source).toBe('delete')
    expect(items[0].createdAt).toBe(2000)
    expect(items[0].size).toBe(5)
    expect(items[1].source).toBe('change')
    expect(queries.listSnapshots(db, 'other.md')).toHaveLength(0)
  })
})

describe('pruneSnapshots', () => {
  it('keeps only the newest entries per path', () => {
    for (let i = 0; i < MAX_SNAPSHOTS_PER_PATH + 5; i += 1) {
      queries.insertSnapshot(db, 'a.md', `v${i}`, 'change', 1000 + i)
    }
    queries.insertSnapshot(db, 'keep.md', 'untouched', 'change', 1000)
    queries.pruneSnapshots(db, 'a.md', MAX_SNAPSHOTS_PER_PATH)
    const items = queries.listSnapshots(db, 'a.md')
    expect(items).toHaveLength(MAX_SNAPSHOTS_PER_PATH)
    expect(queries.getSnapshot(db, items[0].id)?.content).toBe(`v${MAX_SNAPSHOTS_PER_PATH + 4}`)
    expect(queries.getSnapshot(db, items[items.length - 1].id)?.content).toBe('v5')
    expect(queries.listSnapshots(db, 'keep.md')).toHaveLength(1)
  })
})

describe('wipeAll', () => {
  it('preserves snapshots while clearing notes', () => {
    seedNote('a.md', 'old')
    writeFileSync(join(root, 'a.md'), 'new')
    expect(captureChange(root, db, 'a.md')).toBe(true)
    queries.wipeAll(db)
    expect(queries.getNoteContent(db, 'a.md')).toBeNull()
    expect(queries.listSnapshots(db, 'a.md')).toHaveLength(1)
  })
})
