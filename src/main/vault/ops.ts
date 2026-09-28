import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { insideRoot } from '../fsutil'
import type { OpResult } from '../../shared/types'

const INVALID_NAME = /[\\/:*?"<>|]/
const MAX_NAME = 255

export function isValidName(name: string): boolean {
  if (!name || name.length > MAX_NAME) return false
  if (name === '.' || name === '..') return false
  if (name.startsWith('.')) return false
  if (INVALID_NAME.test(name)) return false
  if (name !== name.trim()) return false
  if (/[. ]$/.test(name)) return false
  return true
}

function fail(error: string): OpResult {
  return { ok: false, error }
}

function fsFail(error: unknown, fallback: string): OpResult {
  const code = (error as NodeJS.ErrnoException)?.code
  if (code === 'EEXIST') return fail('An item with that name already exists')
  if (code === 'ENOENT') return fail('The target folder no longer exists')
  if (code === 'ENOTDIR') return fail('That path is not a folder')
  if (code === 'EPERM' || code === 'EACCES') return fail('Permission denied')
  return fail(fallback)
}

export async function createFolder(root: string, parentRel: string, name: string): Promise<OpResult> {
  if (!isValidName(name)) return fail('Invalid folder name')
  const parentAbs = parentRel ? insideRoot(root, parentRel) : root
  if (!parentAbs) return fail('Invalid folder path')
  const relPath = parentRel ? `${parentRel}/${name}` : name
  const abs = insideRoot(root, relPath)
  if (!abs) return fail('Invalid folder path')
  try {
    await mkdir(abs)
    return { ok: true, path: relPath }
  } catch (error) {
    return fsFail(error, 'Could not create the folder')
  }
}

export async function renamePath(root: string, relPath: string, newName: string): Promise<OpResult> {
  if (!relPath || relPath === '.' || relPath === '..') return fail('Invalid item path')
  if (!isValidName(newName)) return fail('Invalid name')
  const srcAbs = insideRoot(root, relPath)
  if (!srcAbs || srcAbs === resolve(root)) return fail('Invalid item path')
  try {
    await stat(srcAbs)
  } catch {
    return fail('That item no longer exists')
  }
  const cut = relPath.lastIndexOf('/')
  const parentRel = cut === -1 ? '' : relPath.slice(0, cut)
  const oldName = cut === -1 ? relPath : relPath.slice(cut + 1)
  if (newName === oldName) return { ok: true, path: relPath }
  const nextRel = parentRel ? `${parentRel}/${newName}` : newName
  const dstAbs = insideRoot(root, nextRel)
  if (!dstAbs) return fail('Invalid name')
  try {
    await stat(dstAbs)
    return fail('An item with that name already exists')
  } catch {
    void 0
  }
  try {
    await rename(srcAbs, dstAbs)
    return { ok: true, path: nextRel }
  } catch (error) {
    return fsFail(error, 'Could not rename the item')
  }
}

export async function writeNote(root: string, relPath: string, content: string): Promise<OpResult> {
  if (!relPath || relPath === '.' || relPath === '..') return fail('Invalid file path')
  const abs = insideRoot(root, relPath)
  if (!abs || abs === resolve(root)) return fail('Invalid file path')
  try {
    const info = await stat(abs)
    if (info.isDirectory()) return fail('That path is a folder')
  } catch {
    void 0
  }
  try {
    await writeFile(abs, content, 'utf8')
    return { ok: true, path: relPath }
  } catch (error) {
    return fsFail(error, 'Could not save the file')
  }
}

async function requireFolder(root: string, parentRel: string): Promise<string | null> {
  const parentAbs = parentRel ? insideRoot(root, parentRel) : root
  if (!parentAbs) return null
  try {
    const info = await stat(parentAbs)
    if (!info.isDirectory()) return null
  } catch {
    return null
  }
  return parentAbs
}

export async function createNote(root: string, parentRel: string, name: string): Promise<OpResult> {
  const base = name.replace(/\.md$/i, '')
  if (!isValidName(base)) return fail('Invalid note name')
  const parentAbs = await requireFolder(root, parentRel)
  if (!parentAbs) return fail('The target folder no longer exists')
  const relPath = parentRel ? `${parentRel}/${base}.md` : `${base}.md`
  const abs = insideRoot(root, relPath)
  if (!abs) return fail('Invalid folder path')
  try {
    await writeFile(abs, `# ${base}\n`, { flag: 'wx' })
    return { ok: true, path: relPath }
  } catch (error) {
    return fsFail(error, 'Could not create the note')
  }
}

export async function duplicateNote(root: string, relPath: string): Promise<OpResult> {
  if (!relPath || relPath === '.' || relPath === '..') return fail('Invalid file path')
  const srcAbs = insideRoot(root, relPath)
  if (!srcAbs || srcAbs === resolve(root)) return fail('Invalid file path')
  try {
    const info = await stat(srcAbs)
    if (info.isDirectory()) return fail('Only files can be duplicated')
  } catch {
    return fail('That item no longer exists')
  }
  const slash = relPath.lastIndexOf('/')
  const parentRel = slash === -1 ? '' : relPath.slice(0, slash)
  const name = relPath.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const content = await readFile(srcAbs, 'utf8')
  for (let i = 1; i <= 999; i++) {
    const suffix = i === 1 ? ' copy' : ` copy ${i}`
    const candidate = `${stem}${suffix}${ext}`
    const nextRel = parentRel ? `${parentRel}/${candidate}` : candidate
    const dstAbs = insideRoot(root, nextRel)
    if (!dstAbs) break
    try {
      await writeFile(dstAbs, content, { flag: 'wx' })
      return { ok: true, path: nextRel }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') return fsFail(error, 'Could not duplicate the file')
    }
  }
  return fail('Could not find a free name for the copy')
}

export async function movePath(
  root: string,
  relPath: string,
  destFolderRel: string
): Promise<OpResult> {
  if (!relPath || relPath === '.' || relPath === '..') return fail('Invalid item path')
  const srcAbs = insideRoot(root, relPath)
  if (!srcAbs || srcAbs === resolve(root)) return fail('Invalid item path')
  try {
    await stat(srcAbs)
  } catch {
    return fail('That item no longer exists')
  }
  const destAbs = await requireFolder(root, destFolderRel)
  if (!destAbs) return fail('The target folder no longer exists')
  const isDir = (await stat(srcAbs)).isDirectory()
  if (isDir && (destFolderRel === relPath || destFolderRel.startsWith(`${relPath}/`)))
    return fail('Cannot move a folder into itself')
  const name = relPath.slice(relPath.lastIndexOf('/') + 1)
  const nextRel = destFolderRel ? `${destFolderRel}/${name}` : name
  if (nextRel === relPath) return { ok: true, path: relPath }
  const dstAbs = insideRoot(root, nextRel)
  if (!dstAbs) return fail('Invalid folder path')
  try {
    await stat(dstAbs)
    return fail('An item with that name already exists')
  } catch {
    void 0
  }
  try {
    await rename(srcAbs, dstAbs)
    return { ok: true, path: nextRel }
  } catch (error) {
    return fsFail(error, 'Could not move the item')
  }
}
