import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'

export function openDatabase(dbPath: string): DatabaseType {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const existingLinks = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'links'")
    .get() as { sql: string } | undefined
  if (existingLinks && !existingLinks.sql.includes('UNIQUE(from_note_id, target_text, to_note_id)')) {
    db.exec('DROP TABLE links')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE,
      rel_path TEXT NOT NULL,
      title TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS links (
      from_note_id INTEGER NOT NULL,
      target_text TEXT NOT NULL,
      to_note_id INTEGER,
      UNIQUE(from_note_id, target_text, to_note_id),
      FOREIGN KEY(from_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY(to_note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_note_id);
    CREATE INDEX IF NOT EXISTS idx_notes_rel ON notes(rel_path);

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content,
      content='notes',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END;
  `)
  return db
}
