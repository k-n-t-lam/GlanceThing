import React, {
  KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
  WheelEvent,
  useCallback
} from 'react'

import { MediaContext } from '@/contexts/MediaContext.tsx'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'
import { formatTime } from '@/lib/utils.ts'

import styles from './FullescreenPlayer.module.css'

interface FullescreenPlayerProps {
  shown: boolean
  setShown: (shown: boolean) => void
}

const FullescreenPlayer: React.FC<FullescreenPlayerProps> = ({
  shown,
  setShown
}) => {
  const { 
    image, 
    playerData, 
    playerDataRef, 
    actions,
    lyricsData, 
    lyricsLoading, 
    lyricsCurrentLineIndex 
  } = useContext(MediaContext)
  const { showNothingPlayingNote } = useContext(AppStateContext)

  const playerRef = useRef<HTMLDivElement>(null)

  // Lyrics state
  const [error, setError] = useState<string | null>(null)
  const [hasLyrics, setHasLyrics] = useState<boolean>(false)
  const [syncLyric, setSyncLyric] = useState<boolean>(false)

  const lyricsContentRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement | null>(null)
  // Add ref to track animation frame
  const animationFrameRef = useRef<number | null>(null)
  const lastScrollTime = useRef<number>(0)
  const [originalPrimary, setOriginalPrimary] = useState<string | null>(null)
  const [originalBgColor, setOriginalBgColor] = useState<string | null>(null)
  const [originalInactiveColor, setOriginalInactiveColor] = useState<string | null>(null)
  const [originalTextColor, setOriginalTextColor] = useState<string | null>(null)

  useEffect(() => {
    if (shown) playerRef.current?.focus()
    else playerRef.current?.blur()
  }, [shown])

  // Store original CSS variables
  useEffect(() => {
    const computedStyle = getComputedStyle(document.documentElement)
    setOriginalPrimary(computedStyle.getPropertyValue('--color-primary'))
    setOriginalBgColor(
      computedStyle.getPropertyValue('--lyrics-color-background')
    )
    setOriginalInactiveColor(
      computedStyle.getPropertyValue('--lyrics-color-inactive')
    )
    setOriginalTextColor(
      computedStyle.getPropertyValue('--lyrics-color-messaging')
    )
  }, [])

  const scrollToActiveLine = useCallback(() => {
    if (!shown || !activeLineRef.current || !lyricsContentRef.current)
      return
    
    // Throttle scroll updates to improve performance
    const now = Date.now()
    if (now - lastScrollTime.current < 100) { // Throttle to max 10 updates per second
      return
    }
    lastScrollTime.current = now
    
    const lyricsContainer = lyricsContentRef.current
    const activeLine = activeLineRef.current
    const containerHeight = lyricsContainer.clientHeight
    const lineTop = activeLine.offsetTop
    const lineHeight = activeLine.clientHeight
    const scrollTo = lineTop - containerHeight / 2 + lineHeight / 2
    
    // Use direct scroll without nested requestAnimationFrame
    lyricsContainer.scrollTo({
      top: scrollTo,
      behavior: 'smooth'
    })
  }, [shown])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Only run if all conditions are met
    if (!shown || !syncLyric) {
      return
    }

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (lyricsCurrentLineIndex >= 0) {
        scrollToActiveLine()
      } else if (lyricsCurrentLineIndex === -1 && lyricsContentRef.current) {
        // Reset scroll position when no line is active
        const now = Date.now()
        if (now - lastScrollTime.current >= 100) {
          lastScrollTime.current = now
          lyricsContentRef.current.scrollTo({
            top: 0,
            behavior: 'smooth'
          })
        }
      }
      animationFrameRef.current = null
    })

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [
    lyricsCurrentLineIndex,
    scrollToActiveLine,
    shown,
    syncLyric
  ])

  const setColors = useCallback(
    (bgColor?: string, textColor?: string, inactiveColor?: string) => {
      document.documentElement.style.setProperty(
        '--color-primary',
        bgColor ?? originalPrimary
      )
      document.documentElement.style.setProperty(
        '--lyrics-color-background',
        bgColor ?? originalBgColor
      )
      document.documentElement.style.setProperty(
        '--lyrics-color-active',
        textColor ?? originalTextColor
      )
      document.documentElement.style.setProperty(
        '--lyrics-color-inactive',
        inactiveColor ?? originalInactiveColor
      )
      document.documentElement.style.setProperty(
        '--lyrics-color-passed',
        textColor ?? originalTextColor
      )
      document.documentElement.style.setProperty(
        '--lyrics-color-messaging',
        inactiveColor ?? originalTextColor
      )
    },
    [
      originalPrimary,
      originalBgColor,
      originalInactiveColor,
      originalTextColor
    ]
  )

  useEffect(() => {
    setSyncLyric(false)
    if (lyricsData) {
      if (lyricsData?.lyrics?.syncType === 'LINE_SYNCED') {
        setSyncLyric(true)
      }
      setError(null)
      setHasLyrics(
        !!lyricsData?.lyrics?.lines && lyricsData.lyrics.lines.length > 0
      )

      if (lyricsData.colors?.background !== undefined) {
        try {
          const background = lyricsData.colors.background
          const r = background.r ?? 0
          const g = background.g ?? 0
          const b = background.b ?? 0
          const bgColor = `rgb(${r}, ${g}, ${b})`
          const brightness = (r * 299 + g * 587 + b * 114) / 1000
          const textColor =
            brightness > 128 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'

          const inactiveColor =
            brightness > 128
              ? `rgb(255, 255, 255)`
              : `rgb(${Math.min(255, background.r + 140)}, ${Math.min(255, background.g + 140)}, ${Math.min(255, background.b + 140)})`
          setColors(bgColor, textColor, inactiveColor)
        } catch (err) {
          console.error('Error setting background color:', err)
        }
      }

      if (lyricsData.message) {
        setColors()
        setError(lyricsData.message)
      }
    }
  }, [lyricsData, setColors])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()

    if (e.key === 'Enter') {
      actions.playPause()
    } else if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'Escape') {
      setShown(false)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.deltaX < 0) {
      volumeDown()
    } else if (e.deltaX > 0) {
      volumeUp()
    }
  }

  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(volume)
  const lastVolumeChange = useRef(0)
  const [volumeAdjusted, setVolumeAdjusted] = useState(false)
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function volumeUp() {
    if (playerDataRef.current === null) return
    if (!playerDataRef.current.supportedActions.includes('volume')) return

    const volume = volumeRef.current

    if (volume < 100) {
      const newVolume = Math.min(volume + 10, 100)

      setVolume(newVolume)
      volumeRef.current = newVolume
      lastVolumeChange.current = Date.now()
      
      // Debounce WebSocket call
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current)
      }
      volumeDebounceRef.current = setTimeout(() => {
        actions.setVolume(newVolume)
      }, 250)
    }
  }

  function volumeDown() {
    if (playerDataRef.current === null) return
    if (!playerDataRef.current.supportedActions.includes('volume')) return

    const volume = volumeRef.current

    if (volume > 0) {
      const newVolume = Math.max(volume - 10, 0)
      
      setVolume(newVolume)
      volumeRef.current = newVolume
      lastVolumeChange.current = Date.now()
      
      // Debounce WebSocket call
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current)
      }
      volumeDebounceRef.current = setTimeout(() => {
        actions.setVolume(newVolume)
      }, 250)
    }
  }

  useEffect(() => {
    setVolumeAdjusted(true)
    const timer = setTimeout(() => {
      setVolumeAdjusted(false)
    }, 2000)

    return () => {
      clearTimeout(timer)
    }
  }, [volume])

  useEffect(() => {
    if (playerData) {
      if (lastVolumeChange.current < Date.now() - 1000) {
        setVolume(playerData.volume)
        volumeRef.current = playerData.volume
      }
    }
  }, [playerData])

  const renderLyrics = () => {
    if (!shown || !hasLyrics || !lyricsData?.lyrics?.lines) {
      return <div className={styles.emptyLyrics}></div>
    }

    return (
      <div className={styles.lyricsContent} ref={lyricsContentRef}>
        <div className={styles.lyricsTopPadding}></div>
        {lyricsData.lyrics.lines.map((line, index) => (
          <div
            key={index}
            className={`${styles.line} ${index === lyricsCurrentLineIndex ? styles.activeLine : ''} ${index < lyricsCurrentLineIndex ? styles.passedLine : ''}`}
            ref={index === lyricsCurrentLineIndex ? activeLineRef : null}
          >
            <div className={styles.lineContent}>{line.words}</div>
          </div>
        ))}
        <div className={styles.lyricsBottomPadding}></div>
      </div>
    )
  }

  const renderLyricsContent = () => {
    if (!shown) {
      return null
    }

    return (
      <>
        {lyricsLoading ? (
          <div className={styles.loading}>Loading lyrics...</div>
        ) : hasLyrics && !error ? (
          <div className={styles.lyricsContainer}>{renderLyrics()}</div>
        ) : !hasLyrics && !error ? (
          <div className={styles.loading}>No lyrics available</div>
        ) : null}
      </>
    )
  }

  return (
    <div
      className={styles.player}
      data-shown={shown}
      ref={playerRef}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      tabIndex={-1}
    >
      <button
        onClick={e => {
          setShown(false)
          e.currentTarget.blur()
        }}
        className={styles.close}
      >
        <span className="material-icons">keyboard_arrow_down</span>
      </button>
      {playerData && playerData.track ? (
        <>
          {image && (
            <img src={image} alt="" className={styles.background} />
          )}
          <div className={styles.mainContent}>
            <div className={styles.coverSection}>
              <div className={styles.cover}>
                {image ? (
                  <img src={image} alt="" />
                ) : (
                  <span className="material-icons">music_note</span>
                )}
              </div>
            </div>
            <div className={styles.trackSection}>
              {playerData && playerData.track && (
                <div className={styles.trackInfo}>
                  <div className={styles.title}>{playerData.track.name}</div>
                  <div className={styles.artist}>
                    {playerData.track.artists.join(', ')}
                  </div>
                </div>
              )}
              {renderLyricsContent()}
            </div>
          </div>
          <div className={styles.progress}>
            <p>{formatTime(playerData.track.duration.current)}</p>
            <div className={styles.slider}>
              <div
                className={styles.fill}
                style={{
                  width: `${
                    (playerData.track.duration.current /
                      playerData.track.duration.total) *
                    100
                  }%`
                }}
              ></div>
            </div>
            <p>{formatTime(playerData.track.duration.total)}</p>
          </div>
          <div
            className={styles.controls}
            data-hide-buttons={volumeAdjusted}
          >
            {playerData.supportedActions.includes('volume') && (
              <div className={styles.volume} data-shown={volumeAdjusted}>
                <button onMouseDown={volumeDown}>
                  <span className="material-icons"> volume_down </span>
                </button>
                <div className={styles.slider}>
                  <div
                    className={styles.fill}
                    style={{ width: `${volume}%` }}
                  ></div>
                </div>
                <button onMouseDown={volumeUp}>
                  <span className="material-icons"> volume_up </span>
                </button>
              </div>
            )}
            {playerData.supportedActions.includes('shuffle') ? (
              <button
                data-shuffle-state={playerData?.shuffle}
                onClick={() =>
                  actions.shuffle(playerData?.shuffle ? false : true)
                }
              >
                <span className="material-icons">shuffle</span>
              </button>
            ) : null}
            <button onClick={() => actions.skipBackward()}>
              <span className="material-icons">skip_previous</span>
            </button>
            <button onClick={() => actions.playPause()}>
              <span className="material-icons">
                {playerData?.isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onClick={() => actions.skipForward()}>
              <span className="material-icons">skip_next</span>
            </button>
            {playerData.supportedActions.includes('repeat') ? (
              <button
                data-repeat-state={playerData?.repeat !== 'off'}
                onClick={() =>
                  actions.repeat(
                    playerData?.repeat === 'off'
                      ? 'on'
                      : playerData?.repeat === 'on'
                        ? 'one'
                        : 'off'
                  )
                }
              >
                <span className="material-icons">
                  {playerData?.repeat === 'off'
                    ? 'repeat'
                    : playerData?.repeat === 'on'
                      ? 'repeat'
                      : 'repeat_one'}
                </span>
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className={styles.notPlaying}>
          <span className="material-icons">music_note</span>
          <p className={styles.title}>Nothing playing!</p>
          {showNothingPlayingNote && (
            <p className={styles.note}>
              Start playing something on your computer.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default FullescreenPlayer
