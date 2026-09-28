import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  BacklinkItem,
  FileView,
  IndexProgress,
  LinkMap,
  OpResult,
  OpenVaultResult,
  OutgoingItem,
  RecentVault,
  SaveResult,
  SearchHit,
  SnapshotMeta,
  VaultChange,
  VaultState
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}

const api = {
  openFolder: (): Promise<OpenVaultResult | null> => ipcRenderer.invoke('vault:openDialog'),
  openVaultPath: (path: string): Promise<OpenVaultResult | null> =>
    ipcRenderer.invoke('vault:openPath', path),
  recentVaults: (): Promise<RecentVault[]> => ipcRenderer.invoke('vault:recent'),
  getTree: (): Promise<{ tree: string[]; folders: string[] }> => ipcRenderer.invoke('vault:tree'),
  createFolder: (parentRel: string, name: string): Promise<OpResult> =>
    ipcRenderer.invoke('op:createFolder', parentRel, name),
  renamePath: (relPath: string, newName: string): Promise<OpResult> =>
    ipcRenderer.invoke('op:rename', relPath, newName),
  deletePath: (relPath: string): Promise<OpResult> => ipcRenderer.invoke('op:delete', relPath),
  getVaultState: (): Promise<VaultState> => ipcRenderer.invoke('vault:state'),
  readFile: (relPath: string): Promise<FileView | null> =>
    ipcRenderer.invoke('file:read', relPath),
  writeFile: (relPath: string, content: string): Promise<SaveResult> =>
    ipcRenderer.invoke('file:write', relPath, content),
  search: (query: string): Promise<SearchHit[]> => ipcRenderer.invoke('search:query', query),
  searchTag: (tag: string): Promise<SearchHit[]> => ipcRenderer.invoke('search:tag', tag),
  getBacklinks: (relPath: string): Promise<BacklinkItem[]> =>
    ipcRenderer.invoke('links:backlinks', relPath),
  getOutgoing: (relPath: string): Promise<OutgoingItem[]> =>
    ipcRenderer.invoke('links:outgoing', relPath),
  resolveNoteLinks: (relPath: string): Promise<LinkMap> =>
    ipcRenderer.invoke('links:forNote', relPath),
  historyList: (relPath: string): Promise<SnapshotMeta[]> =>
    ipcRenderer.invoke('history:list', relPath),
  historyView: (id: number): Promise<FileView | null> => ipcRenderer.invoke('history:view', id),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  onIndexProgress: (callback: (payload: IndexProgress) => void): (() => void) =>
    subscribe('vault:progress', callback),
  onVaultChanged: (callback: (payload: VaultChange[]) => void): (() => void) =>
    subscribe('vault:changed', callback),
  onVaultOpened: (callback: (payload: OpenVaultResult) => void): (() => void) =>
    subscribe('vault:opened', callback)
}

export type VaultApi = typeof api

declare global {
  interface Window {
    api: VaultApi
  }
}

contextBridge.exposeInMainWorld('api', api)
