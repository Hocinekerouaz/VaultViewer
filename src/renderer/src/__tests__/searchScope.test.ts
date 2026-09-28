import { describe, expect, it } from 'vitest'
import type { SearchHit } from '@shared/types'
import { applyScope, cycleScopeValue, pushSearchHistory, scopeLabel } from '@/lib/searchScope'

const hit = (path: string): SearchHit => ({ path, title: path, snippet: '', score: 1 })

describe('cycleScopeValue', () => {
  it('cycles forward through vault, folder and note', () => {
    expect(cycleScopeValue('vault', 1)).toBe('folder')
    expect(cycleScopeValue('folder', 1)).toBe('note')
    expect(cycleScopeValue('note', 1)).toBe('vault')
  })

  it('cycles backward with wrap-around', () => {
    expect(cycleScopeValue('vault', -1)).toBe('note')
    expect(cycleScopeValue('note', -1)).toBe('folder')
  })

  it('labels each scope', () => {
    expect(scopeLabel('vault')).toBe('Vault')
    expect(scopeLabel('folder')).toBe('Folder')
    expect(scopeLabel('note')).toBe('Note')
  })
})

describe('applyScope', () => {
  const hits = [
    hit('projects/Alpha.md'),
    hit('projects/deep/Nested.md'),
    hit('Welcome.md'),
    hit('archive/Note.md')
  ]

  it('passes everything through for the vault scope', () => {
    expect(applyScope(hits, 'vault', 'projects/Note.md')).toHaveLength(4)
  })

  it('passes everything through without an open note', () => {
    expect(applyScope(hits, 'folder', null)).toHaveLength(4)
    expect(applyScope(hits, 'note', null)).toHaveLength(4)
  })

  it('keeps only the open note for the note scope', () => {
    const out = applyScope(hits, 'note', 'projects/Alpha.md')
    expect(out.map((h) => h.path)).toEqual(['projects/Alpha.md'])
  })

  it('keeps only the current folder for the folder scope', () => {
    const out = applyScope(hits, 'folder', 'projects/Note.md')
    expect(out.map((h) => h.path)).toEqual(['projects/Alpha.md', 'projects/deep/Nested.md'])
  })

  it('keeps root-level files when the open note sits at the root', () => {
    const out = applyScope(hits, 'folder', 'Welcome.md')
    expect(out.map((h) => h.path)).toEqual(['Welcome.md'])
  })
})

describe('pushSearchHistory', () => {
  it('ignores empty or whitespace queries', () => {
    expect(pushSearchHistory(['a'], '   ')).toEqual(['a'])
  })

  it('trims, dedupes to the front and keeps order', () => {
    const out = pushSearchHistory(['b', 'c'], '  a ')
    expect(out).toEqual(['a', 'b', 'c'])
    expect(pushSearchHistory(['a', 'b'], 'b')).toEqual(['b', 'a'])
  })

  it('returns the same array when the query is already first', () => {
    const history = ['a', 'b']
    expect(pushSearchHistory(history, 'a')).toBe(history)
  })

  it('caps the history at ten entries', () => {
    const full = Array.from({ length: 10 }, (_, i) => `q${i}`)
    const out = pushSearchHistory(full, 'new')
    expect(out).toHaveLength(10)
    expect(out[0]).toBe('new')
    expect(out[9]).toBe('q8')
  })
})
