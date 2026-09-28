import { useEffect, useState } from 'react'
import { isDirty, useStore } from '@/store'

export function PaneToolbar() {
  const note = useStore((s) => s.note)
  const viewMode = useStore((s) => s.viewMode)
  const draft = useStore((s) => s.draft)
  const conflict = useStore((s) => s.conflict)
  const setViewMode = useStore((s) => s.setViewMode)
  const saveDraft = useStore((s) => s.saveDraft)
  const revertDraft = useStore((s) => s.revertDraft)
  const reloadFromDisk = useStore((s) => s.reloadFromDisk)
  const keepEditing = useStore((s) => s.keepEditing)
  const closeDeletedFile = useStore((s) => s.closeDeletedFile)
  const [confirmRevert, setConfirmRevert] = useState(false)

  useEffect(() => {
    if (!confirmRevert) return
    const timer = setTimeout(() => setConfirmRevert(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmRevert])

  if (!note) return null
  const dirty = isDirty({ draft, note })

  const onRevert = (): void => {
    if (!dirty) return
    if (!confirmRevert) {
      setConfirmRevert(true)
      return
    }
    setConfirmRevert(false)
    revertDraft()
  }

  return (
    <div className="pane-toolbar-wrap">
      <div className="pane-toolbar">
        <div className="segmented">
          <button
            type="button"
            aria-pressed={viewMode === 'read'}
            onClick={() => void setViewMode('read')}
          >
            Read
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'edit'}
            onClick={() => void setViewMode('edit')}
          >
            Edit
          </button>
        </div>
        {viewMode === 'edit' && (
          <div className="pane-tools">
            <span className="pane-file" title={note.path}>
              {note.path}
            </span>
            {dirty && (
              <span className="dirty-dot" title="Unsaved changes">
                ●
              </span>
            )}
            <button
              type="button"
              className="primary-btn"
              disabled={!dirty}
              onClick={() => void saveDraft()}
            >
              Save
            </button>
            <button
              type="button"
              className={confirmRevert ? 'ghost-btn danger' : 'ghost-btn'}
              disabled={!dirty}
              onClick={onRevert}
            >
              {confirmRevert ? 'Discard changes?' : 'Revert'}
            </button>
          </div>
        )}
      </div>
      {conflict && (
        <div className="conflict-banner" role="alert">
          <span className="conflict-text">
            {conflict === 'changed' ? 'Changed on disk' : 'File was deleted on disk'}
          </span>
          {conflict === 'changed' ? (
            <>
              <button type="button" className="ghost-btn" onClick={reloadFromDisk}>
                Reload from disk
              </button>
              <button type="button" className="ghost-btn" onClick={keepEditing}>
                Keep editing
              </button>
            </>
          ) : (
            <>
              <button type="button" className="primary-btn" onClick={() => void saveDraft()}>
                Save to recreate
              </button>
              <button type="button" className="ghost-btn" onClick={closeDeletedFile}>
                Close
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
