import type { Database } from 'better-sqlite3'
import type { BacklinkItem, OutgoingItem, SearchHit } from '../../shared/types'
import type { ResolveNote } from '../vault/resolve'

export interface EdgeRow {
  from_note_id: number
  target_text: string
}

function ftsQuery(input: string): string | null {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12)
  if (!tokens.length) return null
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' ')
}

export function wipeAll(db: Database): void {
  db.exec('DELETE FROM links; DELETE FROM notes;')
}

export function upsertNote(
  db: Database,
  relPath: string,
  title: string,
  tags: string[],
  content: string,
  updatedAt: number
): number {
  const row = db
    .prepare(
      `INSERT INTO notes (path, rel_path, title, tags, content, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         rel_path = excluded.rel_path,
         title = excluded.title,
         tags = excluded.tags,
         content = excluded.content,
         updated_at = excluded.updated_at
       RETURNING id`
    )
    .get(relPath, relPath, title, JSON.stringify(tags), content, updatedAt) as { id: number }
  return row.id
}

export function deleteNoteByPath(db: Database, relPath: string): void {
  db.prepare('DELETE FROM notes WHERE rel_path = ?').run(relPath)
}

export function replaceLinks(db: Database, fromNoteId: number, targets: string[]): void {
  const del = db.prepare('DELETE FROM links WHERE from_note_id = ?')
  const ins = db.prepare(
    'INSERT OR REPLACE INTO links (from_note_id, target_text, to_note_id) VALUES (?, ?, NULL)'
  )
  const tx = db.transaction(() => {
    del.run(fromNoteId)
    for (const target of targets) ins.run(fromNoteId, target)
  })
  tx()
}

export interface EdgeGroup {
  from_note_id: number
  target_text: string
}

export function getEdgeGroups(db: Database): EdgeGroup[] {
  return db
    .prepare('SELECT DISTINCT from_note_id, target_text FROM links')
    .all() as EdgeGroup[]
}

export function replaceLinkGroup(
  db: Database,
  fromNoteId: number,
  targetText: string,
  toNoteIds: number[]
): void {
  db.prepare('DELETE FROM links WHERE from_note_id = ? AND target_text = ?').run(
    fromNoteId,
    targetText
  )
  const ins = db.prepare('INSERT INTO links (from_note_id, target_text, to_note_id) VALUES (?, ?, ?)')
  if (!toNoteIds.length) {
    ins.run(fromNoteId, targetText, null)
    return
  }
  for (const toId of toNoteIds) ins.run(fromNoteId, targetText, toId)
}

export function getNotesForResolve(db: Database): ResolveNote[] {
  return db.prepare('SELECT id, rel_path FROM notes').all() as ResolveNote[]
}

export function getEdges(db: Database): EdgeRow[] {
  return db.prepare('SELECT from_note_id, target_text FROM links').all() as EdgeRow[]
}

export function searchNotes(db: Database, input: string): SearchHit[] {
  const match = ftsQuery(input)
  if (!match) return []
  try {
    return db
      .prepare(
        `SELECT n.rel_path AS path, n.title AS title,
                REPLACE(SUBSTR(snippet(notes_fts, 1, '', '', '…', 16), 1, 200), CHAR(10), ' ') AS snippet,
                bm25(notes_fts, 10.0, 1.0) AS score
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.rowid
         WHERE notes_fts MATCH ?
         ORDER BY score
         LIMIT 100`
      )
      .all(match) as SearchHit[]
  } catch {
    return []
  }
}

export function searchByTag(db: Database, tag: string): SearchHit[] {
  const clean = tag.replace(/^#/, '').trim()
  if (!clean) return []
  return db
    .prepare(
      `SELECT n.rel_path AS path, n.title AS title,
              REPLACE(SUBSTR(n.content, 1, 200), CHAR(10), ' ') AS snippet,
              0.0 AS score
       FROM notes n
       WHERE EXISTS (
         SELECT 1 FROM json_each(n.tags)
         WHERE LOWER(json_each.value) = LOWER(?)
       )
       ORDER BY n.rel_path
       LIMIT 100`
    )
    .all(clean) as SearchHit[]
}

export function getNoteIdByPath(db: Database, relPath: string): number | null {
  const row = db.prepare('SELECT id FROM notes WHERE rel_path = ?').get(relPath) as
    | { id: number }
    | undefined
  return row ? row.id : null
}

export function getBacklinks(db: Database, noteId: number): BacklinkItem[] {
  return db
    .prepare(
      `SELECT src.rel_path AS path, src.title AS title, l.target_text AS target
       FROM links l
       JOIN notes src ON src.id = l.from_note_id
       WHERE l.to_note_id = ? AND src.id <> ?
       ORDER BY src.rel_path`
    )
    .all(noteId, noteId) as BacklinkItem[]
}

export function getOutgoing(db: Database, noteId: number): OutgoingItem[] {
  const rows = db
    .prepare(
      `SELECT l.target_text AS target, n.rel_path AS path, n.title AS title
       FROM links l
       LEFT JOIN notes n ON n.id = l.to_note_id
       WHERE l.from_note_id = ?`
    )
    .all(noteId) as OutgoingItem[]
  const byTarget = new Map<string, OutgoingItem>()
  for (const row of rows) {
    const existing = byTarget.get(row.target)
    if (!existing) byTarget.set(row.target, row)
    else if (!existing.path && row.path) byTarget.set(row.target, row)
  }
  return [...byTarget.values()].sort((a, b) => a.target.localeCompare(b.target))
}
