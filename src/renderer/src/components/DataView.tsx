import { useMemo, useState } from 'react'
import type { FileView } from '@shared/types'
import { dataKindOf, parseData, type DataOutcome } from '@/lib/dataParse'
import { useStore } from '@/store'

function scalarStyle(value: unknown): { cls: string; text: string } {
  if (value === null || value === undefined) return { cls: 'dv-null', text: String(value) }
  if (value instanceof Date) return { cls: 'dv-string', text: value.toISOString() }
  if (typeof value === 'string') return { cls: 'dv-string', text: JSON.stringify(value) }
  if (typeof value === 'number') return { cls: 'dv-number', text: String(value) }
  if (typeof value === 'boolean') return { cls: 'dv-boolean', text: String(value) }
  return { cls: '', text: String(value) }
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object' && !(value instanceof Date)
}

function entriesOf(value: Record<string, unknown> | unknown[]): [string, unknown][] {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item])
  return Object.entries(value)
}

function TreeNode({ label, value, depth }: { label: string | null; value: unknown; depth: number }) {
  const container = isContainer(value)
  const [open, setOpen] = useState(depth < 2)

  if (!container) {
    const scalar = scalarStyle(value)
    return (
      <div className="dt-row">
        {label !== null && (
          <>
            <span className="dt-key">{label}</span>
            <span className="dt-punct">: </span>
          </>
        )}
        <span className={scalar.cls}>{scalar.text}</span>
      </div>
    )
  }

  const isArray = Array.isArray(value)
  const entries = entriesOf(value)
  const openGlyph = isArray ? '[' : '{'
  const closeGlyph = isArray ? ']' : '}'
  const count = isArray ? value.length : Object.keys(value).length

  return (
    <div className="dt-node">
      <div className="dt-row">
        <button
          type="button"
          className="dt-toggle"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="dt-chevron">{open ? '▾' : '▸'}</span>
          {label !== null && (
            <>
              <span className="dt-key">{label}</span>
              <span className="dt-punct">: </span>
            </>
          )}
          <span className="dt-punct">{openGlyph}</span>
          {!open && (
            <>
              <span className="dt-count">{count}</span>
              <span className="dt-punct">{closeGlyph}</span>
            </>
          )}
        </button>
      </div>
      {open && (
        <div className="dt-children">
          {entries.map(([key, child]) => (
            <TreeNode
              key={key}
              label={isArray ? `[${key}]` : key}
              value={child}
              depth={depth + 1}
            />
          ))}
          <div className="dt-row">
            <span className="dt-punct">{closeGlyph}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DataTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return <p className="data-empty">Empty file</p>
  const header = rows[0]
  const body = rows.slice(1)
  const cols = Math.max(header.length, ...body.map((row) => row.length))
  const columns = Array.from({ length: cols }, (_, index) => index)
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((index) => (
              <th key={index}>{header[index] ?? ''}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((index) => (
                <td key={index}>{row[index] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function metaOf(outcome: DataOutcome): string {
  if (!outcome.ok) return ''
  if (outcome.kind === 'csv') {
    const cols = outcome.rows.reduce((max, row) => Math.max(max, row.length), 0)
    return `${outcome.rows.length} rows × ${cols} cols`
  }
  const value = outcome.value
  if (Array.isArray(value)) return `${value.length} items`
  if (value !== null && typeof value === 'object') return `${Object.keys(value).length} keys`
  if (value === undefined) return 'empty'
  return typeof value
}

export function DataView({ note }: { note: FileView }) {
  const kind = useMemo(() => dataKindOf(note.path), [note.path])
  const outcome = useMemo(() => parseData(note.path, note.raw), [note.path, note.raw])
  const setViewMode = useStore((s) => s.setViewMode)

  if (!kind || !outcome) return <pre className="raw-view">{note.raw}</pre>

  return (
    <div className="data-view">
      <div className="data-toolbar">
        <span className="data-kind-label">{kind === 'csv' ? 'Table' : 'Tree'}</span>
        <span className="data-meta">{outcome.ok ? metaOf(outcome) : ''}</span>
      </div>
      {!outcome.ok && (
        <div className="data-error">
          <p>
            Couldn’t parse {kind.toUpperCase()}: {outcome.error}
          </p>
          <button type="button" className="ghost-btn" onClick={() => void setViewMode('edit')}>
            Edit source
          </button>
        </div>
      )}
      {!outcome.ok ? (
        <pre className="raw-view">{note.raw}</pre>
      ) : outcome.kind === 'csv' ? (
        <DataTable rows={outcome.rows} />
      ) : outcome.value === undefined ? (
        <p className="data-empty">Empty document</p>
      ) : (
        <div className="dtree">
          <TreeNode label={null} value={outcome.value} depth={0} />
        </div>
      )}
    </div>
  )
}
