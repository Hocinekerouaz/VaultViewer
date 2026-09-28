import { load } from 'js-yaml'

export type DataKind = 'json' | 'yaml' | 'csv'

export type DataOutcome =
  | { ok: true; kind: 'json' | 'yaml'; value: unknown }
  | { ok: true; kind: 'csv'; rows: string[][] }
  | { ok: false; kind: DataKind; error: string }

export function dataKindOf(path: string): DataKind | null {
  const lower = path.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml'
  if (lower.endsWith('.csv')) return 'csv'
  return null
}

export function parseJsonData(raw: string): DataOutcome {
  try {
    return { ok: true, kind: 'json', value: JSON.parse(raw) as unknown }
  } catch (error) {
    return { ok: false, kind: 'json', error: message(error) }
  }
}

export function parseYamlData(raw: string): DataOutcome {
  try {
    return { ok: true, kind: 'yaml', value: load(raw) as unknown }
  } catch (error) {
    return { ok: false, kind: 'yaml', error: message(error) }
  }
}

export function parseCsvData(raw: string): DataOutcome {
  try {
    const text = raw.replace(/^\uFEFF/, '')
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false
    let i = 0

    while (i < text.length) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"'
            i += 2
            continue
          }
          inQuotes = false
          i += 1
          continue
        }
        field += ch
        i += 1
        continue
      }
      if (ch === '"' && field === '') {
        inQuotes = true
        i += 1
        continue
      }
      if (ch === ',') {
        row.push(field)
        field = ''
        i += 1
        continue
      }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') i += 1
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i += 1
        continue
      }
      field += ch
      i += 1
    }

    if (inQuotes) {
      return { ok: false, kind: 'csv', error: 'Unterminated quoted field' }
    }
    if (field !== '' || row.length > 0) {
      row.push(field)
      rows.push(row)
    }
    return { ok: true, kind: 'csv', rows }
  } catch (error) {
    return { ok: false, kind: 'csv', error: message(error) }
  }
}

export function parseData(path: string, raw: string): DataOutcome | null {
  const kind = dataKindOf(path)
  if (kind === 'json') return parseJsonData(raw)
  if (kind === 'yaml') return parseYamlData(raw)
  if (kind === 'csv') return parseCsvData(raw)
  return null
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
