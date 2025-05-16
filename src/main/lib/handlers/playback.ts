import { RepeatMode } from '../../types/Playback.js'
import {
  HandlerAction,
  HandlerFunction
} from '../../types/WebSocketHandler.js'
import { playbackManager } from '../playback/playback.js'
import { log, LogLevel, intToRgb } from '../utils.js'

export const name = 'playback'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'pause',
    handle: async () => {
      await playbackManager.pause()
    }
  },
  {
    action: 'play',
    handle: async () => {
      await playbackManager.play()
    }
  },
  {
    action: 'volume',
    handle: async (_ws, data) => {
      await playbackManager.setVolume((data as { volume: number }).volume)
    }
  },
  {
    action: 'image',
    handle: async ws => {
      const image = await playbackManager.getImage()
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'image',
          data: image ? image.toString('base64') : null
        })
      )
    }
  },
  {
    action: 'previous',
    handle: async () => {
      await playbackManager.previous()
    }
  },
  {
    action: 'next',
    handle: async () => {
      await playbackManager.next()
    }
  },
  {
    action: 'shuffle',
    handle: async (_, data) => {
      await playbackManager.shuffle((data as { state: boolean }).state)
    }
  },
  {
    action: 'repeat',
    handle: async (_, data) => {
      await playbackManager.repeat((data as { state: RepeatMode }).state)
    }
  },
  {
    action: 'lyrics',
    handle: async ws => {
      const lyrics = await playbackManager.getLyrics()
      if (!lyrics) return
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'lyrics',
          data: lyrics
        })
      )
    }
  },
  {
    action: 'playlists',
    handle: async (ws, data) => {
      const offset = (data as { offset: number }).offset
      const playlists = await playbackManager.getPlaylists(offset)
      if (!playlists) return
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'playlists',
          data: playlists
        })
      )
    }
  },
  {
    action: 'playlistTracks',
    handle: async (ws, data) => {
      const {
        playlistID,
        offset = 0,
        limit = 50
      } = data as {
        playlistID: string
        offset?: number
        limit?: number
      }

      log(
        `Fetching tracks for playlist ${playlistID} (offset: ${offset}, limit: ${limit})`,
        'Playback',
        LogLevel.DEBUG
      )

      const tracks = await playbackManager.getPlaylistTracks(
        playlistID,
        offset,
        limit
      )
      if (!tracks) return

      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'playlistTracks',
          data: tracks
        })
      )
    }
  },
  {
    action: 'playPlaylist',
    handle: async (_, data) => {
      await playbackManager.playPlaylist(
        (data as { playlistID: string }).playlistID
      )
    }
  },
  {
    action: 'playTrack',
    handle: async (ws, data) => {
      const { trackID, playlistID } = data as {
        trackID: string
        playlistID?: string
      }
      log(
        `Handling playTrack request for track ${trackID}${playlistID ? ` in playlist ${playlistID}` : ''}`,
        'Playback',
        LogLevel.DEBUG
      )

      const result = await playbackManager.playTrack(trackID, playlistID)

      // Send a response back to the client to confirm track is playing
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'trackPlayed',
          data: {
            success: result?.success || true,
            trackID,
            playlistID,
            error: result?.error || null
          }
        })
      )
    }
  }
]

export const handle: HandlerFunction = async ws => {
  const res = await playbackManager.getPlayback()
  ws.send(
    JSON.stringify({
      type: 'playback',
      data: res
    })
  )
}
