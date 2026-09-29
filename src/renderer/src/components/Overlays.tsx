import { useStore } from '@/store'
import { useDialogFocus } from '@/lib/modalFocus'
import { RenderedBody } from './RenderedBody'

function formatWhen(createdAt: number): string {
  const date = new Date(createdAt)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === new Date().toDateString()) return `Today ${time}`
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

export function AmbiguityPicker() {
  const pendingWiki = useStore((s) => s.pendingWiki)
  const dismissWiki = useStore((s) => s.dismissWiki)
  const openNote = useStore((s) => s.openNote)
  const { modalRef, onModalKeyDown } = useDialogFocus(pendingWiki !== null)

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
        ref={modalRef}
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a note"
        tabIndex={-1}
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
  const { modalRef, onModalKeyDown } = useDialogFocus(pending !== null)

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
        ref={modalRef}
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved changes"
        tabIndex={-1}
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

export function ExternalOpenModal() {
  const external = useStore((s) => s.externalOpen)
  const confirmExternalOpen = useStore((s) => s.confirmExternalOpen)
  const cancelExternalOpen = useStore((s) => s.cancelExternalOpen)
  const { modalRef, onModalKeyDown } = useDialogFocus(external !== null)

  if (!external) return null
  const parts = external.absPath.split(/[\\/]/)
  const name = parts[parts.length - 1] ?? external.absPath
  const folder = parts[parts.length - 2] ?? ''

  return (
    <div
      className="modal-overlay"
      onClick={cancelExternalOpen}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancelExternalOpen()
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Open file"
        tabIndex={-1}
      >
        <div className="modal-title">
          Open <code>{name}</code>?
        </div>
        <div className="muted small">
          {folder ? `Its folder “${folder}” is` : 'Its folder is'} not the open vault. Switch to it
          as your vault?
        </div>
        {external.dirty && (
          <div className="muted small">Unsaved changes to the current note will be discarded.</div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            autoFocus
            onClick={cancelExternalOpen}
          >
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={() => void confirmExternalOpen()}>
            Switch &amp; open
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

export function HistoryOverlay() {
  const open = useStore((s) => s.historyOpen)
  const items = useStore((s) => s.historyItems)
  const selected = useStore((s) => s.historySelected)
  const historyView = useStore((s) => s.historyView)
  const note = useStore((s) => s.note)
  const openPath = useStore((s) => s.openPath)
  const closeHistory = useStore((s) => s.closeHistory)
  const selectHistory = useStore((s) => s.selectHistory)
  const restoreHistory = useStore((s) => s.restoreHistory)
  const { modalRef, onModalKeyDown } = useDialogFocus(open)

  if (!open) return null
  const name = (openPath ?? '').split('/').pop() ?? openPath ?? ''
  const preview = selected !== null ? historyView : note
  const selectedMeta = selected !== null ? items.find((item) => item.id === selected) : undefined
  const previewLabel =
    selected === null ? 'Current version' : `Version from ${formatWhen(selectedMeta?.createdAt ?? 0)}`

  return (
    <div
      className="modal-overlay"
      onClick={closeHistory}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeHistory()
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal history-modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        tabIndex={-1}
      >
        <div className="modal-title">
          Version history for <code>{name}</code>
        </div>
        <div className="history-layout">
          <ul className="history-list">
            {items.length === 0 && (
              <li className="history-empty">No earlier versions yet for this file.</li>
            )}
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`modal-option history-item${selected === item.id ? ' is-selected' : ''}`}
                  aria-pressed={selected === item.id}
                  onClick={() => void selectHistory(item.id)}
                >
                  <span className="history-when">{formatWhen(item.createdAt)}</span>
                  <span className="history-meta">
                    {formatSize(item.size)}
                    {item.source === 'delete' && <span className="history-badge">deleted</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="history-preview">
            <div className="history-preview-label">{previewLabel}</div>
            <div className="history-preview-body">
              {preview ? (
                <RenderedBody view={preview} />
              ) : (
                <p className="muted">Select a version to preview it.</p>
              )}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={closeHistory}>
            Close
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={selected === null || !historyView}
            onClick={() => void restoreHistory()}
          >
            Restore this version
          </button>
        </div>
      </div>
    </div>
  )
}
