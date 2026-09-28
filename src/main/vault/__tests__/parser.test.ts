import { describe, expect, it } from 'vitest'
import { parseFile } from '../parser'

const sample = `---
title: My Note
tags: [alpha, beta]
date: 2026-01-01
author: tester
---

# Heading

See [[Other|the alias]] and [[folder/Deep]].

Inline #gamma tag here.

Not a tag: # followed by space, a#b stays.

\`\`\`
#code-tag [[NotALink]] #also-not
\`\`\`

Use \`[[InlineCode]]\` inline.
`

describe('parseFile', () => {
  it('extracts frontmatter title, tags and fields', () => {
    const parsed = parseFile('notes/My Note.md', sample)
    expect(parsed.title).toBe('My Note')
    expect(parsed.frontmatter.author).toBe('tester')
    expect(parsed.tags).toContain('alpha')
    expect(parsed.tags).toContain('beta')
    expect(parsed.tags).toContain('gamma')
    expect(parsed.body).not.toContain('---\ntitle:')
  })

  it('extracts wikilinks with and without aliases', () => {
    const parsed = parseFile('notes/My Note.md', sample)
    expect(parsed.wikilinks).toEqual(expect.arrayContaining(['Other', 'folder/Deep']))
    expect(parsed.wikilinks).not.toContain('NotALink')
    expect(parsed.wikilinks).not.toContain('InlineCode')
  })

  it('does not treat headings as tags', () => {
    const parsed = parseFile('a.md', '# Title\n\nbody text\n')
    expect(parsed.tags).toEqual([])
    expect(parsed.title).toBe('Title')
  })

  it('falls back to filename when no frontmatter or heading', () => {
    const parsed = parseFile('folder/plain-note.md', 'just text\n')
    expect(parsed.title).toBe('plain-note')
  })

  it('parses non-markdown files as plain text', () => {
    const parsed = parseFile('data.json', '{"a": 1}')
    expect(parsed.title).toBe('data')
    expect(parsed.body).toBe('{"a": 1}')
    expect(parsed.tags).toEqual([])
    expect(parsed.wikilinks).toEqual([])
    expect(parsed.frontmatter).toEqual({})
  })

  it('keeps inline tags with slashes', () => {
    const parsed = parseFile('b.md', 'touch #proj/alpha today\n')
    expect(parsed.tags).toContain('proj/alpha')
  })
})
