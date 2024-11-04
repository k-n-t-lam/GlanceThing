import { WebSocketServer } from 'ws'
import { exec } from 'child_process'
import cron from 'node-cron'

import SpotifyAPI, { fetchImage, filterData } from '../lib/spotify.js'
import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'
import {
  findOpenPort,
  formatDate,
  getLockedPlatformCommand,
  getParsedPlatformCommand,
  isDev,
  log,
  safeParse
} from '../lib/utils.js'
import { getShortcutImage, getShortcuts } from './shortcuts.js'
import {
  getSocketPassword,
  getSpotifyDc,
  getStorageValue,
  setStorageValue
} from './storage.js'
import { restore } from './adb.js'

let wss: WebSocketServer | null = null

let port: number | null = null

export async function getServerPort() {
  if (port) return port

  port = (await isDev()) ? 1337 : await findOpenPort()

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

  const WS_PASSWORD = await getSocketPassword()

  const SPOTIFY_DC = await getSpotifyDc()
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

  const timeJob = cron.schedule('* * * * *', updateTime)

  const port = await getServerPort()

  return new Promise<void>(resolve => {
    wss = new WebSocketServer({ port })

    wss.on('connection', async (ws: AuthenticatedWebSocket) => {
      if ((await getStorageValue('disableSocketAuth')) === true)
        ws.authenticated = true

      ws.on('message', async msg => {
        const d = safeParse(msg.toString())
        if (!d) return
        const { type, action, data } = d
        log(`Received ${type} ${action ?? ''}`, 'WebSocketServer')

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
            if (res === false) log('Failed to pause', 'Spotify')
          } else if (action === 'play') {
            const res = await spotify.setPlaying(true)
            if (res === false) log('Failed to play', 'Spotify')
          } else if (action === 'volume') {
            const res = await spotify.setVolume(data.amount)
            if (res === false) log('Failed to set volume', 'Spotify')
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
              log('Failed to go to previous track', 'Spotify')
          } else if (action === 'next') {
            const res = await spotify.next()
            if (res === false) log('Failed to go to next track', 'Spotify')
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
          const shortcuts = await getShortcuts()
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
          await setStorageValue('installAutomatically', false)
          await restore(null)
        } else if (type === 'lock') {
          const { cmd, shell } = getLockedPlatformCommand()

          exec(cmd, {
            shell
          })
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
        data: await getShortcuts()
      })
    )
  })
}
