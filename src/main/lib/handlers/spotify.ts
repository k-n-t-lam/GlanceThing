import { fetchImage, spotify } from '../spotify.js'
import { log, LogLevel } from '../utils.js'

import {
  HandlerAction,
  HandlerFunction
} from '../../types/WebSocketHandler.js'

export const name = 'spotify'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'pause',
    handle: async () => {
      const res = await spotify!.setPlaying(false)
      if (res === false) log('Failed to pause', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'play',
    handle: async () => {
      const res = await spotify!.setPlaying(true)
      if (res === false) log('Failed to play', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'volume',
    handle: async (_ws, data) => {
      const res = await spotify!.setVolume(
        (data as { amount: number }).amount
      )
      if (res === false)
        log('Failed to set volume', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'image',
    handle: async (ws, data) => {
      const res = await fetchImage((data as { id: string }).id)
      ws.send(
        JSON.stringify({
          type: 'spotify',
          action: 'image',
          data: res
        })
      )
    }
  },
  {
    action: 'previous',
    handle: async () => {
      const res = await spotify!.previous()
      if (res === false)
        log('Failed to go to previous track', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'next',
    handle: async () => {
      const res = await spotify!.next()
      if (res === false)
        log('Failed to go to next track', 'Spotify', LogLevel.ERROR)
    }
  }
]

export const handle: HandlerFunction = async ws => {
  const res = await spotify!.getCurrent()
  ws.send(
    JSON.stringify({
      type: 'spotify',
      data: res
    })
  )
}
