import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { scanVault } from '../scanner'

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vv-scan-'))
  await writeFile(join(dir, 'note.md'), '# hi')
  await writeFile(join(dir, 'list.txt'), 'a')
  await writeFile(join(dir, 'data.json'), '{}')
  await writeFile(join(dir, 'config.yaml'), 'a: 1')
  await writeFile(join(dir, 'more.yml'), 'a: 1')
  await writeFile(join(dir, 'table.csv'), 'a,b')
  await writeFile(join(dir, 'image.png'), 'x')
  await writeFile(join(dir, 'doc.pdf'), 'x')
  await writeFile(join(dir, 'README'), 'no extension')
  await mkdir(join(dir, 'projects'))
  await mkdir(join(dir, 'projects', 'deep'))
  await writeFile(join(dir, 'projects', 'deep', 'inner.md'), '# in')
  await mkdir(join(dir, '.git'))
  await writeFile(join(dir, '.git', 'config.md'), 'x')
  await mkdir(join(dir, 'node_modules'))
  await writeFile(join(dir, 'node_modules', 'dep.md'), 'x')
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('scanVault', () => {
  it('returns only the six supported file formats', async () => {
    const { files } = await scanVault(dir)
    expect(new Set(files)).toEqual(
      new Set([
        'config.yaml',
        'data.json',
        'list.txt',
        'more.yml',
        'note.md',
        'table.csv',
        'projects/deep/inner.md'
      ])
    )
    expect(files).toHaveLength(7)
  })

  it('hides images, pdfs and extensionless files', async () => {
    const { files } = await scanVault(dir)
    expect(files.some((path) => path.endsWith('.png'))).toBe(false)
    expect(files.some((path) => path.endsWith('.pdf'))).toBe(false)
    expect(files.some((path) => path === 'README')).toBe(false)
  })

  it('returns folders including empty ones but skipping ignored dirs', async () => {
    const { folders } = await scanVault(dir)
    expect(new Set(folders)).toEqual(new Set(['projects', 'projects/deep']))
  })
})
