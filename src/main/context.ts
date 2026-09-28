import type { BrowserWindow } from 'electron'
import type { VaultIndex } from './vault/indexer'

export const appState: {
  window: BrowserWindow | null
  root: string | null
  userData: string
  index: VaultIndex | null
  stopWatcher: (() => void) | null
  ready: boolean
} = {
  window: null,
  root: null,
  userData: '',
  index: null,
  stopWatcher: null,
  ready: false
}
