import { useStore } from '@/store'

export function Breadcrumbs() {
  const root = useStore((s) => s.root)
  const openPath = useStore((s) => s.openPath)
  const revealPath = useStore((s) => s.revealPath)

  if (!root || !openPath) return null

  const rootName = root.split(/[\\/]/).filter(Boolean).pop() ?? root
  const parts = openPath.split('/')
  const fileName = parts.pop() ?? ''
  const crumbs: { label: string; path: string }[] = []
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    crumbs.push({ label: part, path: acc })
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <button type="button" className="crumb" title={root} onClick={() => revealPath('')}>
        {rootName}
      </button>
      {crumbs.map((crumb) => (
        <span className="crumb-group" key={crumb.path}>
          <span className="crumb-sep">›</span>
          <button type="button" className="crumb" onClick={() => revealPath(crumb.path)}>
            {crumb.label}
          </button>
        </span>
      ))}
      <span className="crumb-sep">›</span>
      <span className="crumb-current">{fileName}</span>
    </nav>
  )
}
