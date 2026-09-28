import { describe, expect, it } from 'vitest'
import { relFromRoot } from '@/lib/externalPath'

describe('relFromRoot', () => {
  it('returns the relative path for a file inside the vault', () => {
    expect(relFromRoot('/vault', '/vault/a.md')).toBe('a.md')
    expect(relFromRoot('/vault', '/vault/sub/deep/n.md')).toBe('sub/deep/n.md')
  })

  it('normalizes mixed separators', () => {
    expect(relFromRoot('C:\\Vault', 'C:/Vault/sub/n.md')).toBe('sub/n.md')
    expect(relFromRoot('C:/Vault/', 'C:\\Vault\\n.md')).toBe('n.md')
  })

  it('compares paths case-insensitively but keeps the original case', () => {
    expect(relFromRoot('c:\\vault', 'C:/Vault/Sub/N.MD')).toBe('Sub/N.MD')
  })

  it('returns null outside the vault', () => {
    expect(relFromRoot('/vault', '/other/n.md')).toBeNull()
    expect(relFromRoot('C:\\Vault', 'D:\\Vault\\n.md')).toBeNull()
  })

  it('returns null for sibling folders sharing the prefix', () => {
    expect(relFromRoot('/vault', '/vaultx/n.md')).toBeNull()
  })

  it('returns null for the root itself and empty inputs', () => {
    expect(relFromRoot('/vault', '/vault')).toBeNull()
    expect(relFromRoot('', '/vault/n.md')).toBeNull()
  })
})
