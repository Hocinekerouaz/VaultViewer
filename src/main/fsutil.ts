import { resolve, sep } from 'node:path'

export function insideRoot(root: string, relPath: string): string | null {
  const base = resolve(root)
  const abs = resolve(base, relPath)
  const prefix = base.endsWith(sep) ? base : base + sep
  if (abs !== base && !abs.startsWith(prefix)) return null
  return abs
}
