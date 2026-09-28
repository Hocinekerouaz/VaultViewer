import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isSupported } from './parser'

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.obsidian', '.trash', 'out', 'dist'])

export interface ScanResult {
  files: string[]
  folders: string[]
}

export async function scanVault(root: string): Promise<ScanResult> {
  const files: string[] = []
  const folders: string[] = []

  async function walk(dir: string, relDir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          folders.push(relPath)
          await walk(join(dir, entry.name), relPath)
        }
      } else if (entry.isFile() && isSupported(entry.name)) {
        files.push(relPath)
      }
    }
  }

  await walk(root, '')
  files.sort((a, b) => a.localeCompare(b))
  folders.sort((a, b) => a.localeCompare(b))
  return { files, folders }
}
