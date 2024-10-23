import {
  KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
  WheelEvent
} from 'react'

import { FilteredSpotifyCurrentPlayingResponse } from '@/types/spotify'
import { getClosestImage } from '@/lib/utils.ts'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './Spotify.module.css'

const Spotify: React.FC = () => {
  const { ready, socket } = useContext(SocketContext)

  const spotifyRef = useRef<HTMLDivElement>(null)

  const [playerData, setPlayerData] =
    useState<FilteredSpotifyCurrentPlayingResponse | null>(null)
  const playerDataRef = useRef(playerData)

  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(volume)
  const lastVolumeChange = useRef(0)

  const [image, setImage] = useState('')
  const imageRef = useRef(image)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: playerDataRef.current?.playing ? 'pause' : 'play'
        })
      )
      setPlayerData({
        ...playerDataRef.current!,
        playing: !playerDataRef.current?.playing
      })
    } else if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    console.log(e.deltaX)
    const volume = volumeRef.current

    if (e.deltaX < 0) {
      if (volume > 0) {
        const newVolume = Math.max(volume - 10, 0)
        socket?.send(
          JSON.stringify({
            type: 'spotify',
            action: 'volume',
            data: {
              amount: newVolume
            }
          })
        )

        setVolume(newVolume)
        volumeRef.current = newVolume
        lastVolumeChange.current = Date.now()
      }
    } else if (e.deltaX > 0) {
      if (volume < 100) {
        const newVolume = Math.min(volume + 10, 100)

        socket?.send(
          JSON.stringify({
            type: 'spotify',
            action: 'volume',
            data: {
              amount: newVolume
            }
          })
        )
        setVolume(newVolume)
        volumeRef.current = newVolume
        lastVolumeChange.current = Date.now()
      }
    }
  }

  useEffect(() => {
    if (ready === true && socket) {
      const listener = (e: MessageEvent) => {
        const { type, action, data } = JSON.parse(e.data)
        if (type !== 'spotify') return

        if (action === 'image') {
          if (!data) return
          setImage(data)
        } else {
          if (!data) return

          if (data.session == false) return setPlayerData(null)
          setPlayerData(data)
          playerDataRef.current = data

          if (lastVolumeChange.current < Date.now() - 1000) {
            setVolume(data.device.volume_percent)
            volumeRef.current = data.device.volume_percent
          }

          const img = getClosestImage(data.covers, 120)
          const id = img.url.split('/').pop()!
          if (imageRef.current !== id) {
            imageRef.current = id
            socket.send(
              JSON.stringify({
                type: 'spotify',
                action: 'image',
                data: { id }
              })
            )
          }
        }
      }
      socket.addEventListener('message', listener)

      socket.send(JSON.stringify({ type: 'spotify' }))

      return () => {
        socket.removeEventListener('message', listener)
      }
    }
  }, [ready, socket])

  useEffect(() => {
    const listener = (e: globalThis.WheelEvent) => {
      if (document.activeElement === spotifyRef.current) {
        e.preventDefault()
        onWheel({
          deltaX: e.deltaX
        } as WheelEvent<HTMLDivElement>)
      }
    }

    document.addEventListener('wheel', listener, {
      passive: false
    })

    return () => {
      document.removeEventListener('wheel', listener)
    }
  })

  return (
    <BaseWidget
      className={styles.spotify}
      onKeyDown={onKeyDown}
      ref={spotifyRef}
    >
      {playerData ? (
        <>
          <img src={image} alt={playerData.album.name} />
          <span className={styles.name}>{playerData.name}</span>
          <span className={styles.artists}>
            {playerData.artists.map(artist => artist.name).join(', ')}
          </span>
          <div className={styles.controls}>
            <button>
              <span className="material-icons">
                {playerData.playing ? 'pause' : 'play_arrow'}
              </span>
            </button>
          </div>
          {playerData.device.supports_volume && (
            <div className={styles.volume}>
              <span className="material-icons"> volume_down </span>
              <div className={styles.slider}>
                <div
                  className={styles.fill}
                  style={{ width: `${volume}%` }}
                ></div>
              </div>
              <span className="material-icons"> volume_up </span>
            </div>
          )}
        </>
      ) : (
        <p>Nothing playing</p>
      )}
    </BaseWidget>
  )
}

export default Spotify
