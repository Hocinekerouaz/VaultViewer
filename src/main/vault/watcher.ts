import { watch } from 'chokidar'
import { relative, sep } from 'node:path'
import type { VaultChange, VaultChangeType } from '../../shared/types'

export function startWatcher(
  root: string,
  onBatch: (changes: VaultChange[]) => void
): () => void {
  const pending = new Map<string, VaultChange>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = (): void => {
    timer = null
    if (!pending.size) return
    const batch = [...pending.values()]
    pending.clear()
    onBatch(batch)
  }

  const push = (type: VaultChangeType, absPath: string): void => {
    const relPath = relative(root, absPath).split(sep).join('/')
    if (!relPath || relPath.startsWith('..')) return
    pending.set(`${type}:${relPath}`, { type, relPath })
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, 250)
  }

  const watcher = watch(root, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    ignored: /(^|[\\/])(\.git|node_modules|\.obsidian|\.trash)([\\/]|$)/
  })

  watcher.on('add', (path) => push('add', path))
  watcher.on('change', (path) => push('change', path))
  watcher.on('unlink', (path) => push('unlink', path))
  watcher.on('addDir', (path) => push('dir', path))
  watcher.on('unlinkDir', (path) => push('dir', path))

  return () => {
    void watcher.close()
    if (timer) clearTimeout(timer)
  }
}
