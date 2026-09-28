import { useStore } from '@/store'

export function BacklinksPanel() {
  const backlinks = useStore((s) => s.backlinks)
  const outgoing = useStore((s) => s.outgoing)
  const openNote = useStore((s) => s.openNote)
  const showToast = useStore((s) => s.showToast)
  const root = useStore((s) => s.root)

  if (!root) return null

  return (
    <aside className="rail">
      <section className="rail-section">
        <div className="rail-heading">
          Backlinks <span className="count">{backlinks.length}</span>
        </div>
        {backlinks.length === 0 ? (
          <p className="muted small">No notes link here yet.</p>
        ) : (
          <ul className="rail-list">
            {backlinks.map((item) => (
              <li key={`${item.path}-${item.target}`}>
                <button
                  type="button"
                  className="rail-item"
                  onClick={() => void openNote(item.path)}
                >
                  <span className="rail-item-title">{item.title}</span>
                  <span className="rail-item-path">{item.path}</span>
                  <span className="rail-item-via">via [[{item.target}]]</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rail-section">
        <div className="rail-heading">
          Outgoing <span className="count">{outgoing.length}</span>
        </div>
        {outgoing.length === 0 ? (
          <p className="muted small">This note has no links.</p>
        ) : (
          <ul className="rail-list">
            {outgoing.map((item) => (
              <li key={item.target}>
                <button
                  type="button"
                  className={`rail-item ${item.path ? '' : 'rail-item-missing'}`}
                  onClick={() => {
                    if (item.path) void openNote(item.path)
                    else showToast(`No note matches [[${item.target}]]`)
                  }}
                >
                  <span className="rail-item-title">
                    {item.title ?? `[[${item.target}]]`}
                  </span>
                  <span className="rail-item-path">{item.path ?? 'not found'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
