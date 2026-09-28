import { execFile } from 'node:child_process'

export const PROGID = 'VaultViewer.File'

export interface RegistryPlan {
  add: string[][]
  remove: string[][]
}

function quote(value: string): string {
  return `"${value}"`
}

export function registryCommands(exts: string[], exe: string, appPath: string | null): RegistryPlan {
  const command = appPath ? `${quote(exe)} ${quote(appPath)} "%1"` : `${quote(exe)} "%1"`
  const progidKey = `HKCU\\Software\\Classes\\${PROGID}`
  const add: string[][] = [
    ['add', `${progidKey}\\shell\\open\\command`, '/ve', '/d', command, '/f'],
    ['add', progidKey, '/ve', '/d', 'Vault Viewer Document', '/f'],
    ['add', `${progidKey}\\DefaultIcon`, '/ve', '/d', `${quote(exe)},0`, '/f']
  ]
  const remove: string[][] = [['delete', progidKey, '/f']]
  for (const ext of exts) {
    const clean = ext.startsWith('.') ? ext.slice(1) : ext
    add.push([
      'add',
      `HKCU\\Software\\Classes\\.${clean}\\OpenWithProgids`,
      '/v',
      PROGID,
      '/d',
      '',
      '/f'
    ])
    remove.push([
      'delete',
      `HKCU\\Software\\Classes\\.${clean}\\OpenWithProgids`,
      '/v',
      PROGID,
      '/f'
    ])
  }
  return { add, remove }
}

export async function runRegistry(commands: string[][]): Promise<void> {
  if (process.platform !== 'win32') return
  for (const args of commands) {
    await new Promise<void>((resolveRun) => {
      execFile('reg.exe', args, { windowsHide: true }, () => resolveRun())
    })
  }
}
