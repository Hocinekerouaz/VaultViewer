import { useEffect, useRef } from 'react'
import { FrontmatterPanel } from './FrontmatterPanel'
import { PaneToolbar } from './PaneToolbar'
import { EditorPane } from './EditorPane'
import { RenderedBody } from './RenderedBody'
import { useStore } from '@/store'

export function MarkdownPane() {
  const note = useStore((s) => s.note)
  const root = useStore((s) => s.root)
  const linkMap = useStore((s) => s.linkMap)
  const clickWiki = useStore((s) => s.clickWiki)
  const clickTag = useStore((s) => s.clickTag)
  const pendingFind = useStore((s) => s.pendingFind)
  const viewMode = useStore((s) => s.viewMode)
  const bodyRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="reading" ref={bodyRef}>
      <PaneToolbar />
      {viewMode === 'edit' ? (
        <EditorPane />
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
