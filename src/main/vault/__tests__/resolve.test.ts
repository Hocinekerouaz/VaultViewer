import { describe, expect, it } from 'vitest'
import { resolveTarget, type ResolveNote } from '../resolve'

const notes: ResolveNote[] = [
  { id: 1, rel_path: 'Welcome.md' },
  { id: 2, rel_path: 'projects/Note.md' },
  { id: 3, rel_path: 'archive/Note.md' },
  { id: 4, rel_path: 'projects/Alpha.md' },
  { id: 5, rel_path: 'data.json' },
  { id: 6, rel_path: 'projects/deep/Nested.md' }
]

describe('resolveTarget', () => {
  it('resolves relative to the linking note first', () => {
    const result = resolveTarget('projects/Alpha.md', 'Note', notes)
    expect(result).toEqual({ status: 'ok', path: 'projects/Note.md' })
  })

  it('resolves nested relative targets', () => {
    const result = resolveTarget('projects/Alpha.md', 'deep/Nested', notes)
    expect(result).toEqual({ status: 'ok', path: 'projects/deep/Nested.md' })
  })

  it('returns ambiguous options for vault-wide duplicates', () => {
    const result = resolveTarget('Welcome.md', 'Note', notes)
    expect(result.status).toBe('ambiguous')
    if (result.status === 'ambiguous') {
      expect(result.options).toEqual(['archive/Note.md', 'projects/Note.md'])
    }
  })

  it('resolves root-relative paths', () => {
    const result = resolveTarget('Welcome.md', 'projects/Note', notes)
    expect(result).toEqual({ status: 'ok', path: 'projects/Note.md' })
  })

  it('resolves unique basenames vault-wide', () => {
    const result = resolveTarget('Welcome.md', 'Alpha', notes)
    expect(result).toEqual({ status: 'ok', path: 'projects/Alpha.md' })
  })

  it('resolves targets with an explicit extension', () => {
    const relative = resolveTarget('projects/Alpha.md', 'Note.md', notes)
    expect(relative).toEqual({ status: 'ok', path: 'projects/Note.md' })
    const unique = resolveTarget('Welcome.md', 'data.json', notes)
    expect(unique).toEqual({ status: 'ok', path: 'data.json' })
    const ambiguous = resolveTarget('Welcome.md', 'Note.md', notes)
    expect(ambiguous.status).toBe('ambiguous')
  })

  it('resolves non-markdown files by basename', () => {
    const result = resolveTarget('projects/Alpha.md', 'data', notes)
    expect(result).toEqual({ status: 'ok', path: 'data.json' })
  })

  it('is case-insensitive', () => {
    const result = resolveTarget('Welcome.md', 'welcome', notes)
    expect(result).toEqual({ status: 'ok', path: 'Welcome.md' })
  })

  it('returns missing for unknown targets', () => {
    expect(resolveTarget('Welcome.md', 'Missing Note', notes)).toEqual({ status: 'missing' })
    expect(resolveTarget('Welcome.md', '', notes)).toEqual({ status: 'missing' })
  })

  it('prefers same-folder candidate over other duplicates', () => {
    const result = resolveTarget('archive/Note.md', 'Note', notes)
    expect(result).toEqual({ status: 'ok', path: 'archive/Note.md' })
  })
})
