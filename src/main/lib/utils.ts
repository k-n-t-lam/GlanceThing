import { exec } from 'child_process'
import crypto from 'crypto'

import { getStorageValue } from './storage.js'

export const isDev = async () =>
  (await getStorageValue('devMode')) === true

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

export function log(text: string, name?: string) {
  const time = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })

  console.log(`[${time}]${name ? ` <${name}>:` : ''} ${text}`)
}

export function safeParse(json: string) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function formatDate(d = new Date()) {
  const time = d.toLocaleTimeString([], {
    hour12: false,
    hour: 'numeric',
    minute: 'numeric'
  })

  const date = d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  return {
    time,
    date
  }
}
