import { SUPPORTED_EXTENSIONS } from './parser'

export interface ResolveNote {
  id: number
  rel_path: string
}

export type ResolveOutcome =
  | { status: 'ok'; path: string }
  | { status: 'ambiguous'; options: string[] }
  | { status: 'missing' }

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return name
  const ext = name.slice(dot).toLowerCase()
  if (SUPPORTED_EXTENSIONS.includes(ext)) return name.slice(0, dot)
  return name
}

function posixBasename(relPath: string): string {
  const slash = relPath.lastIndexOf('/')
  return slash === -1 ? relPath : relPath.slice(slash + 1)
}

function hasSupportedExt(name: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

export function resolveTarget(
  fromRelPath: string,
  target: string,
  notes: ResolveNote[]
): ResolveOutcome {
  const trimmed = target.trim()
  if (!trimmed.length) return { status: 'missing' }

  const byPath = new Map<string, ResolveNote>()
  for (const note of notes) byPath.set(note.rel_path.toLowerCase(), note)

  const slash = fromRelPath.lastIndexOf('/')
  const dir = slash === -1 ? '' : fromRelPath.slice(0, slash)
  const joined = dir ? `${dir}/${trimmed}` : trimmed

  const relativeCandidates = [trimmed, joined]
  if (!hasSupportedExt(trimmed)) {
    for (const ext of SUPPORTED_EXTENSIONS) relativeCandidates.push(joined + ext)
  }

  for (const candidate of relativeCandidates) {
    const hit = byPath.get(candidate.toLowerCase())
    if (hit) return { status: 'ok', path: hit.rel_path }
  }

  const wantNoExt = stripExt(trimmed).toLowerCase()
  const wantFull = trimmed.toLowerCase()
  const matches: string[] = []
  for (const note of notes) {
    const notePath = note.rel_path.toLowerCase()
    const noteBaseNoExt = stripExt(posixBasename(note.rel_path)).toLowerCase()
    if (noteBaseNoExt === wantNoExt || notePath === wantFull || notePath.endsWith('/' + wantFull)) {
      matches.push(note.rel_path)
    }
  }
  matches.sort()

  if (matches.length === 1) return { status: 'ok', path: matches[0] }
  if (matches.length > 1) return { status: 'ambiguous', options: matches }
  return { status: 'missing' }
}
