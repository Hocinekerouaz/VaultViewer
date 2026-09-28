import type { FileView } from '@shared/types'

export function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw)
  return match ? raw.slice(match[0].length) : raw
}

export function draftView(view: FileView, draft: string): FileView {
  if (view.kind === 'markdown') return { ...view, raw: draft, body: stripFrontmatter(draft) }
  return { ...view, raw: draft, body: draft }
}
