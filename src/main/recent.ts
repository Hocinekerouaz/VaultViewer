import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { RecentVault } from '../shared/types'

function fileFor(userData: string): string {
  return join(userData, 'recent-vaults.json')
}

export function loadRecent(userData: string): RecentVault[] {
  if (!userData) return []
  try {
    const raw = readFileSync(fileFor(userData), 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentVault =>
        !!item && typeof item.path === 'string' && typeof item.name === 'string'
    )
  } catch {
    return []
  }
}

export function addRecent(userData: string, path: string): RecentVault[] {
  if (!userData) return []
  const existing = loadRecent(userData).filter(
    (item) => item.path.toLowerCase() !== path.toLowerCase()
  )
  const next = [{ path, name: basename(path), lastOpened: Date.now() }, ...existing].slice(0, 8)
  try {
    writeFileSync(fileFor(userData), JSON.stringify(next, null, 2))
  } catch {
    return next
  }
  return next
}
