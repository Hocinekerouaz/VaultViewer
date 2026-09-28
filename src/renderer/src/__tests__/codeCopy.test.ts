import { describe, expect, it } from 'vitest'
import { resolveCopyText } from '@/lib/codeCopy'

describe('resolveCopyText', () => {
  it('returns the selection when text is selected', () => {
    expect(resolveCopyText('partial pick', '# whole note')).toBe('partial pick')
  })

  it('keeps whitespace inside a real selection', () => {
    expect(resolveCopyText('line\n', 'fallback')).toBe('line\n')
  })

  it('falls back when nothing is selected', () => {
    expect(resolveCopyText('', '# whole note')).toBe('# whole note')
  })

  it('falls back when the selection is only whitespace', () => {
    expect(resolveCopyText('  \n ', '# whole note')).toBe('# whole note')
  })
})
