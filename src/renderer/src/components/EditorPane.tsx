import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useStore } from '@/store'

function languageFor(path: string): Extension {
  const lower = path.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return markdown()
  if (lower.endsWith('.json')) return json()
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return yaml()
  return []
}

const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--text)',
    backgroundColor: 'var(--bg-elevated)',
    fontSize: '13px',
    height: '100%'
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    caretColor: 'var(--accent)',
    padding: '14px 16px 32px',
    minHeight: '60vh'
  },
  '.cm-scroller': { lineHeight: '1.65' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    border: 'none',
    borderRight: '1px solid var(--border)'
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--bg-hover) 60%, transparent)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--accent-soft)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--accent-soft)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--accent-soft)',
    outline: '1px solid var(--border-strong)'
  },
  '.cm-selectionMatch': { backgroundColor: 'var(--mark)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text)'
  },
  '.cm-panels': { backgroundColor: 'var(--bg-panel)', color: 'var(--text)' }
})

const tokenHighlight = HighlightStyle.define([
  { tag: tags.string, color: 'var(--link)' },
  { tag: tags.number, color: 'var(--accent)' },
  { tag: tags.bool, color: 'var(--danger)' },
  { tag: tags.null, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: tags.propertyName, color: 'var(--text)' },
  { tag: tags.comment, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--text-muted)' },
  { tag: tags.heading, color: 'var(--link)', fontWeight: '600' },
  { tag: tags.link, color: 'var(--link)' },
  { tag: tags.url, color: 'var(--link)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.atom, color: 'var(--accent)' }
])

export function EditorPane() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const syncingRef = useRef(false)
  const openPath = useStore((s) => s.openPath)
  const note = useStore((s) => s.note)
  const draft = useStore((s) => s.draft)

  useEffect(() => {
    const host = hostRef.current
    const initial = useStore.getState()
    if (!host || !initial.note) return
    const state = EditorState.create({
      doc: initial.draft ?? initial.note.raw,
      extensions: [
        basicSetup,
        EditorState.tabSize.of(2),
        indentUnit.of('  '),
        EditorView.lineWrapping,
        keymap.of([indentWithTab]),
        languageFor(initial.note.path),
        editorTheme,
        syntaxHighlighting(tokenHighlight),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingRef.current) {
            useStore.getState().updateDraft(update.state.doc.toString())
          }
        })
      ]
    })
    const view = new EditorView({ state, parent: host })
    viewRef.current = view

    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void useStore.getState().saveDraft()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      view.destroy()
      viewRef.current = null
    }
  }, [openPath])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const incoming = draft ?? useStore.getState().note?.raw ?? ''
    if (incoming !== view.state.doc.toString()) {
      syncingRef.current = true
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: incoming } })
      syncingRef.current = false
    }
  }, [draft, note])

  return <div className="editor-host" ref={hostRef} />
}
