import { BrowserWindow, Menu, app, net, protocol, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { appState } from './context'
import { cleanupVault, openVaultByPath, openVaultFromMenu, registerIpc } from './ipc'

const mainDir = dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function registerAssetProtocol(): void {
  protocol.handle('vault-asset', (request) => {
    const root = appState.root
    if (!root) return new Response('No vault open', { status: 404 })
    try {
      const url = new URL(request.url)
      const rel = decodeURIComponent(url.pathname.replace(/^\//, ''))
      const base = resolve(root)
      const abs = resolve(base, rel)
      const prefix = base.endsWith(sep) ? base : base + sep
      if (abs !== base && !abs.startsWith(prefix)) {
        return new Response('Forbidden', { status: 403 })
      }
      if (!existsSync(abs)) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(abs).toString())
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Vault…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openVaultFromMenu()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function resolvePreload(): string {
  const esmPreload = join(mainDir, '../preload/index.mjs')
  if (existsSync(esmPreload)) return esmPreload
  return join(mainDir, '../preload/index.js')
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#f7f4ee',
    show: false,
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  appState.window = win

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.once('ready-to-show', () => win.show())

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(mainDir, '../renderer/index.html'))
  }

  win.on('closed', () => {
    if (appState.window === win) appState.window = null
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (appState.window) {
      if (appState.window.isMinimized()) appState.window.restore()
      appState.window.focus()
    }
  })

  void app.whenReady().then(() => {
    appState.userData = app.getPath('userData')
    registerAssetProtocol()
    registerIpc()
    buildMenu()
    createWindow()

    const appPath = resolve(app.getAppPath())
    const cliArg = process.argv
      .slice(1)
      .filter((arg) => !arg.startsWith('-'))
      .find((arg) => {
        const abs = resolve(arg)
        if (abs === appPath) return false
        try {
          return statSync(abs).isDirectory()
        } catch {
          return false
        }
      })
    if (cliArg) {
      setTimeout(() => {
        void openVaultByPath(resolve(cliArg))
      }, 250)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    cleanupVault()
  })
}
