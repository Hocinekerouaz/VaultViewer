import { useStore } from '@/store'
import type { SearchHit } from '@shared/types'

export function SearchResults() {
  const hits = useStore((s) => s.hits)
  const searchOpen = useStore((s) => s.searchOpen)
  const tagFilter = useStore((s) => s.tagFilter)
  const root = useStore((s) => s.root)
  const openNote = useStore((s) => s.openNote)
  const clearSearch = useStore((s) => s.clearSearch)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const query = useStore((s) => s.query)

  if (!root || !searchOpen) return null
  const showResults = !!tagFilter || !!query.trim()

  const openHit = (hit: SearchHit): void => {
    const term = tagFilter ?? query.trim().split(/\s+/)[0] ?? null
    setSearchOpen(false)
    void openNote(hit.path, term)
  }

  return (
    <div className="results-dropdown" role="listbox">
      {tagFilter && (
        <div className="results-banner">
          <span>
            Tag <span className="tag-chip static">#{tagFilter}</span>
          </span>
          <button type="button" className="linkish" onClick={clearSearch}>
            Clear
          </button>
        </div>
      )}
      {!showResults && <div className="results-empty">Type to search the vault…</div>}
      {showResults && hits.length === 0 && (
        <div className="results-empty">No matches{tagFilter ? ` for #${tagFilter}` : ` for “${query}”`}.</div>
      )}
      {hits.map((hit) => (
        <button
          key={hit.path}
          type="button"
          className="result-item"
          onClick={() => openHit(hit)}
        >
          <span className="result-title">{hit.title}</span>
          <span className="result-path">{hit.path}</span>
          {hit.snippet && <span className="result-snippet">{hit.snippet}</span>}
        </button>
      ))}
    </div>
  )
}
