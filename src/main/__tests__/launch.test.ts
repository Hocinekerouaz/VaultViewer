import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractLaunchTargets } from '../launch'

let dir: string
let appDir: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vv-launch-'))
  appDir = join(dir, 'app')
  await mkdir(appDir)
  await mkdir(join(dir, 'vault'))
  await writeFile(join(dir, 'note.md'), '# note')
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('extractLaunchTargets', () => {
  it('finds a file argument', () => {
    const argv = ['electron', join(dir, 'note.md')]
    const targets = extractLaunchTargets(argv, resolve(appDir))
    expect(targets.file).toBe(resolve(join(dir, 'note.md')))
    expect(targets.dir).toBeNull()
  })

  it('finds a directory argument', () => {
    const argv = ['electron', join(dir, 'vault')]
    const targets = extractLaunchTargets(argv, resolve(appDir))
    expect(targets.dir).toBe(resolve(join(dir, 'vault')))
    expect(targets.file).toBeNull()
  })

  it('skips flags, the app path and missing entries', () => {
    const argv = [
      'electron',
      '--user-data-dir=x',
      appDir,
      join(dir, 'ghost.md'),
      join(dir, 'note.md')
    ]
    const targets = extractLaunchTargets(argv, resolve(appDir))
    expect(targets).toEqual({ dir: null, file: resolve(join(dir, 'note.md')) })
  })

  it('returns both targets when both are passed', () => {
    const argv = ['electron', join(dir, 'vault'), join(dir, 'note.md')]
    const targets = extractLaunchTargets(argv, resolve(appDir))
    expect(targets.dir).toBe(resolve(join(dir, 'vault')))
    expect(targets.file).toBe(resolve(join(dir, 'note.md')))
  })

  it('ignores an argv with only the exe', () => {
    expect(extractLaunchTargets(['electron'], resolve(appDir))).toEqual({ dir: null, file: null })
  })
})
