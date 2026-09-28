import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useStore } from '@/store'
import {
  ancestorsOf,
  buildTree,
  filterTree,
  NOTE_DRAG_TYPE,
  visibleRows,
  type TreeNode
} from '@/lib/tree'

interface RowControl {
  collapsed: Set<string>
  forceExpand: boolean
  focusPath: string | null
  selectedPath: string | null
  openPath: string | null
  renamingPath: string | null
  creatingIn: string | null
  select: (path: string) => void
  open: (path: string) => void
  toggle: (key: string) => void
  onContext: (event: React.MouseEvent, node: TreeNode) => void
  commitRename: (path: string, name: string) => void
  cancelRename: () => void
  commitCreate: (parent: string, name: string) => void
  cancelCreate: () => void
}

function IconFolderPlus() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </svg>
  )
}

function IconExpand() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}

function IconCollapse() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 4 5 5 5-5" />
      <path d="m7 15 5-5 5 5" />
    </svg>
  )
}

function IconCrosshair() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M22 12h-4" />
      <path d="M6 12H2" />
      <path d="M12 6V2" />
      <path d="M12 22v-4" />
    </svg>
  )
}

function InlineEdit({
  initial,
  placeholder,
  onCommit,
  onCancel
}: {
  initial: string
  placeholder: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = initial.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [initial])

  return (
    <input
      ref={ref}
      className="tree-inline-input"
      type="text"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={onCancel}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          const next = value.trim()
          if (next) onCommit(next)
          else onCancel()
        } else if (event.key === 'Escape') {
          onCancel()
        }
      }}
    />
  )
}

function TreeRow({
  node,
  depth,
  ctl
}: {
  node: TreeNode
  depth: number
  ctl: RowControl
}) {
  const indent = 10 + depth * 14

  if (node.isFile) {
    const path = node.path ?? node.name
    if (ctl.renamingPath === path) {
      return (
        <InlineEdit
          initial={node.name}
          placeholder="File name"
          onCommit={(name) => ctl.commitRename(path, name)}
          onCancel={ctl.cancelRename}
        />
      )
    }
    const active = path === ctl.openPath
    const selected = path === ctl.selectedPath
    return (
      <button
        type="button"
        className={`tree-file ${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        data-tree-path={path}
        tabIndex={path === ctl.focusPath ? 0 : -1}
        title={path}
        draggable
        onClick={() => ctl.select(path)}
        onDoubleClick={() => ctl.open(path)}
        onContextMenu={(event) => ctl.onContext(event, node)}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', path)
          event.dataTransfer.setData(NOTE_DRAG_TYPE, path)
          event.dataTransfer.effectAllowed = 'copy'
          ctl.select(path)
        }}
      >
        <span className="tree-file-dot" />
        <span className="tree-name">{node.name}</span>
      </button>
    )
  }

  const key = node.path ?? node.name
  if (ctl.renamingPath === key) {
    return (
      <InlineEdit
        initial={node.name}
        placeholder="Folder name"
        onCommit={(name) => ctl.commitRename(key, name)}
        onCancel={ctl.cancelRename}
      />
    )
  }
  const isCollapsed = ctl.collapsed.has(key) && !ctl.forceExpand
  const creating = ctl.creatingIn === key
  const selected = key === ctl.selectedPath
  const hasChildren = node.children.length > 0
  return (
    <div className="tree-folder-block">
      <button
        type="button"
        className={`tree-folder ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        data-tree-path={key}
        tabIndex={key === ctl.focusPath ? 0 : -1}
        title={key}
        onClick={() => {
          ctl.select(key)
          ctl.toggle(key)
        }}
        onContextMenu={(event) => ctl.onContext(event, node)}
      >
        <span className="tree-caret">
          {!hasChildren && !creating ? '' : isCollapsed ? '▸' : '▾'}
        </span>
        <span className="tree-name">{node.name}</span>
      </button>
      {(!isCollapsed || creating) && (
        <div
          className="tree-children"
          style={{ '--gx': `${10 + (depth + 1) * 14 - 6}px` } as CSSProperties}
        >
          {creating && (
            <InlineEdit
              initial=""
              placeholder="Folder name"
              onCommit={(name) => ctl.commitCreate(key, name)}
              onCancel={ctl.cancelCreate}
            />
          )}
          {node.children.map((child) => (
            <TreeRow
              key={child.path ?? `${child.name}-${child.isFile}`}
              node={child}
              depth={depth + 1}
              ctl={ctl}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const tree = useStore((s) => s.tree)
  const folders = useStore((s) => s.folders)
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const openPath = useStore((s) => s.openPath)
  const selectedPath = useStore((s) => s.selectedPath)
  const selectPath = useStore((s) => s.selectPath)
  const openNote = useStore((s) => s.openNote)
  const collapsed = useStore((s) => s.collapsed)
  const toggleFolder = useStore((s) => s.toggleFolder)
  const expandAll = useStore((s) => s.expandAll)
  const collapseAll = useStore((s) => s.collapseAll)
  const revealPath = useStore((s) => s.revealPath)
  const revealTick = useStore((s) => s.revealTick)
  const revealTarget = useStore((s) => s.revealTarget)
  const autoReveal = useStore((s) => s.autoReveal)
  const setAutoReveal = useStore((s) => s.setAutoReveal)
  const createFolderAt = useStore((s) => s.createFolderAt)
  const renameItem = useStore((s) => s.renameItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const recents = useStore((s) => s.recents)
  const root = useStore((s) => s.root)
  const openVaultPath = useStore((s) => s.openVaultPath)
  const openFolder = useStore((s) => s.openFolder)
  const showToast = useStore((s) => s.showToast)

  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode | null } | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const treeRoot = useMemo(
    () => filterTree(buildTree(tree, folders), filter),
    [tree, folders, filter]
  )
  const forceExpand = filter.trim().length > 0
  const focusPath = selectedPath ?? openPath

  useEffect(() => {
    if (!autoReveal || !openPath) return
    revealPath(openPath)
  }, [openPath, autoReveal, revealPath])

  useEffect(() => {
    if (!revealTarget) return
    if (revealTarget === '') {
      treeRef.current?.scrollTo({ top: 0 })
      return
    }
    const el = document.querySelector(`[data-tree-path="${CSS.escape(revealTarget)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [revealTick, revealTarget])

  useEffect(() => {
    if (!selectedPath) return
    const el = document.querySelector(`[data-tree-path="${CSS.escape(selectedPath)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  useEffect(() => {
    if (!root) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`vv-collapsed:${root}`, JSON.stringify([...collapsed]))
      } catch {
        void 0
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [collapsed, root])

  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.ctx-menu')) return
      setMenu(null)
    }
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [menu])

  const commitRename = (path: string, name: string): void => {
    void renameItem(path, name).then((next) => {
      if (next) setRenamingPath(null)
    })
  }

  const commitCreate = (parent: string, name: string): void => {
    void createFolderAt(parent, name).then((path) => {
      if (path) setCreatingIn(null)
    })
  }

  const onContext = (event: React.MouseEvent, node: TreeNode): void => {
    event.preventDefault()
    event.stopPropagation()
    if (!node.path) return
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 150),
      node
    })
  }

  const onTreeContextMenu = (event: React.MouseEvent): void => {
    if (event.defaultPrevented) return
    event.preventDefault()
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 90),
      node: null
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (renamingPath || creatingIn) return
    const rows = visibleRows(treeRoot, collapsed, forceExpand)
    const index = rows.findIndex((row) => (row.path ?? row.name) === focusPath)
    const selectRow = (row: TreeNode | undefined): void => {
      if (row?.path) {
        selectPath(row.path)
        event.preventDefault()
      }
    }
    switch (event.key) {
      case 'ArrowDown':
        selectRow(rows[Math.min(index + 1, rows.length - 1)] ?? rows[0])
        break
      case 'ArrowUp':
        selectRow(rows[Math.max(index - 1, 0)])
        break
      case 'Home':
        selectRow(rows[0])
        break
      case 'End':
        selectRow(rows[rows.length - 1])
        break
      case 'ArrowRight': {
        const row = rows[index]
        if (!row || row.isFile || !row.path) break
        event.preventDefault()
        if (collapsed.has(row.path) && !forceExpand) toggleFolder(row.path)
        else if (row.children.length) selectRow(rows[index + 1])
        break
      }
      case 'ArrowLeft': {
        const row = rows[index]
        if (!row || !row.path) break
        event.preventDefault()
        if (!row.isFile && (collapsed.has(row.path) || forceExpand) && row.children.length === 0) {
          const parents = ancestorsOf(row.path)
          selectPath(parents[parents.length - 1] ?? null)
        } else if (!row.isFile && !forceExpand && !collapsed.has(row.path) && row.children.length) {
          toggleFolder(row.path)
        } else if (row.isFile || collapsed.has(row.path)) {
          const parents = ancestorsOf(row.path)
          if (parents.length) selectPath(parents[parents.length - 1])
        }
        break
      }
      case 'Enter':
      case ' ': {
        const row = rows[index]
        if (!row) break
        event.preventDefault()
        if (row.isFile && row.path) void openNote(row.path)
        else if (row.path) toggleFolder(row.path)
        break
      }
      case 'F2': {
        const target = selectedPath ?? openPath
        if (target) {
          event.preventDefault()
          setRenamingPath(target)
        }
        break
      }
      case 'Delete': {
        const target = selectedPath ?? openPath
        if (target) {
          event.preventDefault()
          void deleteItem(target)
        }
        break
      }
      default:
        break
    }
  }

  const ctl: RowControl = {
    collapsed,
    forceExpand,
    focusPath,
    selectedPath,
    openPath,
    renamingPath,
    creatingIn,
    select: selectPath,
    open: (path) => void openNote(path),
    toggle: toggleFolder,
    onContext,
    commitRename,
    cancelRename: () => setRenamingPath(null),
    commitCreate,
    cancelCreate: () => setCreatingIn(null)
  }

  const menuNode = menu?.node ?? null

  return (
    <aside className="sidebar">
      {!root ? (
        <div className="sidebar-recents">
          <div className="sidebar-heading">Recent vaults</div>
          {recents.length === 0 && (
            <p className="muted small">Vaults you open will appear here.</p>
          )}
          {recents.map((recent) => (
            <button
              key={recent.path}
              type="button"
              className="recent-item"
              onClick={() => void openVaultPath(recent.path)}
              title={recent.path}
            >
              {recent.name}
            </button>
          ))}
          <button type="button" className="primary-btn" onClick={() => void openFolder()}>
            Open a folder
          </button>
        </div>
      ) : (
        <>
          <div className="sidebar-header">
            <div className="sidebar-heading">Files</div>
            <div className="sidebar-tools">
              <button
                type="button"
                className="icon-btn"
                title="New folder"
                onClick={() => setCreatingIn('')}
              >
                <IconFolderPlus />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Expand all"
                onClick={expandAll}
              >
                <IconExpand />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Collapse all"
                onClick={collapseAll}
              >
                <IconCollapse />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Reveal active file"
                disabled={!openPath}
                onClick={() => {
                  if (openPath) revealPath(openPath)
                }}
              >
                <IconCrosshair />
              </button>
              <button
                type="button"
                className={`icon-btn ${autoReveal ? 'on' : ''}`}
                title={autoReveal ? 'Auto-reveal active file: on' : 'Auto-reveal active file: off'}
                onClick={() => setAutoReveal(!autoReveal)}
              >
                <IconCrosshair />
              </button>
            </div>
          </div>
          <input
            className="filter-input"
            type="text"
            placeholder="Filter files…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="tree" ref={treeRef} onKeyDown={onKeyDown} onContextMenu={onTreeContextMenu}>
            {creatingIn === '' && (
              <InlineEdit
                initial=""
                placeholder="Folder name"
                onCommit={(name) => commitCreate('', name)}
                onCancel={() => setCreatingIn(null)}
              />
            )}
            {treeRoot.children.length === 0 && (
              <p className="muted small">No files match.</p>
            )}
            {treeRoot.children.map((child) => (
              <TreeRow
                key={child.path ?? `${child.name}-${child.isFile}`}
                node={child}
                depth={0}
                ctl={ctl}
              />
            ))}
          </div>
          {menu && (
            <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
              {(!menuNode || !menuNode.isFile) && (
                <button
                  type="button"
                  className="ctx-item"
                  onClick={() => {
                    setCreatingIn(menuNode?.path ?? '')
                    setMenu(null)
                  }}
                >
                  New folder
                </button>
              )}
              {menuNode && menuNode.path && (() => {
                const itemPath = menuNode.path
                return (
                  <>
                    <button
                      type="button"
                      className="ctx-item"
                      onClick={() => {
                        setRenamingPath(itemPath)
                        setMenu(null)
                      }}
                    >
                      Rename
                    </button>
                    {menuNode.isFile && (
                      <button
                        type="button"
                        className="ctx-item"
                        onClick={() => {
                          const text = root ? `${root}/${itemPath}` : itemPath
                          void navigator.clipboard.writeText(text).then(
                            () => showToast('Path copied'),
                            () => showToast('Could not copy the path')
                          )
                          setMenu(null)
                        }}
                      >
                        Copy path
                      </button>
                    )}
                    <button
                      type="button"
                      className="ctx-item danger"
                      onClick={() => {
                        void deleteItem(itemPath)
                        setMenu(null)
                      }}
                    >
                      Delete
                    </button>
                  </>
                )
              })()}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
