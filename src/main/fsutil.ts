import { resolve, sep } from 'node:path'

export function insideRoot(root: string, relPath: string): string | null {
  const abs = resolve(root, relPath)
  const prefix = root.endsWith(sep) ? root : root + sep
  if (abs !== root && !abs.startsWith(prefix)) return null
  return abs
}
