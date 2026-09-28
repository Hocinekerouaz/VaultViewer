import type { Database } from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as queries from '../db/queries'
import { openDatabase } from '../db/schema'
import { isSupported, parseFile } from './parser'
import { resolveTarget } from './resolve'

export class VaultIndex {
  readonly root: string
  private db: Database
  private chain: Promise<void> = Promise.resolve()

  constructor(userData: string, root: string) {
    this.root = root
    const hash = createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 16)
    const dir = join(userData, 'indexes')
    mkdirSync(dir, { recursive: true })
    this.db = openDatabase(join(dir, `${hash}.db`))
  }

  getDb(): Database {
    return this.db
  }

  enqueue(task: () => Promise<void> | void): Promise<void> {
    const next = this.chain.then(() => task()).catch((err) => {
      console.error('index task failed:', err)
    })
    this.chain = next
    return next
  }

  fullIndex(paths: string[], onProgress: (indexed: number, total: number) => void): void {
    queries.wipeAll(this.db)
    let indexed = 0
    const total = paths.length
    for (const relPath of paths) {
      this.indexOne(relPath)
      indexed += 1
      if (indexed % 5 === 0 || indexed === total) onProgress(indexed, total)
    }
    this.refreshTargets()
  }

  updateFile(relPath: string): void {
    if (!isSupported(relPath)) {
      queries.deleteNoteByPath(this.db, relPath)
      this.refreshTargets()
      return
    }
    this.indexOne(relPath)
    this.refreshTargets()
  }

  removeFile(relPath: string): void {
    queries.deleteNoteByPath(this.db, relPath)
    this.refreshTargets()
  }

  close(): void {
    this.db.close()
  }

  private indexOne(relPath: string): void {
    const abs = join(this.root, relPath)
    let raw: string
    let mtime: number
    try {
      raw = readFileSync(abs, 'utf8')
      mtime = statSync(abs).mtimeMs
    } catch {
      return
    }
    const parsed = parseFile(relPath, raw)
    const id = queries.upsertNote(
      this.db,
      relPath,
      parsed.title,
      parsed.tags,
      parsed.content,
      mtime
    )
    queries.replaceLinks(this.db, id, parsed.wikilinks)
  }

  private refreshTargets(): void {
    const notes = queries.getNotesForResolve(this.db)
    const idByPath = new Map(notes.map((note) => [note.rel_path, note.id]))
    const byId = new Map(notes.map((note) => [note.id, note]))
    const groups = queries.getEdgeGroups(this.db)
    const tx = this.db.transaction(() => {
      for (const group of groups) {
        const from = byId.get(group.from_note_id)
        const resolved: number[] = []
        if (from) {
          const outcome = resolveTarget(from.rel_path, group.target_text, notes)
          if (outcome.status === 'ok') {
            const id = idByPath.get(outcome.path)
            if (id !== undefined) resolved.push(id)
          } else if (outcome.status === 'ambiguous') {
            for (const option of outcome.options) {
              const id = idByPath.get(option)
              if (id !== undefined) resolved.push(id)
            }
          }
        }
        queries.replaceLinkGroup(this.db, group.from_note_id, group.target_text, resolved)
      }
    })
    tx()
  }
}
