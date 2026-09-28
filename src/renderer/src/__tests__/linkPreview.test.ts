import { describe, expect, it } from 'vitest'
import type { FileView, LinkMap } from '@shared/types'
import {
  clearViewCache,
  getCachedView,
  pickPreviewPosition,
  resolvePreviewTarget,
  setCachedView
} from '@/lib/linkPreview'

const makeView = (path: string): FileView => ({
  kind: 'markdown',
  path,
  title: path,
  tags: [],
  frontmatter: {},
  body: '# body',
  raw: '# body'
})

describe('resolvePreviewTarget', () => {
  const linkMap: LinkMap = {
    Home: { status: 'ok', path: 'Home.md' },
    Lost: { status: 'missing' },
    Twice: { status: 'ambiguous', options: ['a/Note.md', 'b/Note.md'] }
  }

  it('returns the path for resolved links', () => {
    expect(resolvePreviewTarget(linkMap, 'Home', 'other.md')).toBe('Home.md')
  })

  it('returns null for missing links', () => {
    expect(resolvePreviewTarget(linkMap, 'Lost', 'other.md')).toBeNull()
  })

  it('returns null for ambiguous links', () => {
    expect(resolvePreviewTarget(linkMap, 'Twice', 'other.md')).toBeNull()
  })

  it('returns null for unknown targets', () => {
    expect(resolvePreviewTarget(linkMap, 'Nope', 'other.md')).toBeNull()
  })

  it('returns null when the link points at the open note', () => {
    expect(resolvePreviewTarget(linkMap, 'Home', 'Home.md')).toBeNull()
  })
})

describe('pickPreviewPosition', () => {
  const size = { width: 380, height: 320 }
  const viewport = { width: 1200, height: 800 }

  it('places the preview below when there is room', () => {
    const pos = pickPreviewPosition({ top: 100, bottom: 116, left: 200, right: 300 }, size, viewport)
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(124)
    expect(pos.left).toBe(200)
  })

  it('flips above when it does not fit below', () => {
    const pos = pickPreviewPosition({ top: 600, bottom: 616, left: 200, right: 300 }, size, viewport)
    expect(pos.placement).toBe('above')
    expect(pos.top).toBe(600 - 8 - 320)
  })

  it('never renders above the top edge', () => {
    const pos = pickPreviewPosition({ top: 50, bottom: 66, left: 200, right: 300 }, size, {
      width: 1200,
      height: 340
    })
    expect(pos.top).toBeGreaterThanOrEqual(12)
  })

  it('clamps to the left edge', () => {
    const pos = pickPreviewPosition({ top: 100, bottom: 116, left: -50, right: 0 }, size, viewport)
    expect(pos.left).toBe(12)
  })

  it('clamps to the right edge', () => {
    const pos = pickPreviewPosition({ top: 100, bottom: 116, left: 1150, right: 1180 }, size, viewport)
    expect(pos.left).toBe(1200 - 380 - 12)
  })

  it('keeps the preview inside a viewport smaller than it', () => {
    const pos = pickPreviewPosition({ top: 10, bottom: 26, left: 5, right: 60 }, size, {
      width: 300,
      height: 340
    })
    expect(pos.left).toBe(12)
  })
})

describe('view cache', () => {
  it('stores and returns views per path', () => {
    setCachedView('a.md', makeView('a.md'))
    expect(getCachedView('a.md')?.title).toBe('a.md')
    expect(getCachedView('missing.md')).toBeNull()
    clearViewCache()
    expect(getCachedView('a.md')).toBeNull()
  })

  it('overwrites an existing entry without growing', () => {
    setCachedView('a.md', makeView('a.md'))
    setCachedView('a.md', makeView('renamed.md'))
    expect(getCachedView('a.md')?.path).toBe('renamed.md')
    clearViewCache()
  })
})
