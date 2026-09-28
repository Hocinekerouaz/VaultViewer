import { useEffect, useRef, useState } from 'react'
import { TopBar } from '@/components/TopBar'
import { Sidebar } from '@/components/Sidebar'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { MarkdownPane } from '@/components/MarkdownPane'
import { BacklinksPanel } from '@/components/BacklinksPanel'
import { AmbiguityPicker, Toast } from '@/components/Overlays'
import { isInternalNoteDrag, NOTE_DRAG_TYPE } from '@/lib/tree'
import { useStore } from '@/store'

export default function App() {
  const init = useStore((s) => s.init)
  const openVaultPath = useStore((s) => s.openVaultPath)
  const openNote = useStore((s) => s.openNote)
  const searchOpen = useStore((s) => s.searchOpen)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const root = useStore((s) => s.root)
  const note = useStore((s) => s.note)
  const [dropHover, setDropHover] = useState(false)
  const dragDepth = useRef(0)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const vault = root ? (root.split(/[\\/]/).filter(Boolean).pop() ?? root) : null
    document.title = [note?.title, vault, 'Vault Viewer'].filter(Boolean).join(' — ')
  }, [root, note])

  useEffect(() => {
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault()
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      try {
        const path = window.api.pathForFile(file)
        if (path) void openVaultPath(path)
      } catch {
        useStore.getState().showToast('Could not read the dropped folder')
      }
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (!searchOpen) return
      const target = event.target as HTMLElement | null
      if (!target?.closest('.search-wrap')) setSearchOpen(false)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [openVaultPath, searchOpen, setSearchOpen])

  const isNoteDrag = (event: { dataTransfer: DataTransfer }): boolean =>
    isInternalNoteDrag([...event.dataTransfer.types])

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <Sidebar />
        <main
          className={`reading-pane ${dropHover ? 'drop-target' : ''}`}
          onDragEnter={(event) => {
            if (!isNoteDrag(event)) return
            event.preventDefault()
            dragDepth.current += 1
            setDropHover(true)
          }}
          onDragOver={(event) => {
            if (!isNoteDrag(event)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDragLeave={(event) => {
            if (!isNoteDrag(event)) return
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (dragDepth.current === 0) setDropHover(false)
          }}
          onDrop={(event) => {
            if (!isNoteDrag(event)) return
            event.preventDefault()
            event.stopPropagation()
            dragDepth.current = 0
            setDropHover(false)
            const path = event.dataTransfer.getData(NOTE_DRAG_TYPE)
            if (path) void openNote(path)
          }}
        >
          <Breadcrumbs />
          <MarkdownPane />
        </main>
        <BacklinksPanel />
      </div>
      <AmbiguityPicker />
      <Toast />
    </div>
  )
}
