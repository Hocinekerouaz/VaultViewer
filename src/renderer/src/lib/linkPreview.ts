import type { FileView, LinkMap } from '@shared/types'

export function resolvePreviewTarget(
  linkMap: LinkMap,
  target: string,
  openPath: string | null
): string | null {
  const outcome = linkMap[target]
  if (!outcome || outcome.status !== 'ok') return null
  if (outcome.path === openPath) return null
  return outcome.path
}

export interface AnchorRect {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PreviewSize {
  width: number
  height: number
}

export interface ViewportSize {
  width: number
  height: number
}

export interface PreviewPosition {
  top: number
  left: number
  placement: 'below' | 'above'
}

const GAP = 8
const EDGE = 12

export function pickPreviewPosition(
  anchor: AnchorRect,
  size: PreviewSize,
  viewport: ViewportSize
): PreviewPosition {
  const belowTop = anchor.bottom + GAP
  const aboveTop = anchor.top - GAP - size.height
  const placement: 'below' | 'above' =
    belowTop + size.height <= viewport.height ? 'below' : 'above'
  const top = placement === 'below' ? belowTop : Math.max(EDGE, aboveTop)
  const minLeft = EDGE
  const maxLeft = viewport.width - size.width - EDGE
  const left = Math.min(Math.max(minLeft, anchor.left), Math.max(minLeft, maxLeft))
  return { top, left, placement }
}

const viewCache = new Map<string, FileView>()
const MAX_CACHE = 50

export function getCachedView(path: string): FileView | null {
  return viewCache.get(path) ?? null
}

export function setCachedView(path: string, view: FileView): void {
  if (!viewCache.has(path) && viewCache.size >= MAX_CACHE) {
    const oldest = viewCache.keys().next().value
    if (oldest !== undefined) viewCache.delete(oldest)
  }
  viewCache.delete(path)
  viewCache.set(path, view)
}

export function clearViewCache(): void {
  viewCache.clear()
}
