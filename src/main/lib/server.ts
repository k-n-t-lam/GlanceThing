import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import cron from 'node-cron'

import SpotifyAPI, { fetchImage, filterData } from '../lib/spotify.js'
import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'
import {
  findOpenPort,
  formatDate,
  getLockPlatformCommand,
  getParsedPlatformCommand,
  isDev,
  log,
  LogLevel,
  safeParse
} from '../lib/utils.js'
import { getShortcutImage, getShortcuts } from './shortcuts.js'
import {
  getSocketPassword,
  getSpotifyDc,
  getStorageValue,
  setStorageValue
} from './storage.js'
import { restore, setAutoBrightness, setBrightnessSmooth } from './adb.js'

let wss: WebSocketServer | null = null

let port: number | null = null

export async function getServerPort() {
  if (port) return port

  port = isDev() ? 1337 : await findOpenPort()

  return port
}

export async function updateTime() {
  if (!wss) return

  wss.clients.forEach(async (ws: AuthenticatedWebSocket) => {
    if (!ws.authenticated) return

    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: 'time',
          data: await formatDate()
        })
      )
    }
  })
}

export async function isServerStarted() {
  return !!wss
}

export async function stopServer() {
  if (wss) {
    wss.clients.forEach(ws => ws.close())
    wss.close()
  }
}

export async function startServer() {
  if (wss) return

  const WS_PASSWORD = getSocketPassword()

  const SPOTIFY_DC = getSpotifyDc()
  const spotify = new SpotifyAPI(SPOTIFY_DC)

  spotify!.on('PLAYER_STATE_CHANGED', data => {
    if (!wss) return
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.authenticated) return

      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'spotify',
            data: filterData(data.state)
          })
        )
      }
    })
  })

  spotify.on('DEVICE_STATE_CHANGED', data => {
    if (data.devices.some(d => d.is_active)) return
    if (!wss) return
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.authenticated) return

      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'spotify',
            data: { session: false }
          })
        )
      }
    })
  })

  const timeJob = cron.schedule('* * * * *', updateTime)

  const port = await getServerPort()

  return new Promise<void>(resolve => {
    wss = new WebSocketServer({ port })

    wss.on('connection', (ws: AuthenticatedWebSocket) => {
      if (getStorageValue('disableSocketAuth') === true)
        ws.authenticated = true

      ws.on('message', async msg => {
        const d = safeParse(msg.toString())
        if (!d) return
        const { type, action, data } = d
        log(
          `Received ${type} ${action ?? ''}`,
          'WebSocketServer',
          LogLevel.DEBUG
        )

        if (type === 'auth') {
          if (data === WS_PASSWORD) {
            ws.authenticated = true
            ws.send(
              JSON.stringify({
                type: 'auth',
                data: 'Authenticated'
              })
            )
          } else {
            ws.send(
              JSON.stringify({
                type: 'error',
                data: 'Unauthorized'
              })
            )
          }
        }

        if (!ws.authenticated)
          return ws.send(
            JSON.stringify({
              type: 'error',
              data: 'Unauthorized'
            })
          )

        if (type === 'time') {
          ws.send(
            JSON.stringify({
              type: 'time',
              data: await formatDate()
            })
          )
        } else if (type === 'spotify') {
          if (!spotify) return
          if (action === 'pause') {
            const res = await spotify.setPlaying(false)
            if (res === false)
              log('Failed to pause', 'Spotify', LogLevel.ERROR)
          } else if (action === 'play') {
            const res = await spotify.setPlaying(true)
            if (res === false)
              log('Failed to play', 'Spotify', LogLevel.ERROR)
          } else if (action === 'volume') {
            const res = await spotify.setVolume(data.amount)
            if (res === false)
              log('Failed to set volume', 'Spotify', LogLevel.ERROR)
          } else if (action === 'image') {
            const res = await fetchImage(data.id)
            ws.send(
              JSON.stringify({
                type: 'spotify',
                action: 'image',
                data: res
              })
            )
          } else if (action === 'previous') {
            const res = await spotify.previous()
            if (res === false)
              log(
                'Failed to go to previous track',
                'Spotify',
                LogLevel.ERROR
              )
          } else if (action === 'next') {
            const res = await spotify.next()
            if (res === false)
              log('Failed to go to next track', 'Spotify', LogLevel.ERROR)
          } else {
            const res = await spotify.getCurrent()
            ws.send(
              JSON.stringify({
                type: 'spotify',
                data: res
              })
            )
          }
        } else if (type === 'apps') {
          const shortcuts = getShortcuts()
          if (action === 'open') {
            const app = shortcuts.find(app => app.id === data)
            if (app) {
              const { cmd, shell } = getParsedPlatformCommand(app.command)

              exec(cmd, {
                shell
              })
            }
          } else if (action === 'image') {
            const res = getShortcutImage(data)
            if (!res) return

            ws.send(
              JSON.stringify({
                type: 'apps',
                action: 'image',
                data: {
                  id: data,
                  image: `data:image/jpeg;base64,${Buffer.from(
                    res
                  ).toString('base64')}`
                }
              })
            )
          } else {
            ws.send(
              JSON.stringify({
                type: 'apps',
                data: shortcuts
              })
            )
          }
        } else if (type === 'restore') {
          setStorageValue('installAutomatically', false)
          await restore(null)
        } else if (type === 'lock') {
          const { cmd, shell } = getLockPlatformCommand()

          exec(cmd, {
            shell
          })
        } else if (type === 'sleep') {
          const sleepMethod = getStorageValue('sleepMethod') ?? 'sleep'
          ws.send(
            JSON.stringify({
              type: 'sleep',
              data: sleepMethod
            })
          )

          await setAutoBrightness(null, false)
          if (sleepMethod === 'sleep') {
            await setBrightnessSmooth(null, 0, 10)
          } else if (sleepMethod === 'screensaver') {
            await setBrightnessSmooth(null, 0.1, 10)
          }
        } else if (type === 'wake') {
          await setAutoBrightness(null, true)
        }
      })
    })

    wss.on('close', () => {
      timeJob.stop()
      spotify.close()
      wss = null

      log('Closed', 'WebSocketServer')
    })

    wss.on('listening', () => {
      log(`Started on port ${port}`, 'WebSocketServer')
      resolve()
    })
  })
}

export async function updateApps() {
  if (!wss) return

  wss.clients.forEach(async (ws: AuthenticatedWebSocket) => {
    if (!ws.authenticated) return

    ws.send(
      JSON.stringify({
        type: 'apps',
        data: getShortcuts()
      })
    )
  })
}
