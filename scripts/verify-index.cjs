const { app } = require('electron')
const { createHash } = require('crypto')
const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const vaultPath = process.argv[2]
if (!vaultPath) {
  console.log(JSON.stringify({ error: 'usage: electron scripts/verify-index.cjs <vault-path>' }))
  app.exit(1)
} else {
  const root = path.resolve(vaultPath)
  const hash = createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 16)
  const candidates = [
    path.join(app.getPath('userData'), 'indexes', `${hash}.db`),
    path.join(process.env.APPDATA || '', 'vault-viewer', 'indexes', `${hash}.db`)
  ]
  const dbPath = candidates.find((candidate) => fs.existsSync(candidate)) || candidates[1]

  app.whenReady().then(() => {
    try {
      if (!fs.existsSync(dbPath)) {
        console.log(JSON.stringify({ error: 'db missing', dbPath }, null, 2))
        app.exit(1)
        return
      }
      const db = new Database(dbPath, { readonly: true })
      const notes = db.prepare('SELECT COUNT(*) AS c FROM notes').get().c
      const links = db.prepare('SELECT COUNT(*) AS c FROM links').get().c
      const resolved = db.prepare('SELECT COUNT(*) AS c FROM links WHERE to_note_id IS NOT NULL').get()
        .c
      const fts = db.prepare('SELECT COUNT(*) AS c FROM notes_fts').get().c
      const backlinksFor = (relPath) => {
        const note = db.prepare('SELECT id FROM notes WHERE rel_path = ?').get(relPath)
        if (!note) return []
        return db
          .prepare(
            `SELECT src.rel_path AS p FROM links l
             JOIN notes src ON src.id = l.from_note_id
             WHERE l.to_note_id = ? ORDER BY p`
          )
          .all(note.id)
          .map((row) => row.p)
      }
      const backlinks = backlinksFor('Welcome.md')
      const noteBacklinks = backlinksFor('projects/Note.md')
      const searchHits = db
        .prepare(
          `SELECT n.rel_path AS p FROM notes_fts
           JOIN notes n ON n.id = notes_fts.rowid
           WHERE notes_fts MATCH '"scratch"'
           ORDER BY bm25(notes_fts, 10.0, 1.0)`
        )
        .all()
        .map((row) => row.p)
      const tagHits = db
        .prepare(
          `SELECT rel_path FROM notes
           WHERE EXISTS (
             SELECT 1 FROM json_each(notes.tags)
             WHERE LOWER(json_each.value) = LOWER('guide')
           )`
        )
        .all()
        .map((row) => row.rel_path)
      const outgoingWelcome = db
        .prepare(
          `SELECT target_text AS t, to_note_id IS NOT NULL AS ok
           FROM links WHERE from_note_id = (
             SELECT id FROM notes WHERE rel_path = 'Welcome.md'
           ) ORDER BY target_text`
        )
        .all()
      db.close()
      console.log(
        JSON.stringify(
          {
            dbPath,
            notes,
            links,
            resolved,
            fts,
            backlinks,
            noteBacklinks,
            searchHits,
            tagHits,
            outgoingWelcome
          },
          null,
          2
        )
      )
      app.exit(0)
    } catch (error) {
      console.log(JSON.stringify({ error: String(error) }, null, 2))
      app.exit(1)
    }
  })
}
