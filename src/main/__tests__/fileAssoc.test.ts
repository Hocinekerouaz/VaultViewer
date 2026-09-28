import { describe, expect, it } from 'vitest'
import { PROGID, registryCommands, runRegistry } from '../fileAssoc'

const EXE = 'C:\\Program Files\\Vault Viewer\\Vault Viewer.exe'
const APP_PATH = 'G:\\Projects\\Desktop Apps\\Vault Viewer'
const EXTS = ['.md', '.txt', '.json', '.yaml', '.yml', '.csv']

describe('registryCommands', () => {
  it('builds a quoted command without an app path for packaged builds', () => {
    const plan = registryCommands(['.md'], EXE, null)
    const command = plan.add.find((args) => args[1]?.endsWith('shell\\open\\command'))
    expect(command).toEqual([
      'add',
      `HKCU\\Software\\Classes\\${PROGID}\\shell\\open\\command`,
      '/ve',
      '/d',
      '"C:\\Program Files\\Vault Viewer\\Vault Viewer.exe" "%1"',
      '/f'
    ])
  })

  it('includes the app path in dev so electron.exe loads the project', () => {
    const plan = registryCommands(['.md'], 'C:\\electron.exe', APP_PATH)
    const command = plan.add.find((args) => args[1]?.endsWith('shell\\open\\command'))
    expect(command?.[4]).toBe(
      '"C:\\electron.exe" "G:\\Projects\\Desktop Apps\\Vault Viewer" "%1"'
    )
  })

  it('registers the progid display name and icon', () => {
    const plan = registryCommands(['.md'], EXE, null)
    expect(plan.add).toContainEqual([
      'add',
      `HKCU\\Software\\Classes\\${PROGID}`,
      '/ve',
      '/d',
      'Vault Viewer Document',
      '/f'
    ])
    expect(plan.add).toContainEqual([
      'add',
      `HKCU\\Software\\Classes\\${PROGID}\\DefaultIcon`,
      '/ve',
      '/d',
      '"C:\\Program Files\\Vault Viewer\\Vault Viewer.exe",0',
      '/f'
    ])
  })

  it('adds an OpenWithProgids entry for every supported extension', () => {
    const plan = registryCommands(EXTS, EXE, null)
    for (const ext of EXTS) {
      expect(plan.add).toContainEqual([
        'add',
        `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`,
        '/v',
        PROGID,
        '/d',
        '',
        '/f'
      ])
    }
  })

  it('removal deletes the progid tree and every extension value', () => {
    const plan = registryCommands(EXTS, EXE, null)
    expect(plan.remove[0]).toEqual(['delete', `HKCU\\Software\\Classes\\${PROGID}`, '/f'])
    for (const ext of EXTS) {
      expect(plan.remove).toContainEqual([
        'delete',
        `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`,
        '/v',
        PROGID,
        '/f'
      ])
    }
    expect(plan.remove).toHaveLength(1 + EXTS.length)
  })

  it('accepts extensions without a leading dot', () => {
    const plan = registryCommands(['md'], EXE, null)
    expect(plan.add.some((args) => args[1] === 'HKCU\\Software\\Classes\\.md\\OpenWithProgids')).toBe(
      true
    )
  })
})

describe('runRegistry', () => {
  it('resolves without running anything for an empty plan', async () => {
    await expect(runRegistry([])).resolves.toBeUndefined()
  })
})
