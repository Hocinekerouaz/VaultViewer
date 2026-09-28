import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FileView } from '@shared/types'
import { RenderedBody } from './RenderedBody'
import { useStore } from '@/store'
import {
  clearViewCache,
  getCachedView,
  pickPreviewPosition,
  resolvePreviewTarget,
  setCachedView,
  type PreviewPosition
} from '@/lib/linkPreview'

const HOVER_DELAY = 450
const LEAVE_DELAY = 250
const PREVIEW_WIDTH = 380
const PREVIEW_HEIGHT = 320

interface PreviewState {
  path: string
  view: FileView
  position: PreviewPosition
}

function anchorFor(event: Event): HTMLElement | null {
  if (!(event.target instanceof Element)) return null
  const anchor = event.target.closest('a.wikilink')
  if (!(anchor instanceof HTMLElement)) return null
  if (!anchor.closest('.reading .note-body')) return null
  return anchor
}

export function LinkPreview() {
  const linkMap = useStore((s) => s.linkMap)
  const openPath = useStore((s) => s.openPath)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchorEl = useRef<HTMLElement | null>(null)
  const linkMapRef = useRef(linkMap)
  const openPathRef = useRef(openPath)
  linkMapRef.current = linkMap
  openPathRef.current = openPath

  const clearTimers = (): void => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }

  const hide = (): void => {
    clearTimers()
    anchorEl.current = null
    setPreview(null)
  }

  const build = (path: string, view: FileView, anchor: HTMLElement): PreviewState => {
    const rect = anchor.getBoundingClientRect()
    const position = pickPreviewPosition(
      { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight }
    )
    return { path, view, position }
  }

  const showFor = (anchor: HTMLElement): void => {
    const target = anchor.dataset.wikilink
    if (!target) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
    const path = resolvePreviewTarget(linkMapRef.current, target, openPathRef.current)
    if (!path) return
    const cached = getCachedView(path)
    if (cached) {
      setPreview(build(path, cached, anchor))
      return
    }
    void window.api.readFile(path).then((view) => {
      if (!view) return
      setCachedView(path, view)
      if (anchorEl.current === anchor) setPreview(build(path, view, anchor))
    })
  }

  useEffect(() => {
    const onMouseOver = (event: Event): void => {
      const anchor = anchorFor(event)
      if (!anchor || anchor === anchorEl.current) return
      clearTimers()
      anchorEl.current = anchor
      setPreview(null)
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return
      hoverTimer.current = setTimeout(() => showFor(anchor), HOVER_DELAY)
    }
    const onMouseOut = (event: MouseEvent): void => {
      const anchor = anchorFor(event)
      if (!anchor || anchor !== anchorEl.current) return
      const related = event.relatedTarget
      if (related instanceof Node && anchor.contains(related)) return
      clearTimers()
      anchorEl.current = null
      leaveTimer.current = setTimeout(() => setPreview(null), LEAVE_DELAY)
    }
    const onClick = (event: Event): void => {
      if (anchorFor(event)) hide()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }
    const onScroll = (): void => hide()
    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('mouseout', onMouseOut)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('mouseout', onMouseOut)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, { capture: true })
      clearTimers()
    }
  }, [])

  useEffect(() => {
    hide()
  }, [openPath])

  useEffect(() => {
    const off = window.api.onVaultChanged(() => {
      clearViewCache()
      hide()
    })
    return off
  }, [])

  if (!preview) return null
  return createPortal(
    <div
      className="link-preview"
      style={{ top: preview.position.top, left: preview.position.left }}
      onMouseEnter={() => {
        if (leaveTimer.current) {
          clearTimeout(leaveTimer.current)
          leaveTimer.current = null
        }
      }}
      onMouseLeave={() => {
        leaveTimer.current = setTimeout(() => setPreview(null), LEAVE_DELAY)
      }}
    >
      <div className="link-preview-header">
        <span className="link-preview-title">{preview.view.title}</span>
        <span className="link-preview-path">{preview.path}</span>
      </div>
      <div className="link-preview-body">
        <RenderedBody view={preview.view} />
      </div>
    </div>,
    document.body
  )
}
