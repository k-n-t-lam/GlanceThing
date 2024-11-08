import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

import { log, random, safeParse } from './utils.js'
import { setAutoBrightness } from './adb.js'
import { updateTime } from './server.js'

let storage = {}

const storageValueHandlers: Record<string, (value: unknown) => void> = {
  launchOnStartup: async value => {
    app.setLoginItemSettings({
      openAtLogin: value as boolean
    })
  },
  timeFormat: updateTime,
  dateFormat: updateTime,
  autoBrightness: async value => {
    await setAutoBrightness(null, value as boolean)
  }
}

async function getStoragePath() {
  const userDataPath = app.getPath('userData')
  const storagePath = path.join(userDataPath, 'storage.json')

  if (!fs.existsSync(storagePath))
    fs.writeFileSync(storagePath, '{}', 'utf8')

  return storagePath
}

export async function loadStorage() {
  log('Loading storage file', 'Storage')
  const storagePath = await getStoragePath()
  const content = fs.readFileSync(storagePath, 'utf8')
  const parsed = safeParse(content)

  if (parsed) {
    storage = parsed
  } else {
    log('Failed to parse storage file, using empty object.', 'Storage')
    storage = {}
  }
}

async function writeStorage(storage: Record<string, unknown>) {
  const storagePath = await getStoragePath()
  fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf8')
}

export async function getStorageValue(key: string, secure = false) {
  log(`Getting value for key: ${key}`, 'Storage')
  const value = storage[key]

  if (value === undefined) return null

  if (secure) {
    if (!safeStorage.isEncryptionAvailable()) {
      log(
        'WARNING: Encryption is not available, returning value as is.',
        'Storage'
      )
      return value
    }
    return safeStorage.decryptString(Buffer.from(value, 'hex')).toString()
  } else {
    return value
  }
}

export async function setStorageValue(
  key: string,
  value: unknown,
  secure = false
) {
  log(`Setting value for key: ${key}`, 'Storage')
  if (secure) {
    if (!safeStorage.isEncryptionAvailable()) {
      log(
        'WARNING: Encryption is not available, storing value as is.',
        'Storage'
      )
    } else {
      value = safeStorage.encryptString(String(value)).toString('hex')
    }
  }

  storage[key] = value

  await writeStorage(storage)

  const handler = storageValueHandlers[key]

  if (handler) {
    log(`Running handler for key: ${key}`, 'Storage')
    handler(value)
  }
}

export async function getSocketPassword() {
  let socketPassword = await getStorageValue('socketPassword', true)
  if (!socketPassword) {
    socketPassword = random(64)
    await setStorageValue('socketPassword', socketPassword, true)
  }
  return socketPassword
}

export async function getSpotifyDc() {
  return getStorageValue('sp_dc', true)
}

export async function setSpotifyDc(dc: string) {
  return setStorageValue('sp_dc', dc, true)
}
