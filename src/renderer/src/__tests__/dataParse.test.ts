import { describe, expect, it } from 'vitest'
import {
  dataKindOf,
  parseCsvData,
  parseData,
  parseJsonData,
  parseYamlData
} from '@/lib/dataParse'

describe('dataKindOf', () => {
  it('maps extensions to data kinds', () => {
    expect(dataKindOf('a/data.json')).toBe('json')
    expect(dataKindOf('conf.yaml')).toBe('yaml')
    expect(dataKindOf('conf.YML')).toBe('yaml')
    expect(dataKindOf('table.csv')).toBe('csv')
    expect(dataKindOf('note.md')).toBeNull()
    expect(dataKindOf('readme.txt')).toBeNull()
  })
})

describe('parseJsonData', () => {
  it('parses nested values', () => {
    const result = parseJsonData('{"a": [1, 2], "b": {"c": true}}')
    expect(result).toEqual({ ok: true, kind: 'json', value: { a: [1, 2], b: { c: true } } })
  })

  it('reports syntax errors', () => {
    const result = parseJsonData('{"a": ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('json')
  })
})

describe('parseYamlData', () => {
  it('parses nested mappings and lists', () => {
    const result = parseYamlData('name: demo\nitems:\n  - one\n  - two\n')
    expect(result).toEqual({ ok: true, kind: 'yaml', value: { name: 'demo', items: ['one', 'two'] } })
  })

  it('parses timestamps as dates', () => {
    const result = parseYamlData('when: 2026-01-02')
    expect(result.ok).toBe(true)
    if (result.ok && result.kind === 'yaml') {
      expect((result.value as { when: Date }).when).toBeInstanceOf(Date)
    }
  })

  it('reports syntax errors', () => {
    const result = parseYamlData('a: [1, 2')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('yaml')
  })

  it('treats empty input as an empty document', () => {
    const result = parseYamlData('')
    expect(result).toEqual({ ok: true, kind: 'yaml', value: undefined })
  })
})

describe('parseCsvData', () => {
  it('parses header and rows', () => {
    const result = parseCsvData('name,role\nalice,engineer\nbob,writer\n')
    expect(result).toEqual({
      ok: true,
      kind: 'csv',
      rows: [
        ['name', 'role'],
        ['alice', 'engineer'],
        ['bob', 'writer']
      ]
    })
  })

  it('handles quoted commas, quotes and newlines', () => {
    const result = parseCsvData('a,b\n"x,1","line\nbreak"\n"say ""hi""",y\n')
    expect(result.ok).toBe(true)
    if (result.ok && result.kind === 'csv') {
      expect(result.rows).toEqual([
        ['a', 'b'],
        ['x,1', 'line\nbreak'],
        ['say "hi"', 'y']
      ])
    }
  })

  it('handles CRLF and a BOM', () => {
    const result = parseCsvData('\uFEFFh1,h2\r\nv1,v2\r\n')
    expect(result.ok).toBe(true)
    if (result.ok && result.kind === 'csv') {
      expect(result.rows).toEqual([
        ['h1', 'h2'],
        ['v1', 'v2']
      ])
    }
  })

  it('keeps ragged rows as-is', () => {
    const result = parseCsvData('a,b,c\n1,2\n3,4,5,6')
    expect(result.ok).toBe(true)
    if (result.ok && result.kind === 'csv') {
      expect(result.rows).toEqual([['a', 'b', 'c'], ['1', '2'], ['3', '4', '5', '6']])
    }
  })

  it('reports unterminated quotes', () => {
    const result = parseCsvData('a,b\n"oops,2\n')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('csv')
  })
})

describe('parseData', () => {
  it('dispatches by extension and returns null for unsupported files', () => {
    expect(parseData('x.json', '{}')?.ok).toBe(true)
    expect(parseData('x.yaml', 'a: 1')?.ok).toBe(true)
    expect(parseData('x.csv', 'a')?.ok).toBe(true)
    expect(parseData('x.md', '# hi')).toBeNull()
  })
})
