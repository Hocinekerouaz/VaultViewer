import { describe, expect, it } from 'vitest'
import type { FileView } from '@shared/types'
import { draftView, stripFrontmatter } from '@/lib/draftPreview'

const mdView = (raw: string): FileView => ({
  kind: 'markdown',
  path: 'a.md',
  title: 'a',
  tags: [],
  frontmatter: {},
  body: raw,
  raw
})

describe('stripFrontmatter', () => {
  it('removes a closed frontmatter block', () => {
    const out = stripFrontmatter('---\ntitle: X\n---\n\n# Hi\n')
    expect(out).toBe('\n# Hi\n')
  })

  it('keeps content when there is no opening fence', () => {
    expect(stripFrontmatter('# Hi\n')).toBe('# Hi\n')
  })

  it('keeps content when the fence never closes', () => {
    const raw = '---\ntitle: X\nstill going\n'
    expect(stripFrontmatter(raw)).toBe(raw)
  })

  it('handles CRLF line endings', () => {
    const out = stripFrontmatter('---\r\ntitle: X\r\n---\r\nbody\r\n')
    expect(out).toBe('body\r\n')
  })

  it('does not strip a fence that is not at the very start', () => {
    const raw = 'intro\n---\ntitle: X\n---\nbody\n'
    expect(stripFrontmatter(raw)).toBe(raw)
  })
})

describe('draftView', () => {
  it('renders markdown from the draft with frontmatter stripped', () => {
    const view = draftView(mdView('# saved'), '---\ntitle: X\n---\n# live\n')
    expect(view.kind).toBe('markdown')
    expect(view.raw).toBe('---\ntitle: X\n---\n# live\n')
    expect(view.body).toBe('# live\n')
  })

  it('passes text files through untouched', () => {
    const view: FileView = {
      kind: 'text',
      path: 'a.txt',
      title: 'a',
      tags: [],
      frontmatter: {},
      body: 'old',
      raw: 'old'
    }
    const next = draftView(view, 'new text')
    expect(next.raw).toBe('new text')
    expect(next.body).toBe('new text')
    expect(next.kind).toBe('text')
  })
})
