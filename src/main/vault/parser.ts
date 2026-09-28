import matter from 'gray-matter'
import { basename, extname } from 'node:path'

export const SUPPORTED_EXTENSIONS = ['.md', '.json', '.yaml', '.yml', '.csv', '.txt']

export function isSupported(name: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extname(name).toLowerCase())
}

export interface ParsedFile {
  title: string
  tags: string[]
  frontmatter: Record<string, unknown>
  body: string
  content: string
  wikilinks: string[]
}

export function fileTitle(relPath: string): string {
  const name = basename(relPath)
  return name.slice(0, name.length - extname(name).length)
}

function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
}

function unique(list: string[]): string[] {
  return [...new Set(list)]
}

function frontmatterTags(data: Record<string, unknown>): string[] {
  const raw = data.tags ?? data.tag
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).replace(/^#/, '').trim())
      .filter((item) => item.length > 0)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((item) => item.replace(/^#/, '').trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function inlineTags(text: string): string[] {
  const tags: string[] = []
  const re = /(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const tag = match[1].replace(/[-/]+$/, '')
    if (tag.length > 0) tags.push(tag)
  }
  return tags
}

function extractWikilinks(text: string): string[] {
  const targets: string[] = []
  const re = /\[\[([^\[\]\n]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const inner = match[1]
    const target = inner.split('|')[0].trim()
    if (target.length > 0) targets.push(target)
  }
  return targets
}

function firstHeading(text: string): string | null {
  const match = /^#\s+(.+)$/m.exec(text)
  if (!match) return null
  return match[1]
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  try {
    const parsed = matter(raw)
    const data =
      parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
        ? { ...(parsed.data as Record<string, unknown>) }
        : {}
    return { data, content: parsed.content }
  } catch {
    return { data: {}, content: raw }
  }
}

export function parseFile(relPath: string, raw: string): ParsedFile {
  const ext = extname(relPath).toLowerCase()
  if (ext !== '.md') {
    return {
      title: fileTitle(relPath),
      tags: [],
      frontmatter: {},
      body: raw,
      content: raw,
      wikilinks: []
    }
  }

  const { data, content } = splitFrontmatter(raw)
  const stripped = stripCode(content)
  const fmTitle = typeof data.title === 'string' ? data.title.trim() : ''
  const title = fmTitle || firstHeading(content) || fileTitle(relPath)

  return {
    title,
    tags: unique([...frontmatterTags(data), ...inlineTags(stripped)]),
    frontmatter: data,
    body: content,
    content,
    wikilinks: unique(extractWikilinks(stripped))
  }
}
