import { exec } from 'child_process'
import { app } from 'electron'
import { platform } from 'os'
import crypto from 'crypto'
import path from 'path'
import net from 'net'
import fs from 'fs'

import { getStorageValue } from './storage.js'

export const isDev = () => getStorageValue('devMode') === true

export const random = (len: number) =>
  crypto.randomBytes(len).toString('hex')

export async function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

let logPath: string | null = null

export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

const logLevelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR']

let logLevel = LogLevel.INFO

export function setLogLevel(level: LogLevel) {
  logLevel = level
}

export function getLogLevel() {
  return logLevel
}

export function log(text: string, scope?: string, level = LogLevel.INFO) {
  if (level < logLevel) return

  if (!logPath)
    logPath = path.join(app.getPath('userData'), 'glancething.log')

  const time = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })

  const levelName = logLevelNames[level]

  const log = `[${time}] ${levelName}${scope ? ` <${scope}>:` : ''} ${text}`

  console.log(log)
  fs.appendFileSync(logPath, log + '\n')
}

export function safeParse(json: string) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function findOpenPort() {
  return new Promise<number>(resolve => {
    const server = net.createServer()

    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

export function getParsedPlatformCommand(command: string) {
  const os = platform()

  switch (os) {
    case 'darwin':
      return { cmd: command, shell: '/bin/sh' }

    default:
      return { cmd: `& ${command}`, shell: 'powershell.exe' }
  }
}

export function getLockPlatformCommand() {
  const os = platform()

  switch (os) {
    case 'darwin':
      return {
        cmd: 'pmset displaysleepnow',
        shell: '/bin/sh'
      }

    default:
      return {
        cmd: 'rundll32.exe user32.dll,LockWorkStation',
        shell: 'powershell.exe'
      }
  }
}

export function getPlatformADB() {
  const os = platform()

  switch (os) {
    case 'darwin':
      return {
        downloadURL:
          'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
        executable: 'adb'
      }

    default:
      return {
        downloadURL:
          'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
        executable: 'adb.exe'
      }
  }
}

export function getPlatformTar() {
  const os = platform()

  switch (os) {
    case 'win32':
      return `${process.env.SystemRoot}\\System32\\tar.exe`

    default:
      return 'tar'
  }
}
