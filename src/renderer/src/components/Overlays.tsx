import { useStore } from '@/store'

export function AmbiguityPicker() {
  const pendingWiki = useStore((s) => s.pendingWiki)
  const dismissWiki = useStore((s) => s.dismissWiki)
  const openNote = useStore((s) => s.openNote)

  if (!pendingWiki) return null

  return (
    <div
      className="modal-overlay"
      onClick={dismissWiki}
      onKeyDown={(event) => {
        if (event.key === 'Escape') dismissWiki()
      }}
      role="presentation"
    >
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a note"
      >
        <div className="modal-title">
          Multiple notes match <code>[[{pendingWiki.target}]]</code>
        </div>
        <ul className="modal-list">
          {pendingWiki.options.map((option) => (
            <li key={option}>
              <button
                type="button"
                className="modal-option"
                onClick={() => {
                  dismissWiki()
                  void openNote(option)
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="ghost-btn" onClick={dismissWiki}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export function SwitchModal() {
  const pending = useStore((s) => s.pendingSwitch)
  const openPath = useStore((s) => s.openPath)
  const resolveSwitch = useStore((s) => s.resolveSwitch)

  if (!pending) return null
  const name = (openPath ?? '').split('/').pop() ?? openPath ?? ''

  return (
    <div
      className="modal-overlay"
      onClick={() => void resolveSwitch('cancel')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') void resolveSwitch('cancel')
      }}
      role="presentation"
    >
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved changes"
      >
        <div className="modal-title">
          Save changes to <code>{name}</code> first?
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            autoFocus
            onClick={() => void resolveSwitch('cancel')}
          >
            Cancel
          </button>
          <button type="button" className="ghost-btn" onClick={() => void resolveSwitch('discard')}>
            Discard
          </button>
          <button type="button" className="primary-btn" onClick={() => void resolveSwitch('save')}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return <div className="toast">{toast}</div>
}
