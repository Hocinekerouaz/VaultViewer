# Reading Progress — Design

**Date:** 2026-09-29
**Status:** Approved

## Summary

Remember where you were in a note and silently resume there. On reopening a
note, the app restores the saved scroll position of the reading view; in
Edit mode it restores the split preview and the source editor independently.
No visible UI — no bars, dots, toasts or badges.

## Requirements (approved)

- **Silent restore:** reopening a note jumps straight to the saved position
  with no cue or notification.
- **All three panes track their own position:** read view (`.reading-pane`),
  split preview (`.editor-preview`), source editor (`.cm-scroller`). Each
  pane keeps an independent fraction per note.
- **Override:** `openNote(path, term)` calls that carry a search term skip
  the restore — the existing `window.find` jump wins.
- **No visible progress UI** of any kind (progress bar, tree dots, resume
  chip are all out).
- **Vault files are never written** for this feature (progress lives in the
  app's index.db only).

## Architecture

### Main process

- `reading_progress` table in `db/schema.ts`, same style as `snapshots`
  (plain `rel_path`, no FK — rows survive note deletion on purpose, so a
  returning file gets its position back):

  ```sql
  CREATE TABLE IF NOT EXISTS reading_progress (
    rel_path TEXT NOT NULL,
    pane TEXT NOT NULL,          -- 'read' | 'preview' | 'source'
    fraction REAL NOT NULL,      -- scrollTop / (scrollHeight - clientHeight)
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (rel_path, pane)
  );
  ```

- `queries.ts`: `getReadingProgress(db)` returns all rows for the vault;
  `setReadingProgress(db, relPath, pane, fraction)` upserts. Main validates
  the pane whitelist, rejects non-finite fractions and clamps to `[0, 1]` —
  garbage never reaches the DB.
- `ipc.ts`: `progress:get` (returns rows, `handleSafe` fallback `[]`) and
  `progress:set` (fire-and-forget, `handleSafe`).
- `preload/index.ts`: `progressGet()`, `progressSet(relPath, pane, fraction)`.

### Store

- New state `progress: Record<string, Partial<Record<'read' | 'preview' |
  'source', number>>>` — the full map fetched once at vault open (alongside
  `getVaultState`), cleared on vault switch.
- Saves are debounced in the renderer (~500 ms trailing per pane); IPC is
  only hit when a flush happens. Switching notes flushes pending saves first.

### Scroll wiring (MarkdownPane)

- **Save:** scroll listeners (passive) on the three surfaces, attached and
  detached with the existing `viewMode`/`openPath` effect. Each computes the
  house-standard fraction `scrollTop / (scrollHeight - clientHeight)` —
  the same formula the split scroll-sync already uses.
- **Restore (read):** after the note paints (rAF), apply the saved fraction
  to `.reading-pane`. Skipped when `openNote` was called with a `term`.
- **Restore (edit):** on entering `viewMode === 'edit'`, apply the saved
  fractions to `.editor-preview` and `.cm-scroller` independently.
- No saved row / fraction `0` / invalid value → no-op (pane stays at top).

### Edge cases

- Fraction-based storage is resize-tolerant: the fraction is re-applied
  against the current scroll height, never stored pixels.
- Images loading after restore shift content heights; slight drift is
  accepted — re-scrolling would fight the user.
- One position per note per pane (the latest wins); no position history.

## Error handling

- `progress:get` failure → `handleSafe` returns `[]`, feature is silently
  off for the session (no toast).
- `progress:set` failure → swallowed by `handleSafe`; next scroll retries.
- Malformed DB values (NULL, NaN, out of range) → clamped/ignored on read,
  never crash the restore path.

## Testing

- **Unit (queries):** temp-DB round trip — upsert/read for each pane,
  re-upsert overwrites, invalid pane rejected, clamping applied
  (pattern: `history.test.ts`).
- **Unit (store):** progress map loads at vault open, `openNote(path, term)`
  suppresses restore, debounce coalesces scroll bursts into one IPC call,
  vault switch clears state (pattern: stubbed `window.api` store tests).
- **CDP smoke:** scroll read view ~50%, switch notes, return → restored;
  scroll preview + source separately, toggle modes → independent restore;
  search-hit open lands on the match, not the saved position; zero console
  errors.
- **Gates:** typecheck / test / build clean.

## Out of scope

Visible progress UI (bars, dots, resume chips), cross-machine sync,
position history, manual bookmarks, re-mapping positions after content
edits (e.g. via heading anchors), cross-pane position mapping (each pane
keeps its own fraction), restore inside History previews or hover popovers.
