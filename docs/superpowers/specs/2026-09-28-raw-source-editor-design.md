# Raw Source Editor — Design

**Date:** 2026-09-28
**Status:** Approved

## Summary

Add a second pane mode, `Edit`, that shows the open file's raw source in a
CodeMirror 6 editor where the user can modify and save it. `Read` keeps
today's behavior (rendered markdown, structured data views).

## Requirements (approved)

- **Scope:** all six supported formats (`.md .json .yaml .yml .csv .txt`).
- **Save model:** explicit only — Save button + Ctrl+S, dirty indicator, Revert
  with inline confirm. No auto-save.
- **Switch while dirty:** `Save / Discard / Cancel` modal before opening
  another file or leaving Edit mode.
- **Disk conflict:** banner `Changed on disk — Reload from disk / Keep
  editing`; save is last-writer. File deleted on disk while dirty → banner
  with `Save (recreates file) / Close`.
- **Editor:** CodeMirror 6, themed from existing CSS tokens (light + dark),
  word-wrap on, Tab inserts two spaces, bracket matching, active line.
- **Data views:** DataView's read-only `Raw` segment is removed; parse errors
  show a banner with an `Edit source` button that switches to Edit mode.

## Architecture

### Main process (write path)

- `writeNote(root, relPath, content)` in `vault/ops.ts` — validates with
  `insideRoot`, rejects directories and vault root, utf-8 write. Pure enough
  for vitest like the existing `ops.test.ts`.
- `file:write` IPC handler in `ipc.ts` returns `{ ok, error?, view? }` where
  `view` is a fresh `FileView` from the existing `readFileView` (parse and
  metadata in one round trip).
- Preload exposes `writeFile(relPath, content): Promise<SaveResult>`.
- `SaveResult` added to `shared/types.ts`.

### Store state machine

- New state: `viewMode: 'read' | 'edit'`, `draft: string | null`,
  `conflict: null | 'changed' | 'deleted'`, `pendingSwitch` for the modal.
- `dirty = draft !== null && draft !== note.raw`.
- Entering Edit seeds `draft = note.raw`. `updateDraft` keeps the draft;
  `saveDraft` writes and applies the returned view optimistically;
  `revertDraft` clears the draft.
- `openNote` and mode-exit are intercepted when dirty: they set
  `pendingSwitch` instead of acting; the modal resolves it with
  Save / Discard / Cancel.
- `handleChanged` (watcher) never replaces `note.raw` with disk content while
  dirty; it compares disk vs draft and raises `conflict`. If the file was
  removed it keeps the editor open and sets `conflict = 'deleted'`.

### UI

- Pane toolbar above the content (all formats): `Read | Edit` segmented
  control on the left; meta, dirty dot, Save, Revert on the right; conflict
  banner under it.
- `EditorPane.tsx` mounts CodeMirror with a token-based theme, Ctrl+S
  handler, wrap and tab configuration.
- `Overlays.tsx` gains the Save/Discard/Cancel modal, following the
  AmbiguityPicker pattern.
- All new styles reuse existing palette tokens.

## Error handling

- Write failure → existing toast, draft stays dirty.
- Deleted file → conflict `deleted` with Save (recreates) / Close.
- Read failure after save → toast, stay in Edit with draft intact.

## Testing

- Unit: `writeNote` validation matrix (path escape, directories, missing
  vault, success), store dirty/conflict/modal transitions.
- Gates: typecheck, vitest, build.
- Manual CDP walkthrough: save flow, watcher echo stays clean, external
  change conflict, switch modal, all six formats, step-7 regression.

## Out of scope

Auto-save, side-by-side preview, find-in-file, draft persistence across
restarts, files over ~10 MB, binary formats.
