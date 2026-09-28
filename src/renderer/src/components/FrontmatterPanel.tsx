import type { FileView } from '@shared/types'

const DATE_KEYS = ['date', 'created', 'updated', 'modified']
const PINNED_KEYS = new Set(['title', 'tags', 'tag', 'aliases', 'date', 'created', 'updated', 'modified'])

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function FrontmatterPanel({
  note,
  onTagClick
}: {
  note: FileView
  onTagClick: (tag: string) => void
}) {
  const entries = Object.entries(note.frontmatter).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  )
  const rest = entries.filter(([key]) => !PINNED_KEYS.has(key.toLowerCase()))
  const dateEntries = entries.filter(([key]) => DATE_KEYS.includes(key.toLowerCase()))
  const hasTitle = entries.some(([key]) => key.toLowerCase() === 'title')

  if (!entries.length && note.tags.length === 0) return null

  return (
    <div className="frontmatter">
      {hasTitle && (
        <div className="fm-title">
          {formatValue(note.frontmatter.title ?? note.frontmatter.Title)}
        </div>
      )}
      {note.tags.length > 0 && (
        <div className="fm-tags">
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="tag-chip"
              onClick={() => onTagClick(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      {dateEntries.length > 0 && (
        <div className="fm-dates">
          {dateEntries.map(([key, value]) => (
            <span key={key} className="fm-date">
              <span className="fm-date-key">{key}</span>
              {formatValue(value)}
            </span>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <dl className="fm-kv">
          {rest.map(([key, value]) => (
            <div key={key} className="fm-kv-row">
              <dt>{key}</dt>
              <dd>{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
