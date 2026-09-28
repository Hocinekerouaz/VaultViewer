export interface RecentVault {
  path: string
  name: string
  lastOpened: number
}

export interface OpenVaultResult {
  root: string
  tree: string[]
  folders: string[]
}

export interface OpResult {
  ok: boolean
  error?: string
  cancelled?: boolean
  path?: string
}

export interface SaveResult extends OpResult {
  view?: FileView
}

export interface FileView {
  kind: 'markdown' | 'text'
  path: string
  title: string
  tags: string[]
  frontmatter: Record<string, unknown>
  body: string
  raw: string
}

export interface SearchHit {
  path: string
  title: string
  snippet: string
  score: number
}

export interface BacklinkItem {
  path: string
  title: string
  target: string
}

export interface OutgoingItem {
  target: string
  path: string | null
  title: string | null
}

export type ResolveOutcome =
  | { status: 'ok'; path: string }
  | { status: 'ambiguous'; options: string[] }
  | { status: 'missing' }

export type LinkMap = Record<string, ResolveOutcome>

export interface IndexProgress {
  phase: 'indexing' | 'done'
  indexed: number
  total: number
}

export type VaultChangeType = 'add' | 'change' | 'unlink' | 'dir'

export interface VaultChange {
  type: VaultChangeType
  relPath: string
}

export interface VaultState {
  root: string | null
  ready: boolean
}
