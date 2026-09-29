import { app, BrowserWindow, nativeImage } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', 'assets')

function toIco(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0)
  entry.writeUInt8(0, 1)
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

app.whenReady().then(async () => {
  mkdirSync(assets, { recursive: true })
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    skipTaskbar: true,
    backgroundColor: '#00000000'
  })
  await win.loadFile(join(here, 'icon.html'))
  await new Promise((resolve) => setTimeout(resolve, 400))
  const image = await win.webContents.capturePage()
  const full = image.toPNG()
  const small = nativeImage.createFromBuffer(full).resize({ width: 256, height: 256, quality: 'good' })
  const png = small.toPNG()
  writeFileSync(join(assets, 'icon-256.png'), png)
  writeFileSync(join(assets, 'icon.ico'), toIco(png))
  win.destroy()
  app.quit()
})
