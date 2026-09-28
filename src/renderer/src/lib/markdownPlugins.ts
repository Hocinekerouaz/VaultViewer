import { visit } from 'unist-util-visit'
import type { Node } from 'unist'

type TextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'wiki'; target: string; label: string }
  | { kind: 'tag'; tag: string }

function splitSegments(value: string): TextSegment[] {
  const re = /\[\[([^\[\]\n]+)\]\]|(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu
  const segments: TextSegment[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(value)) !== null) {
    const start = match.index
    const isTag = match[1] === undefined
    const nodeStart = isTag ? (match[0][0] === '#' ? start : start + 1) : start
    if (nodeStart > last) segments.push({ kind: 'text', value: value.slice(last, nodeStart) })
    if (!isTag && match[1] !== undefined) {
      const inner = match[1]
      const pipe = inner.indexOf('|')
      const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim()
      const label = pipe === -1 ? target : inner.slice(pipe + 1).trim()
      if (target) segments.push({ kind: 'wiki', target, label })
      else segments.push({ kind: 'text', value: match[0] })
    } else {
      const tag = (match[2] ?? '').replace(/[-/]+$/, '')
      if (tag) segments.push({ kind: 'tag', tag })
      else segments.push({ kind: 'text', value: match[0] })
    }
    last = re.lastIndex
  }
  if (last < value.length) segments.push({ kind: 'text', value: value.slice(last) })
  if (!segments.length) segments.push({ kind: 'text', value })
  return segments
}

function isCodeLike(parent: { type?: string } | null | undefined): boolean {
  if (!parent) return false
  return parent.type === 'inlineCode' || parent.type === 'code' || parent.type === 'html'
}

export function remarkVaultLinks() {
  return (tree: Node) => {
    visit(tree, 'text', (node: { type: string; value?: string }, index, parent) => {
      if (typeof node.value !== 'string') return
      if (index === null || index === undefined) return
      if (isCodeLike(parent as { type?: string } | null | undefined)) return
      if (!/\[\[|#[\p{L}\p{N}_]/u.test(node.value)) return
      const segments = splitSegments(node.value)
      if (segments.length === 1 && segments[0].kind === 'text') return

      const newNodes = segments.map((segment) => {
        if (segment.kind === 'wiki') {
          return {
            type: 'link',
            url: `vaultlink:${encodeURIComponent(segment.target)}`,
            title: null,
            children: [{ type: 'text', value: segment.label }],
            data: {
              hProperties: { class: 'wikilink', 'data-wikilink': segment.target }
            }
          }
        }
        if (segment.kind === 'tag') {
          return {
            type: 'link',
            url: `vaulttag:${encodeURIComponent(segment.tag)}`,
            title: null,
            children: [{ type: 'text', value: `#${segment.tag}` }],
            data: { hProperties: { class: 'tag-chip', 'data-tag': segment.tag } }
          }
        }
        return { type: 'text', value: segment.value }
      })

      const siblings = (parent as { children: unknown[] }).children
      siblings.splice(index, 1, ...newNodes)
      return index + newNodes.length
    })
  }
}

function normalizePosix(input: string): string {
  const parts: string[] = []
  for (const segment of input.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      parts.pop()
      continue
    }
    parts.push(segment)
  }
  return parts.join('/')
}

export function rehypeVaultAssets(noteRelPath: string) {
  return (tree: Node) => {
    visit(tree, 'element', (node: { tagName?: string; properties?: Record<string, unknown> }) => {
      if (node.tagName !== 'img' || !node.properties) return
      const src = node.properties.src
      if (typeof src !== 'string') return
      if (/^(https?:|vault-asset:|data:)/i.test(src)) return
      const slash = noteRelPath.lastIndexOf('/')
      const noteDir = slash === -1 ? '' : noteRelPath.slice(0, slash)
      const rel = src.startsWith('/') ? src.slice(1) : noteDir ? `${noteDir}/${src}` : src
      const normalized = normalizePosix(rel)
      if (!normalized || normalized.startsWith('..')) return
      const encoded = normalized.split('/').map(encodeURIComponent).join('/')
      node.properties.src = `vault-asset://v/${encoded}`
    })
  }
}
