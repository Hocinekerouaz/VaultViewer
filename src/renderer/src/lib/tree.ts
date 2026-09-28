export const NOTE_DRAG_TYPE = 'application/x-vault-note'

export interface TreeNode {
  name: string
  path: string | null
  isFile: boolean
  children: TreeNode[]
}

export function buildTree(files: string[], folders: string[] = []): TreeNode {
  const root: TreeNode = { name: '', path: null, isFile: false, children: [] }

  const insert = (path: string, isFile: boolean): void => {
    const parts = path.split('/')
    let current = root
    let acc = ''
    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i]
      const last = i === parts.length - 1
      acc = acc ? `${acc}/${name}` : name
      const nodeIsFile = last && isFile
      let child = current.children.find((node) => node.name === name && node.isFile === nodeIsFile)
      if (!child) {
        child = { name, path: acc, isFile: nodeIsFile, children: [] }
        current.children.push(child)
      }
      current = child
    }
  }

  for (const folder of folders) insert(folder, false)
  for (const file of files) insert(file, true)
  sortTree(root)
  return root
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) sortTree(child)
}

export function filterTree(root: TreeNode, filter: string): TreeNode {
  const needle = filter.trim().toLowerCase()
  if (!needle) return root
  const clone = (node: TreeNode): TreeNode | null => {
    if (node.isFile) {
      const keep = node.path?.toLowerCase().includes(needle)
      return keep ? { ...node, children: [] } : null
    }
    const folderMatch = node.name.toLowerCase().includes(needle)
    if (folderMatch) return { ...node, children: node.children.map((child) => ({ ...child })) }
    const children = node.children
      .map((child) => clone(child))
      .filter((child): child is TreeNode => child !== null)
    if (!children.length) return null
    return { ...node, children }
  }
  const result = clone(root)
  return result ?? { name: '', path: null, isFile: false, children: [] }
}

export function ancestorsOf(path: string): string[] {
  const parts = path.split('/')
  parts.pop()
  const out: string[] = []
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    out.push(acc)
  }
  return out
}

export function visibleRows(
  root: TreeNode,
  collapsed: ReadonlySet<string>,
  forceExpand = false
): TreeNode[] {
  const rows: TreeNode[] = []
  const walk = (nodes: TreeNode[]): void => {
    for (const node of nodes) {
      rows.push(node)
      if (node.isFile) continue
      const key = node.path ?? node.name
      if (forceExpand || !collapsed.has(key)) walk(node.children)
    }
  }
  walk(root.children)
  return rows
}

export function remapCollapsed(
  collapsed: ReadonlySet<string>,
  oldPath: string,
  newPath: string
): Set<string> {
  const next = new Set<string>()
  for (const key of collapsed) {
    if (key === oldPath) next.add(newPath)
    else if (key.startsWith(`${oldPath}/`)) next.add(newPath + key.slice(oldPath.length))
    else next.add(key)
  }
  return next
}

export function isInternalNoteDrag(types: readonly string[]): boolean {
  return types.includes(NOTE_DRAG_TYPE)
}
