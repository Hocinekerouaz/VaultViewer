import { describe, expect, it } from 'vitest'
import { insideRoot } from '../fsutil'

describe('insideRoot', () => {
  it('resolves children against a windows backslash root', () => {
    const root = 'C:\\vault'
    expect(insideRoot(root, 'a.md')).toBe('C:\\vault\\a.md')
    expect(insideRoot(root, 'deep/a.md')).toBe('C:\\vault\\deep\\a.md')
  })

  it('resolves children against a forward-slash root', () => {
    const root = 'C:/vault'
    expect(insideRoot(root, 'a.md')).toBe('C:\\vault\\a.md')
    expect(insideRoot(root, 'deep/a.md')).toBe('C:\\vault\\deep\\a.md')
  })

  it('rejects traversal that escapes the root', () => {
    expect(insideRoot('C:/vault', '../evil.md')).toBeNull()
    expect(insideRoot('C:\\vault', '..\\evil.md')).toBeNull()
    expect(insideRoot('C:/vault', 'deep/../../evil.md')).toBeNull()
  })

  it('allows the root itself and nested traversal that stays inside', () => {
    expect(insideRoot('C:/vault', '.')).toBe('C:\\vault')
    expect(insideRoot('C:/vault', 'a/../b.md')).toBe('C:\\vault\\b.md')
  })

  it('does not treat a sibling with a shared prefix as inside', () => {
    expect(insideRoot('C:/vault', '../vault2/a.md')).toBeNull()
  })
})
