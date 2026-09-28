import type { SearchHit } from '@shared/types'

export type SearchScope = 'vault' | 'folder' | 'note'

const SCOPES: SearchScope[] = ['vault', 'folder', 'note']

export function cycleScopeValue(scope: SearchScope, delta: number): SearchScope {
  const index = SCOPES.indexOf(scope)
  const count = SCOPES.length
  return SCOPES[(((index + delta) % count) + count) % count]
}

export function scopeLabel(scope: SearchScope): string {
  if (scope === 'folder') return 'Folder'
  if (scope === 'note') return 'Note'
  return 'Vault'
}

export function applyScope(
  hits: SearchHit[],
  scope: SearchScope,
  openPath: string | null
): SearchHit[] {
  if (scope === 'vault' || !openPath) return hits
  if (scope === 'note') return hits.filter((hit) => hit.path === openPath)
  const slash = openPath.lastIndexOf('/')
  const folder = slash >= 0 ? openPath.slice(0, slash) : ''
  if (!folder) return hits.filter((hit) => !hit.path.includes('/'))
  return hits.filter((hit) => hit.path.startsWith(`${folder}/`))
}

export function pushSearchHistory(history: string[], query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return history
  if (history[0] === trimmed) return history
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, 10)
}
