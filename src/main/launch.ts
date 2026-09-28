import { statSync } from 'node:fs'
import { resolve } from 'node:path'

export interface LaunchTargets {
  dir: string | null
  file: string | null
}

export function extractLaunchTargets(argv: string[], appPath: string): LaunchTargets {
  let dir: string | null = null
  let file: string | null = null
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue
    const abs = resolve(arg)
    if (abs === appPath) continue
    try {
      const info = statSync(abs)
      if (info.isDirectory()) {
        if (!dir) dir = abs
      } else if (info.isFile()) {
        if (!file) file = abs
      }
    } catch {
      continue
    }
  }
  return { dir, file }
}
