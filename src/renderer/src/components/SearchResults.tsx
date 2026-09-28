import { useEffect } from 'react'
import { useStore } from '@/store'

export function SearchResults() {
  const hits = useStore((s) => s.hits)
  const searchOpen = useStore((s) => s.searchOpen)
  const tagFilter = useStore((s) => s.tagFilter)
  const root = useStore((s) => s.root)
  const clearSearch = useStore((s) => s.clearSearch)
  const query = useStore((s) => s.query)
  const hitCursor = useStore((s) => s.hitCursor)
  const searchHistory = useStore((s) => s.searchHistory)
  const openSearchHit = useStore((s) => s.openSearchHit)
  const useSearchHistoryItem = useStore((s) => s.useSearchHistoryItem)
  const clearSearchHistory = useStore((s) => s.clearSearchHistory)

  useEffect(() => {
    if (!searchOpen) return
    const el = document.querySelector('.result-item.selected')
    el?.scrollIntoView({ block: 'nearest' })
  }, [hitCursor, searchOpen])

  if (!root || !searchOpen) return null
  const showResults = !!tagFilter || !!query.trim()

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
      {!showResults && searchHistory.length > 0 && (
        <>
          <div className="results-banner">
            <span>Recent searches</span>
            <button type="button" className="linkish" onClick={clearSearchHistory}>
              Clear
            </button>
          </div>
          {searchHistory.map((item) => (
            <button
              key={item}
              type="button"
              className="result-item history-entry"
              onClick={() => useSearchHistoryItem(item)}
            >
              <span className="result-title">{item}</span>
            </button>
          ))}
        </>
      )}
      {!showResults && <div className="results-empty">Type to search the vault…</div>}
      {showResults && hits.length === 0 && (
        <div className="results-empty">No matches{tagFilter ? ` for #${tagFilter}` : ` for “${query}”`}.</div>
      )}
      {hits.map((hit, index) => (
        <button
          key={hit.path}
          type="button"
          className={`result-item ${index === hitCursor ? 'selected' : ''}`}
          onClick={() => void openSearchHit(index, true)}
        >
          <span className="result-title">{hit.title}</span>
          <span className="result-path">{hit.path}</span>
          {hit.snippet && <span className="result-snippet">{hit.snippet}</span>}
        </button>
      ))}
    </div>
  )
}
