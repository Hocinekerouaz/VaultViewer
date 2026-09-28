import { useDeferredValue, useEffect, useRef } from 'react'
import { FrontmatterPanel } from './FrontmatterPanel'
import { PaneToolbar } from './PaneToolbar'
import { EditorPane } from './EditorPane'
import { RenderedBody } from './RenderedBody'
import { draftView } from '@/lib/draftPreview'
import { useStore } from '@/store'

export function MarkdownPane() {
  const note = useStore((s) => s.note)
  const root = useStore((s) => s.root)
  const linkMap = useStore((s) => s.linkMap)
  const clickWiki = useStore((s) => s.clickWiki)
  const clickTag = useStore((s) => s.clickTag)
  const pendingFind = useStore((s) => s.pendingFind)
  const viewMode = useStore((s) => s.viewMode)
  const draft = useStore((s) => s.draft)
  const openPath = useStore((s) => s.openPath)
  const bodyRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const deferredDraft = useDeferredValue(draft)

  useEffect(() => {
    if (!pendingFind) return
    const timer = setTimeout(() => {
      const finder = window as unknown as { find: (text: string) => boolean }
      try {
        finder.find(pendingFind)
      } catch {
        void 0
      }
      useStore.setState({ pendingFind: null })
    }, 80)
    return () => clearTimeout(timer)
  }, [pendingFind, note])

  useEffect(() => {
    if (viewMode !== 'edit') return
    const scroller = document.querySelector<HTMLElement>('.editor-split .cm-scroller')
    const preview = previewRef.current
    if (!scroller || !preview) return
    let lock: 'source' | 'preview' | null = null
    const ratioOf = (el: HTMLElement): number => {
      const max = el.scrollHeight - el.clientHeight
      return max > 0 ? el.scrollTop / max : 0
    }
    const fromSource = (): void => {
      if (lock === 'preview') {
        lock = null
        return
      }
      const max = preview.scrollHeight - preview.clientHeight
      if (max <= 0) return
      const next = ratioOf(scroller) * max
      if (Math.abs(next - preview.scrollTop) < 2) return
      lock = 'source'
      preview.scrollTop = next
    }
    const fromPreview = (): void => {
      if (lock === 'source') {
        lock = null
        return
      }
      const max = scroller.scrollHeight - scroller.clientHeight
      if (max <= 0) return
      const next = ratioOf(preview) * max
      if (Math.abs(next - scroller.scrollTop) < 2) return
      lock = 'preview'
      scroller.scrollTop = next
    }
    scroller.addEventListener('scroll', fromSource, { passive: true })
    preview.addEventListener('scroll', fromPreview, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', fromSource)
      preview.removeEventListener('scroll', fromPreview)
    }
  }, [viewMode, openPath])

  if (!root) {
    return (
      <div className="empty-state">
        <h1>Open a folder to get started</h1>
        <p className="muted">
          Point Vault Viewer at a folder of markdown, JSON or text files. Everything stays on
          your machine.
        </p>
        <p className="muted small">You can also drop a folder anywhere in this window.</p>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="empty-state">
        <h1>No file open</h1>
        <p className="muted">Pick a file from the sidebar to read it.</p>
      </div>
    )
  }

  const previewView = draft !== null ? draftView(note, deferredDraft ?? draft) : note

  return (
    <div className={`reading ${viewMode === 'edit' ? 'editing' : ''}`} ref={bodyRef}>
      <PaneToolbar />
      {viewMode === 'edit' ? (
        <div className="editor-split">
          <EditorPane />
          <div className="editor-preview" ref={previewRef}>
            <RenderedBody
              view={previewView}
              linkMap={linkMap}
              onWiki={clickWiki}
              onTag={(tag) => void clickTag(tag)}
            />
          </div>
        </div>
      ) : (
        <>
          <FrontmatterPanel note={note} onTagClick={(tag) => void clickTag(tag)} />
          <RenderedBody
            view={note}
            linkMap={linkMap}
            onWiki={clickWiki}
            onTag={(tag) => void clickTag(tag)}
          />
        </>
      )}
    </div>
  )
}
