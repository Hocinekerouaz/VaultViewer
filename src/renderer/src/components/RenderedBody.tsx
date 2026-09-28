import { useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { DataView } from './DataView'
import { rehypeVaultAssets, remarkVaultLinks } from '@/lib/markdownPlugins'
import { dataKindOf } from '@/lib/dataParse'
import { resolveCopyText } from '@/lib/codeCopy'
import type { FileView, LinkMap } from '@shared/types'

interface RenderedBodyProps {
  view: FileView
  linkMap?: LinkMap
  onWiki?: (target: string) => void
  onTag?: (tag: string) => void
}

function CodeBlock({ fallback, ...props }: ComponentPropsWithoutRef<'pre'> & { fallback: string }) {
  const [copied, setCopied] = useState(false)
  const selectionRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return (
    <div className="code-block">
      <button
        type="button"
        className={`code-copy ${copied ? 'copied' : ''}`}
        onMouseDown={() => {
          selectionRef.current = window.getSelection()?.toString() ?? ''
        }}
        onClick={() => {
          const live = window.getSelection()?.toString() ?? ''
          const text = resolveCopyText(selectionRef.current || live, fallback)
          selectionRef.current = ''
          void navigator.clipboard
            .writeText(text)
            .then(() => {
              setCopied(true)
              if (timerRef.current) clearTimeout(timerRef.current)
              timerRef.current = setTimeout(() => setCopied(false), 1500)
            })
            .catch(() => undefined)
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre {...props} />
    </div>
  )
}

export function RenderedBody({ view, linkMap, onWiki, onTag }: RenderedBodyProps) {
  const remarkPlugins = useMemo(() => [remarkGfm, remarkVaultLinks], [])
  const missing = new Set(
    Object.entries(linkMap ?? {})
      .filter(([, outcome]) => outcome.status === 'missing')
      .map(([target]) => target)
  )

  if (view.kind === 'markdown') {
    return (
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
            [rehypeVaultAssets, view.path]
          ]}
          components={{
            pre: (props) => <CodeBlock {...props} fallback={view.raw} />,
            a: (props) => {
              const href = props.href ?? ''
              if (href.startsWith('vaultlink:')) {
                const target = decodeURIComponent(href.slice('vaultlink:'.length))
                const isMissing = missing.has(target)
                return (
                  <a
                    href="#"
                    className={`wikilink ${isMissing ? 'wikilink-missing' : ''}`}
                    data-wikilink={target}
                    onClick={(event) => {
                      event.preventDefault()
                      onWiki?.(target)
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
                      onTag?.(tag)
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
          {view.body}
        </ReactMarkdown>
      </article>
    )
  }
  if (dataKindOf(view.path)) return <DataView note={view} />
  return <pre className="raw-view">{view.body}</pre>
}
