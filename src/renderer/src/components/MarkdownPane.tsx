import { useEffect, useMemo, useRef } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { FrontmatterPanel } from './FrontmatterPanel'
import { rehypeVaultAssets, remarkVaultLinks } from '@/lib/markdownPlugins'
import { useStore } from '@/store'

export function MarkdownPane() {
  const note = useStore((s) => s.note)
  const root = useStore((s) => s.root)
  const linkMap = useStore((s) => s.linkMap)
  const clickWiki = useStore((s) => s.clickWiki)
  const clickTag = useStore((s) => s.clickTag)
  const pendingFind = useStore((s) => s.pendingFind)
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

  const remarkPlugins = useMemo(() => [remarkGfm, remarkVaultLinks], [])

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

  const missing = new Set(
    Object.entries(linkMap)
      .filter(([, outcome]) => outcome.status === 'missing')
      .map(([target]) => target)
  )

  return (
    <div className="reading" ref={bodyRef}>
      <FrontmatterPanel note={note} onTagClick={(tag) => void clickTag(tag)} />
      {note.kind === 'markdown' ? (
        <article className="note-body">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            urlTransform={(url, key) => {
              if (key === 'href' && /^(vaultlink:|vaulttag:)/.test(url)) return url
              if (key === 'src' && url.startsWith('vault-asset:')) return url
              return defaultUrlTransform(url)
            }}
            rehypePlugins={[
              [rehypeHighlight, { detect: true, ignoreMissing: true }],
              [rehypeVaultAssets, note.path]
            ]}
            components={{
              a: (props) => {
                const href = props.href ?? ''
                if (href.startsWith('vaultlink:')) {
                  const target = decodeURIComponent(href.slice('vaultlink:'.length))
                  const isMissing = missing.has(target)
                  return (
                    <a
                      href="#"
                      className={`wikilink ${isMissing ? 'wikilink-missing' : ''}`}
                      onClick={(event) => {
                        event.preventDefault()
                        clickWiki(target)
                      }}
                    >
                      {props.children}
                    </a>
                  )
                }
                if (href.startsWith('vaulttag:')) {
                  const tag = decodeURIComponent(href.slice('vaulttag:'.length))
                  return (
                    <a
                      href="#"
                      className="tag-chip"
                      onClick={(event) => {
                        event.preventDefault()
                        void clickTag(tag)
                      }}
                    >
                      {props.children}
                    </a>
                  )
                }
                if (/^https?:/i.test(href)) {
                  return (
                    <a href={href} target="_blank" rel="noreferrer">
                      {props.children}
                    </a>
                  )
                }
                return <a {...props} />
              }
            }}
          >
            {note.body}
          </ReactMarkdown>
        </article>
      ) : (
        <pre className="raw-view">{note.body}</pre>
      )}
    </div>
  )
}
