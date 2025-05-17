import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback
} from 'react'

import { SocketContext } from './SocketContext.tsx'

import { PlaybackData, RepeatMode } from '@/types/Playback.js'
import { AppStateContext } from './AppStateContext.tsx'

interface LyricsLine {
  startTimeMs: string
  endTimeMs: string
  words: string
  syllables: {
    startTimeMs: string
    endTimeMs: string
    text: string
  }[]
}

interface rgbColor {
  r: number
  g: number
  b: number
  a?: number
}

interface SpotifyLyricsData {
  lyrics: {
    syncType: string
    lines: LyricsLine[]
  }
  colors: {
    background: rgbColor
    text: rgbColor
    highlightText: rgbColor
  }
  hasVocalRemoval: boolean
  message: string
}

interface SpotifyPlaylistsItems {
  owner: {
    id: string
    display_name: string
  }
  id: string
  name: string
  description: string
  image: string
  tracks: {
    total: number
  }
}

interface MediaContextProps {
  image: string | null
  playerData: PlaybackData | null
  playerDataRef: React.MutableRefObject<PlaybackData | null>
  lyricsData: SpotifyLyricsData | null
  currentLineIndex: number
  playlistsData: SpotifyPlaylistsItems[] | null
  playlistsOffset: number
  playlistsTotal: number
  playlistsLoading: boolean
  setPlaylistsData?: React.Dispatch<
    React.SetStateAction<SpotifyPlaylistsItems[] | null>
  >
  setPlaylistsOffset?: React.Dispatch<React.SetStateAction<number>>
  setPlaylistsLoading?: React.Dispatch<React.SetStateAction<boolean>>
  actions: {
    playPause: () => void
    skipForward: () => void
    skipBackward: () => void
    setVolume: (volume: number) => void
    shuffle: (state: boolean) => void
    repeat: (state: RepeatMode) => void
    getPlaylists: (offset: number) => void
    playPlaylist: (playlistID: string) => void
  }
}

const MediaContext = createContext<MediaContextProps>({
  image: null,
  playerData: null,
  playerDataRef: { current: null },
  lyricsData: null,
  currentLineIndex: -1,
  playlistsData: null,
  playlistsOffset: 0,
  playlistsTotal: 0,
  playlistsLoading: false,
  setPlaylistsData: () => {},
  setPlaylistsOffset: () => {},
  setPlaylistsLoading: () => {},
  actions: {
    playPause: () => {},
    skipForward: () => {},
    skipBackward: () => {},
    setVolume: () => {},
    shuffle: () => {},
    repeat: () => {},
    getPlaylists: () => {},
    playPlaylist: () => {}
  }
})

interface MediaContextProviderProps {
  children: React.ReactNode
}

const MediaContextProvider = ({ children }: MediaContextProviderProps) => {
  const { ready, socket } = useContext(SocketContext)
  const { showLyricsWidget } = useContext(AppStateContext)
  const socketRef = useRef<WebSocket | null>(null)

  const [playerData, setPlayerData] = useState<PlaybackData | null>(null)
  const playerDataRef = useRef<PlaybackData | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [lyricsData, setLyricsData] = useState<SpotifyLyricsData | null>(
    null
  )
  const [playlistsData, setPlaylistsData] = useState<
    SpotifyPlaylistsItems[] | null
  >(null)
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1)
  const [playlistsOffset, setPlaylistsOffset] = useState(0)
  const [playlistsTotal, setPlaylistsTotal] = useState(0)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)

  useEffect(() => {
    if (
      !playerData?.isPlaying ||
      !lyricsData?.lyrics?.lines ||
      lyricsData.lyrics.lines.length === 0
    )
      return

    const currentTime = playerData.track?.duration.current

    let foundIndex = -1
    const lines = lyricsData.lyrics.lines

    if (currentTime < parseInt(lines[0].startTimeMs)) {
      if (currentLineIndex !== -1) {
        setCurrentLineIndex(-1)
      }
      return
    }

    for (let i = 0; i < lines.length; i++) {
      const startMs = parseInt(lines[i].startTimeMs)
      const endMs = parseInt(lines[i].endTimeMs) || startMs

      if (currentTime >= startMs && currentTime <= endMs) {
        foundIndex = i
        break
      }

      if (currentTime < startMs && i > 0) {
        foundIndex = i - 1
        break
      }
    }

    if (foundIndex !== currentLineIndex) {
      setCurrentLineIndex(foundIndex)
    }
  }, [playerData, lyricsData, currentLineIndex])

  const hasTrackChanged = useCallback((newData: PlaybackData) => {
    const currentTrack = playerDataRef.current?.track
    const newTrack = newData.track
    if (!currentTrack) return true
    if (currentTrack.id !== newTrack.id) return true
    for (let i = 0; i < currentTrack.artists.length; i++) {
      if (currentTrack.artists[i] !== newTrack.artists[i]) return true
    }

    return false
  }, [])

  const handleSocketMessage = useCallback(
    (e: MessageEvent) => {
      try {
        const { type, action, data } = JSON.parse(e.data)
        if (type !== 'playback') return
        if (action === 'trackPlayed') return
        if (action === 'image') {
          if (!data) return setImage(null)
          setImage(`data:image/png;base64,${data}`)
          return
        }

        if (action === 'lyrics') {
          setLyricsData(data)
          return
        }

        if (action === 'playlists') {
          console.log(
            `Received playlists data with offset: ${data.offset}, items: ${data.items?.length || 0}, total: ${data.total}`
          )
          console.log('Raw playlists data:', data)

          // Check if this is a new request (offset === 0) or continuation
          const isNewRequest = data.offset === 0

          // Make sure data.items exists and is an array
          if (!data.items || !Array.isArray(data.items)) {
            console.error('Invalid playlists data received:', data)
            setPlaylistsLoading(false)
            return
          }

          setPlaylistsData(prevData => {
            // If this is a new request or we don't have any data yet, just use the new data
            if (isNewRequest || prevData === null) {
              return data.items
            }
            // Otherwise, append the new data to the existing data
            // Create a map of existing IDs to avoid duplicates
            const existingIds = new Set(prevData.map(item => item.id))
            const uniqueNewItems = data.items.filter(
              (item: { id: string }) => !existingIds.has(item.id)
            )
            console.log(
              `Adding ${uniqueNewItems.length} unique new items to existing ${prevData.length} items`
            )
            return [...prevData, ...uniqueNewItems]
          })

          // Set the offset to what the API returned plus the number of items
          setPlaylistsOffset(data.offset + data.items.length)
          setPlaylistsTotal(data.total)
          setPlaylistsLoading(false)
          return
        }

        if (!data) {
          setPlayerData(null)
          setLyricsData(null)
          return
        }

        if (hasTrackChanged(data)) {
          socket?.send(
            JSON.stringify({ type: 'playback', action: 'image' })
          )
          if (showLyricsWidget) {
            socket?.send(
              JSON.stringify({ type: 'playback', action: 'lyrics' })
            )
          }
        }

        setPlayerData(prevData => {
          if (!prevData) return data
          const hasChanged =
            hasTrackChanged(data) ||
            prevData.isPlaying !== data.isPlaying ||
            prevData.volume !== data.volume ||
            prevData.shuffle !== data.shuffle ||
            prevData.repeat !== data.repeat ||
            prevData.track.duration.current !==
              data.track.duration.current ||
            prevData.track.duration.total !== data.track.duration.total

          return hasChanged ? data : prevData
        })
      } catch (err) {
        console.error('Error parsing message:', err)
      }
    },
    [hasTrackChanged, showLyricsWidget, socket]
  )

  useEffect(() => {
    if (socketRef.current && socketRef.current !== socket) {
      const prevSocket = socketRef.current
      prevSocket.removeEventListener('message', handleSocketMessage)
    }
    socketRef.current = socket
    if (ready === true && socket) {
      socket.addEventListener('message', handleSocketMessage)
      const refreshInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'playback'
            })
          )
        }
      }, 10000)
      return () => {
        socket.removeEventListener('message', handleSocketMessage)
        clearInterval(refreshInterval)
      }
    }
    return () => {
      socketRef.current = null
    }
  }, [ready, socket, handleSocketMessage])

  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'playback'
        })
      )
    }
  }, [socket])

  useEffect(() => {
    if (!playerData || !playerData.isPlaying) return
    const interval = setInterval(() => {
      setPlayerData(p => {
        if (!p || p.track.duration.current >= p.track.duration.total)
          return p
        return {
          ...p,
          track: {
            ...p.track,
            duration: {
              ...p.track.duration,
              current: p.track.duration.current + 1000
            }
          }
        }
      })
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [playerData])

  useEffect(() => {
    playerDataRef.current = playerData
  }, [playerData])

  type CommandData = {
    volume?: number
    state?: boolean | RepeatMode
    playlistID?: string
    offset?: number
  }
  const sendSocketCommand = useCallback(
    (type: string, action: string, data?: CommandData) => {
      const currentSocket = socket || socketRef.current
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN)
        return false
      console.log('Sending command:', type, action, data)
      currentSocket.send(
        JSON.stringify({
          type,
          action,
          data
        })
      )

      return true
    },
    [socket]
  )

  const actions = {
    playPause: () => {
      if (playerDataRef.current === null) return

      if (
        sendSocketCommand(
          'playback',
          playerDataRef.current?.isPlaying ? 'pause' : 'play'
        )
      ) {
        setPlayerData({
          ...playerDataRef.current!,
          isPlaying: !playerDataRef.current?.isPlaying
        })
      }
    },
    skipForward: () => {
      if (playerDataRef.current === null) return
      sendSocketCommand('playback', 'next')
    },
    skipBackward: () => {
      if (playerDataRef.current === null) return
      sendSocketCommand('playback', 'previous')
    },
    setVolume: (volume: number) => {
      if (playerDataRef.current === null) return

      if (sendSocketCommand('playback', 'volume', { volume })) {
        setPlayerData({
          ...playerDataRef.current!,
          volume: volume
        })
      }
    },
    shuffle: (state: boolean) => {
      if (playerDataRef.current === null) return

      if (sendSocketCommand('playback', 'shuffle', { state })) {
        setPlayerData({
          ...playerDataRef.current!,
          shuffle: state
        })
      }
    },
    repeat: (state: RepeatMode) => {
      if (playerDataRef.current === null) return

      if (sendSocketCommand('playback', 'repeat', { state })) {
        setPlayerData({
          ...playerDataRef.current!,
          repeat: state as RepeatMode
        })
      }
    },
    getPlaylists: (offset: number) =>
      sendSocketCommand('playback', 'playlists', { offset }),
    playPlaylist: (playlistID: string) => {
      setPlaylistsLoading(true)
      sendSocketCommand('playback', 'playPlaylist', { playlistID })
    }
  }

  return (
    <MediaContext.Provider
      value={{
        image,
        playerData,
        playerDataRef,
        lyricsData,
        currentLineIndex,
        actions,
        playlistsData,
        playlistsOffset,
        playlistsTotal,
        playlistsLoading,
        setPlaylistsData,
        setPlaylistsOffset,
        setPlaylistsLoading
      }}
    >
      {children}
    </MediaContext.Provider>
  )
}

export { MediaContext, MediaContextProvider }
