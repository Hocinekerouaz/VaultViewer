import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { describe, expect, it } from 'vitest'
import { rehypeVaultAssets, remarkVaultLinks } from '@/lib/markdownPlugins'

function render(body: string, path = 'Welcome.md'): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkVaultLinks],
        urlTransform: (url: string, key: string) => {
          if (key === 'href' && /^(vaultlink:|vaulttag:)/.test(url)) return url
          if (key === 'src' && url.startsWith('vault-asset:')) return url
          return defaultUrlTransform(url)
        },
        rehypePlugins: [
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
          [rehypeVaultAssets, path]
        ]
      },
      body
    )
  )
}

describe('markdown pipeline', () => {
  it('renders the fixture welcome note', () => {
    const raw = readFileSync('fixtures/vault/Welcome.md', 'utf8')
    const body = raw.replace(/^---[\s\S]*?---\n/, '')
    const html = render(body)
    expect(html).toContain('class="wikilink"')
    expect(html).toContain('tag-chip')
    expect(html).toContain('<table>')
    expect(html).toContain('vault-asset://v/images/dot.png')
    expect(html).toContain('task-list-item')
    expect(html).toContain('hljs')
  })

  it('renders tags and links in headings and lists', () => {
    const html = render('# About [[Home]]\n\n- item with #inline tag\n')
    expect(html).toContain('wikilink')
    expect(html).toContain('tag-chip')
  })

  it('leaves code blocks alone', () => {
    const html = render('```\n[[NotALink]] #nottag\n```\n')
    expect(html).not.toContain('wikilink')
    expect(html).not.toContain('tag-chip')
  })
})
