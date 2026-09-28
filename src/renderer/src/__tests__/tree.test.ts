import { describe, expect, it } from 'vitest'
import {
  ancestorsOf,
  buildTree,
  filterTree,
  isInternalNoteDrag,
  NOTE_DRAG_TYPE,
  remapCollapsed,
  visibleRows
} from '@/lib/tree'

describe('buildTree', () => {
  it('creates folder nodes from the folders list', () => {
    const root = buildTree([], ['x/y'])
    const x = root.children[0]
    expect(x.name).toBe('x')
    expect(x.isFile).toBe(false)
    expect(x.path).toBe('x')
    expect(x.children[0].path).toBe('x/y')
  })

  it('dedupes folders implied by file paths', () => {
    const root = buildTree(['a/b.md'], ['a'])
    expect(root.children).toHaveLength(1)
    expect(root.children[0].name).toBe('a')
    expect(root.children[0].children.map((child) => child.name)).toEqual(['b.md'])
  })

  it('gives intermediate folders real paths for unique collapse keys', () => {
    const root = buildTree(['deep/nested/file.md'], [])
    const deep = root.children[0]
    expect(deep.path).toBe('deep')
    expect(deep.children[0].path).toBe('deep/nested')
    expect(deep.children[0].children[0].path).toBe('deep/nested/file.md')
  })

  it('sorts folders before files', () => {
    const root = buildTree(['a.md'], ['zeta'])
    expect(root.children[0].isFile).toBe(false)
    expect(root.children[1].isFile).toBe(true)
  })
})

describe('ancestorsOf', () => {
  it('returns the folder chain without the file itself', () => {
    expect(ancestorsOf('projects/deep/Nested.md')).toEqual(['projects', 'projects/deep'])
    expect(ancestorsOf('top.md')).toEqual([])
    expect(ancestorsOf('a/b/c')).toEqual(['a', 'a/b'])
  })
})

describe('visibleRows', () => {
  const root = buildTree(['projects/a.md', 'archive/b.md'], ['projects', 'archive'])

  it('respects the collapsed set', () => {
    const rows = visibleRows(root, new Set(['projects']))
    expect(rows.map((row) => row.name)).toEqual(['archive', 'b.md', 'projects'])
  })

  it('force-expands everything when filtering', () => {
    const rows = visibleRows(root, new Set(['projects', 'archive']), true)
    expect(rows.map((row) => row.name)).toEqual(['archive', 'b.md', 'projects', 'a.md'])
  })

  it('includes folders as rows for keyboard navigation', () => {
    const rows = visibleRows(root, new Set())
    expect(rows.filter((row) => !row.isFile).map((row) => row.name)).toEqual([
      'archive',
      'projects'
    ])
  })
})

describe('remapCollapsed', () => {
  it('moves keys under a renamed folder to the new path', () => {
    const next = remapCollapsed(new Set(['old', 'old/sub', 'other']), 'old', 'fresh')
    expect(next.has('fresh')).toBe(true)
    expect(next.has('fresh/sub')).toBe(true)
    expect(next.has('other')).toBe(true)
    expect(next.has('old')).toBe(false)
  })
})

describe('filterTree', () => {
  it('keeps folders whose own name matches even when empty', () => {
    const root = buildTree(['note.md'], ['inbox'])
    const filtered = filterTree(root, 'inbox')
    expect(filtered.children).toHaveLength(1)
    expect(filtered.children[0].name).toBe('inbox')
  })

  it('drops files that do not match', () => {
    const root = buildTree(['keep.md', 'drop.txt'], [])
    const filtered = filterTree(root, 'keep')
    expect(filtered.children.map((child) => child.name)).toEqual(['keep.md'])
  })
})

describe('isInternalNoteDrag', () => {
  it('detects our custom drag type', () => {
    expect(isInternalNoteDrag([NOTE_DRAG_TYPE])).toBe(true)
    expect(isInternalNoteDrag(['text/plain'])).toBe(false)
    expect(isInternalNoteDrag([])).toBe(false)
  })
})
