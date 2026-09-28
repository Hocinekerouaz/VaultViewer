import { useEffect, useRef } from 'react'
import { SearchResults } from './SearchResults'
import { useStore } from '@/store'

export function TopBar() {
  const root = useStore((s) => s.root)
  const query = useStore((s) => s.query)
  const tagFilter = useStore((s) => s.tagFilter)
  const progress = useStore((s) => s.progress)
  const tree = useStore((s) => s.tree)
  const theme = useStore((s) => s.theme)
  const setQuery = useStore((s) => s.setQuery)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const setTheme = useStore((s) => s.setTheme)
  const runSearch = useStore((s) => s.runSearch)
  const openFolder = useStore((s) => s.openFolder)
  const clearSearch = useStore((s) => s.clearSearch)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  const handleQuery = (value: string): void => {
    setQuery(value)
    if (tagFilter) clearSearch()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch()
    }, 180)
  }

  const status = !root
    ? 'No vault'
    : progress && progress.phase === 'indexing'
      ? `Indexing ${progress.indexed}/${progress.total}`
      : `${tree.length} files`

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">VV</span>
        <span className="brand-name">Vault Viewer</span>
      </div>
      <button type="button" className="ghost-btn" onClick={() => void openFolder()}>
        Open folder
      </button>
      <div className="search-wrap">
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder={root ? 'Search notes…  (Ctrl+F)' : 'Open a vault to search'}
          value={query}
          disabled={!root}
          onChange={(event) => handleQuery(event.target.value)}
          onFocus={() => setSearchOpen(true)}
        />
        <SearchResults />
      </div>
      <div className="topbar-right">
        <span
          className={`status ${progress && progress.phase === 'indexing' ? 'status-busy' : ''}`}
          title={root ?? ''}
        >
          {status}
        </span>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
    </header>
  )
}
