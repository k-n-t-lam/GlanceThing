import { app } from 'electron'
import axios from 'axios'
import path from 'path'
import fs from 'fs'

import { execAsync, isDev, log } from './utils.js'

export async function getWebAppDir() {
  if (isDev) {
    log('Using local client webapp', 'Client Webapp')
    return path.join(process.cwd(), 'client/dist')
  }

  log('Downloading...', 'Client Webapp')
  const version = app.getVersion()
  const tempDir = app.getPath('temp')

  const zipPath = path.join(tempDir, `glancething-client-v${version}.zip`)
  const extractPath = path.join(tempDir, `glancething-client-v${version}`)

  if (fs.existsSync(zipPath)) fs.rmSync(zipPath)

  if (fs.existsSync(extractPath))
    fs.rmSync(extractPath, { recursive: true })

  const url = `https://github.com/BluDood/GlanceThing/releases/download/v${version}/glancething-client-v${version}.zip`

  const res = await axios.get(url, {
    responseType: 'stream',
    validateStatus: () => true
  })

  if (res.status !== 200) {
    log('Failed to download client webapp', 'Client Webapp')
    return false
  }

  const writeStream = fs.createWriteStream(zipPath)

  res.data.pipe(writeStream)

  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  log('Sucessfully downloaded, extracting...', 'Client Webapp')

  if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath)

  await execAsync(`tar -xf ${zipPath} -C ${extractPath}`)

  log('Done downloading!', 'Client Webapp')

  return extractPath
}
