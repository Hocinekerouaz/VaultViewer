import type { Database } from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as queries from '../db/queries'
import { isSupported } from './parser'

export const MAX_SNAPSHOT_CHARS = 1_000_000
export const MAX_SNAPSHOTS_PER_PATH = 50

function storeSnapshot(
  db: Database,
  relPath: string,
  content: string,
  source: 'change' | 'delete'
): boolean {
  if (content.length > MAX_SNAPSHOT_CHARS) return false
  const latest = queries.getLatestSnapshotContent(db, relPath)
  if (latest === content) return false
  queries.insertSnapshot(db, relPath, content, source, Date.now())
  queries.pruneSnapshots(db, relPath, MAX_SNAPSHOTS_PER_PATH)
  return true
}

export function captureChange(root: string, db: Database, relPath: string): boolean {
  if (!isSupported(relPath)) return false
  const oldContent = queries.getNoteContent(db, relPath)
  if (oldContent === null) return false
  let newContent: string
  try {
    newContent = readFileSync(join(root, relPath), 'utf8')
  } catch {
    return false
  }
  if (newContent === oldContent) return false
  return storeSnapshot(db, relPath, oldContent, 'change')
}

export function captureDelete(db: Database, relPath: string): boolean {
  if (!isSupported(relPath)) return false
  const oldContent = queries.getNoteContent(db, relPath)
  if (oldContent === null) return false
  return storeSnapshot(db, relPath, oldContent, 'delete')
}
