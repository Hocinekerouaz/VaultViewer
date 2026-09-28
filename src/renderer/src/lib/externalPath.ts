export function relFromRoot(root: string, absPath: string): string | null {
  const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '')
  const base = normalize(root).toLowerCase()
  const target = normalize(absPath).toLowerCase()
  if (!base || !target.startsWith(base)) return null
  if (target.length > base.length && target[base.length] !== '/') return null
  const original = normalize(absPath)
  const rel = original.slice(original.length - (target.length - base.length))
  return rel.replace(/^\/+/, '').length ? rel.replace(/^\/+/, '') : null
}
