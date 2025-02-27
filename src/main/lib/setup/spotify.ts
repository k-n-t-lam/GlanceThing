import { filterData, setupSpotify } from '../spotify.js'
import { getSpotifyDc } from '../storage.js'
import { wss } from '../server.js'

import { AuthenticatedWebSocket } from '../../types/WebSocketServer.js'
import { SetupFunction } from '../../types/WebSocketSetup.js'

export const name = 'spotify'

export const setup: SetupFunction = async () => {
  const SPOTIFY_DC = getSpotifyDc()
  const spotify = setupSpotify(SPOTIFY_DC)

  spotify.on('PLAYER_STATE_CHANGED', data => {
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

  await spotify.start()

  return async () => {
    spotify.close()
  }
}
