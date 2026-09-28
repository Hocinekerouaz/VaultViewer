import { dialog, ipcMain, shell } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  IndexProgress,
  LinkMap,
  OpResult,
  OpenVaultResult,
  RecentVault,
  SaveResult,
  VaultChange,
  VaultState
} from '../shared/types'
import { appState } from './context'
import { insideRoot } from './fsutil'
import { addRecent, loadRecent } from './recent'
import * as queries from './db/queries'
import { parseFile } from './vault/parser'
import { resolveTarget, type ResolveNote } from './vault/resolve'
import { createFolder, renamePath, writeNote } from './vault/ops'
import { scanVault } from './vault/scanner'
import { startWatcher } from './vault/watcher'
import { VaultIndex } from './vault/indexer'

function broadcast(channel: string, payload: unknown): void {
  appState.window?.webContents.send(channel, payload)
}

function sendProgress(progress: IndexProgress): void {
  broadcast('vault:progress', progress)
}

async function openVault(root: string): Promise<OpenVaultResult | null> {
  try {
    if (!statSync(root).isDirectory()) return null
  } catch {
    return null
  }

  if (appState.stopWatcher) {
    appState.stopWatcher()
    appState.stopWatcher = null
  }
  if (appState.index) {
    appState.index.close()
    appState.index = null
  }

  appState.root = root
  appState.ready = false
  addRecent(appState.userData, root)

  const index = new VaultIndex(appState.userData, root)
  appState.index = index

  appState.stopWatcher = startWatcher(root, (changes: VaultChange[]) => {
    void index.enqueue(async () => {
      for (const change of changes) {
        if (change.type === 'dir') continue
        if (change.type === 'unlink') index.removeFile(change.relPath)
        else index.updateFile(change.relPath)
      }
      broadcast('vault:changed', changes)
    })
  })

  const { files, folders } = await scanVault(root)
  broadcast('vault:opened', { root, tree: files, folders })
  sendProgress({ phase: 'indexing', indexed: 0, total: files.length })

  void index.enqueue(() => {
    index.fullIndex(files, (indexed, total) => {
      sendProgress({ phase: 'indexing', indexed, total })
    })
    appState.ready = true
    sendProgress({ phase: 'done', indexed: files.length, total: files.length })
  })

  return { root, tree: files, folders }
}

export async function openVaultByPath(path: string): Promise<OpenVaultResult | null> {
  return openVault(path)
}

async function openVaultDialog(): Promise<OpenVaultResult | null> {
  const win = appState.window
  const result = win
    ? await dialog.showOpenDialog(win, {
        title: 'Open vault folder',
        properties: ['openDirectory']
      })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  return openVault(result.filePaths[0])
}

export function openVaultFromMenu(): void {
  void openVaultDialog()
}

function readFileView(relPath: string) {
  const root = appState.root
  if (!root) return null
  const abs = insideRoot(root, relPath)
  if (!abs) return null
  try {
    const raw = readFileSync(abs, 'utf8')
    const parsed = parseFile(relPath, raw)
    const isMarkdown = relPath.toLowerCase().endsWith('.md')
    return {
      kind: isMarkdown ? ('markdown' as const) : ('text' as const),
      path: relPath,
      title: parsed.title,
      tags: parsed.tags,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      raw
    }
  } catch {
    return null
  }
}

async function resolveNoteLinks(relPath: string): Promise<LinkMap> {
  const root = appState.root
  const map: LinkMap = {}
  if (!root) return map
  const abs = insideRoot(root, relPath)
  if (!abs) return map
  let raw: string
  try {
    raw = readFileSync(abs, 'utf8')
  } catch {
    return map
  }
  const parsed = parseFile(relPath, raw)
  if (!parsed.wikilinks.length) return map
  const { files } = await scanVault(root)
  const notes: ResolveNote[] = files.map((path, i) => ({ id: i, rel_path: path }))
  for (const target of parsed.wikilinks) {
    map[target] = resolveTarget(relPath, target, notes)
  }
  return map
}

function requireIndex(): VaultIndex | null {
  return appState.index
}

async function deleteItem(relPath: unknown): Promise<OpResult> {
  const root = appState.root
  if (!root) return { ok: false, error: 'No vault open' }
  if (typeof relPath !== 'string' || !relPath || relPath === '.' || relPath === '..')
    return { ok: false, error: 'Invalid item path' }
  const abs = insideRoot(root, relPath)
  if (!abs || abs === resolve(root)) return { ok: false, error: 'Cannot delete the vault root' }
  try {
    if (!statSync(abs)) return { ok: false, error: 'That item no longer exists' }
  } catch {
    return { ok: false, error: 'That item no longer exists' }
  }
  const name = relPath.slice(relPath.lastIndexOf('/') + 1)
  const options = {
    type: 'warning' as const,
    buttons: ['Move to Recycle Bin', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Move "${name}" to the Recycle Bin?`,
    detail: abs
  }
  const win = appState.window
  const choice = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  if (choice.response !== 0) return { ok: false, cancelled: true }
  try {
    await shell.trashItem(abs)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not move that item to the Recycle Bin' }
  }
}

export function registerIpc(): void {
  ipcMain.handle('vault:openDialog', () => openVaultDialog())
  ipcMain.handle('vault:openPath', (_event, path: unknown) => {
    if (typeof path !== 'string' || !path) return null
    return openVault(path)
  })
  ipcMain.handle('vault:recent', (): RecentVault[] => loadRecent(appState.userData))
  ipcMain.handle('vault:tree', async () => {
    if (!appState.root) return { tree: [], folders: [] }
    const { files, folders } = await scanVault(appState.root)
    return { tree: files, folders }
  })
  ipcMain.handle('op:createFolder', (_event, parentRel: unknown, name: unknown): Promise<OpResult> => {
    if (!appState.root) return Promise.resolve({ ok: false, error: 'No vault open' })
    if (typeof parentRel !== 'string' || typeof name !== 'string')
      return Promise.resolve({ ok: false, error: 'Invalid request' })
    return createFolder(appState.root, parentRel, name)
  })
  ipcMain.handle('op:rename', (_event, relPath: unknown, newName: unknown): Promise<OpResult> => {
    if (!appState.root) return Promise.resolve({ ok: false, error: 'No vault open' })
    if (typeof relPath !== 'string' || typeof newName !== 'string')
      return Promise.resolve({ ok: false, error: 'Invalid request' })
    return renamePath(appState.root, relPath, newName)
  })
  ipcMain.handle('op:delete', (_event, relPath: unknown): Promise<OpResult> => {
    return deleteItem(relPath)
  })
  ipcMain.handle('vault:state', (): VaultState => ({
    root: appState.root,
    ready: appState.ready
  }))
  ipcMain.handle('file:read', (_event, relPath: unknown) => {
    if (typeof relPath !== 'string') return null
    return readFileView(relPath)
  })
  ipcMain.handle('file:write', async (_event, relPath: unknown, content: unknown): Promise<SaveResult> => {
    if (!appState.root) return { ok: false, error: 'No vault open' }
    if (typeof relPath !== 'string' || !relPath || typeof content !== 'string')
      return { ok: false, error: 'Invalid save request' }
    const result = await writeNote(appState.root, relPath, content)
    if (!result.ok) return result
    const view = readFileView(relPath)
    if (!view) return { ok: false, error: 'Could not read the saved file' }
    return { ok: true, path: relPath, view }
  })
  ipcMain.handle('search:query', (_event, query: unknown) => {
    const index = requireIndex()
    if (!index || typeof query !== 'string') return []
    return queries.searchNotes(index.getDb(), query)
  })
  ipcMain.handle('search:tag', (_event, tag: unknown) => {
    const index = requireIndex()
    if (!index || typeof tag !== 'string') return []
    return queries.searchByTag(index.getDb(), tag)
  })
  ipcMain.handle('links:backlinks', (_event, relPath: unknown) => {
    const index = requireIndex()
    if (!index || typeof relPath !== 'string') return []
    const noteId = queries.getNoteIdByPath(index.getDb(), relPath)
    if (noteId === null) return []
    return queries.getBacklinks(index.getDb(), noteId)
  })
  ipcMain.handle('links:outgoing', (_event, relPath: unknown) => {
    const index = requireIndex()
    if (!index || typeof relPath !== 'string') return []
    const noteId = queries.getNoteIdByPath(index.getDb(), relPath)
    if (noteId === null) return []
    return queries.getOutgoing(index.getDb(), noteId)
  })
  ipcMain.handle('links:forNote', (_event, relPath: unknown) => {
    if (typeof relPath !== 'string') return {}
    return resolveNoteLinks(relPath)
  })
}

export function cleanupVault(): void {
  if (appState.stopWatcher) {
    appState.stopWatcher()
    appState.stopWatcher = null
  }
  if (appState.index) {
    appState.index.close()
    appState.index = null
  }
}
