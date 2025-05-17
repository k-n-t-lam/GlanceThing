import {
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  use
} from 'react'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import styles from './PlaylistsScreen.module.css'
import { MediaContext } from '@/contexts/MediaContext'
import { debounce } from '@/lib/utils'

// Define interfaces for our data
interface Track {
  id: string
  name: string
  artists: string[]
  duration_ms: number
  album?: string
  isPlaying?: boolean
  image?: string
}

interface Playlist {
  id: string
  name: string
  description: string
  image: string
  tracks: {
    total: number
    items?: Track[]
  }
  owner?: {
    display_name: string
  }
}

interface PlaylistsScreenProps {
  shown: boolean
  setShown: (shown: boolean) => void
}

// Format milliseconds into MM:SS format
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({
  shown,
  setShown
}) => {
  const { ready, socket } = useContext(SocketContext)
  const {
    playlistsData,
    playlistsLoading,
    playlistsOffset,
    playlistsTotal,
    actions,
    setPlaylistsData = () => {},
    setPlaylistsOffset = () => {},
    setPlaylistsLoading = () => {},
    playerData
  } = useContext(MediaContext)

  // Track which playlist is selected and its tracks
  const [selectedPlaylist, setSelectedPlaylist] =
    useState<Playlist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])

  // Track playlist tracks loading state and pagination
  const [tracksLoading, setTracksLoading] = useState(false)
  const [tracksPagination, setTracksPagination] = useState({
    offset: 0,
    limit: 50,
    total: 0,
    hasMore: false
  })

  // Track click timing for single/double click handling
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [clickCount, setClickCount] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const playlistsListRef = useRef<HTMLDivElement>(null)
  const trackListRef = useRef<HTMLDivElement>(null)

  // Track which playlists are newly loaded
  const [newlyLoadedIds, setNewlyLoadedIds] = useState<string[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string>('')

  // Previous playlists count to detect new additions
  const prevPlaylistsLengthRef = useRef<number>(0)

  const loadMoreTracks = debounce(() => {
    if (!tracksLoading && selectedPlaylist && tracksPagination.hasMore) {
      const nextOffset = tracksPagination.offset + tracksPagination.limit
      console.log(`Loading more tracks from offset ${nextOffset}`)
      setTracksLoading(true)

      // Call API to get more tracks
      if (socket) {
        socket.send(
          JSON.stringify({
            type: 'playback',
            action: 'playlistTracks',
            data: {
              playlistID: selectedPlaylist.id,
              offset: nextOffset,
              limit: tracksPagination.limit
            }
          })
        )
      }
    }
  }, 200)

  // Handler for track list scroll to implement infinite scrolling
  const handleTrackListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      // Check if user has scrolled to bottom (with a 50px threshold)
      if (scrollHeight - scrollTop - clientHeight < 50) {
        loadMoreTracks()
      }
    },
    [loadMoreTracks]
  )

  // Update newly loaded IDs when playlists data changes
  useEffect(() => {
    if (playlistsData && !playlistsLoading) {
      const currentLength = playlistsData.length
      const prevLength = prevPlaylistsLengthRef.current

      // If we've added new playlists
      if (currentLength > prevLength) {
        // Get IDs of newly loaded playlists
        const newIds = playlistsData
          .slice(prevLength)
          .map(playlist => playlist.id)

        setNewlyLoadedIds(newIds)
        prevPlaylistsLengthRef.current = currentLength
      } else if (currentLength === 0) {
        // Reset when we start from scratch
        prevPlaylistsLengthRef.current = 0
      }
    }
  }, [playlistsData, playlistsLoading])

  // Clear newly loaded state after animation is complete
  useEffect(() => {
    if (newlyLoadedIds.length > 0) {
      const timer = setTimeout(() => {
        setNewlyLoadedIds([])
      }, 1000) // Clear after animations are complete

      return () => clearTimeout(timer)
    }
  }, [newlyLoadedIds])

  // Load more playlists
  const loadMorePlaylists = useCallback(() => {
    if (!playlistsLoading && playlistsOffset < playlistsTotal) {
      console.log(`Loading more playlists from offset ${playlistsOffset}`)
      setPlaylistsLoading(true)
      actions.getPlaylists(playlistsOffset)
    }
  }, [
    playlistsLoading,
    playlistsOffset,
    playlistsTotal,
    actions,
    setPlaylistsLoading
  ])

  // Get playlists when shown and data is null
  useEffect(() => {
    // Only trigger the initial fetch when the component is shown,
    // socket is ready, and no data has been loaded yet
    if (
      ready &&
      socket &&
      shown &&
      playlistsData === null &&
      !playlistsLoading
    ) {
      console.log('Initial playlists fetch')
      // Initial load - reset offset to 0
      setPlaylistsOffset(0)
      actions.getPlaylists(0)
      setPlaylistsLoading(true)
    }
    if (playerData?.context?.type === 'playlist'){
      setCurrentPlaylistId(playerData?.context?.uri?.replace('spotify:playlist:', '') ?? '')
    }
  }, [
    ready,
    socket,
    shown,
    playlistsData,
    playlistsLoading,
    actions,
    setPlaylistsOffset,
    setPlaylistsLoading,
    setCurrentPlaylistId
  ])
  
  // Focus container when shown
  useEffect(() => {
    if (shown) {
      containerRef.current?.focus()
    } else {
      containerRef.current?.blur()
      // Reset scroll position when hidden
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
      }
      // When the component is hidden, we'll just reset the loading flag and clear selection
      setPlaylistsLoading(false)
      setSelectedPlaylist(null)
      setPlaylistTracks([])
      setTracksPagination({
        offset: 0,
        limit: 50,
        total: 0,
        hasMore: false
      })
    }
  }, [shown, setPlaylistsLoading])

  // We'll use a ref to track if this is the first render or not
  const firstRenderRef = useRef(true)

  // Reset data when shown changes from false to true
  useEffect(() => {
    // Skip the effect on first render
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }

    if (shown) {
      // We only want to reset data when the component becomes visible,
      // not on every render while it's visible
      console.log(
        'Resetting playlists data because component became visible'
      )
      setPlaylistsData(null)
      setPlaylistsOffset(0)
      prevPlaylistsLengthRef.current = 0 // Reset the playlist length counter
      // We don't need to immediately trigger the fetch here since the other
      // effect will handle that when it detects playlistsData === null
    } else {
      // When hiding the component, close the sidebar as well
      setSelectedPlaylist(null)
      setPlaylistTracks([])
      setTracksPagination({
        offset: 0,
        limit: 50,
        total: 0,
        hasMore: false
      })
    }
  }, [shown, setPlaylistsData, setPlaylistsOffset])

  // Handle playlist click (single vs double)
  const handlePlaylistClick = useCallback(
    (playlist: Playlist) => {
      // Immediately show playlist tracks on single click (new feature)
      console.log('Single click - show tracks for:', playlist.name)
      setSelectedPlaylist(playlist)
      setTracksLoading(true)

      // Reset tracks pagination
      setTracksPagination({
        offset: 0,
        limit: 50,
        total: 0,
        hasMore: false
      })

      // Call API to get the tracks for this playlist
      if (socket) {
        socket.send(
          JSON.stringify({
            type: 'playback',
            action: 'playlistTracks',
            data: {
              playlistID: playlist.id,
              offset: 0,
              limit: 50
            }
          })
        )
      }

      // Increment click count
      setClickCount(prevCount => prevCount + 1)

      // If there's an existing timer, clear it
      if (clickTimer) {
        clearTimeout(clickTimer)
        setClickTimer(null)
      }

      // Set a new timer to detect double clicks
      const timer = setTimeout(() => {
        // Reset click count
        setClickCount(0)
        setClickTimer(null)
      }, 300) // 300ms to detect double clicks

      setClickTimer(timer as unknown as NodeJS.Timeout)

      // If it's a double click
      if (clickCount === 1) {
        console.log('Double click - play playlist:', playlist.name)
        actions.playPlaylist(playlist.id)
        setClickCount(0)
        if (clickTimer) {
          clearTimeout(clickTimer)
          setClickTimer(null)
        }
      }
    },
    [clickCount, clickTimer, socket, actions]
  )

  useEffect(() => {
    if(currentPlaylistId && playlistsData){
      let currentPlaylist = playlistsData?.find(playlist => playlist.id == currentPlaylistId )
      if (currentPlaylist) {
        setSelectedPlaylist(currentPlaylist)
        setTracksLoading(true)
        // Reset tracks pagination
        setTracksPagination({
          offset: 0,
          limit: 50,
          total: 0,
          hasMore: false
        })

        // Call API to get the tracks for this playlist
        if (socket) {
          socket.send(
            JSON.stringify({
              type: 'playback',
              action: 'playlistTracks',
              data: {
                playlistID: currentPlaylist.id,
                offset: 0,
                limit: 50
              }
            })
          )
        }
      }
    }
  },[currentPlaylistId, playlistsData, setSelectedPlaylist])

  // Handle track clicks
  const handleTrackClick = useCallback(
    (track: Track, playlist: Playlist) => {
      console.log(
        'Play track:',
        track.name,
        'from playlist:',
        playlist.name
      )

      // Update UI immediately for better feedback
      setPlaylistTracks(prevTracks => {
        return prevTracks.map(t => ({
          ...t,
          isPlaying: t.id === track.id
        }))
      })

      // Send message to play specific track from playlist
      if (socket) {
        socket.send(
          JSON.stringify({
            type: 'playback',
            action: 'playTrack',
            data: {
              trackID: track.id,
              playlistID: playlist.id
            }
          })
        )
      }
    },
    [socket]
  )

  // Listen for playlist tracks response and playback status updates
  useEffect(() => {
    if (!socket || !ready) return

    const handleSocketMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)

        // Handle playlist tracks response
        if (data.type === 'playback' && data.action === 'playlistTracks') {
          console.log('Received playlist tracks:', data.data)

          // Update pagination information
          setTracksPagination({
            offset: data.data.offset || 0,
            limit: data.data.limit || 50,
            total: data.data.total || 0,
            hasMore: data.data.total > data.data.offset + data.data.limit
          })

          // Get tracks from the response
          const tracks = data.data.items || []

          // Mark currently playing track if available
          const currentTrackID =
            data.data.currentlyPlayingID || playerData?.track?.id || null
          if (currentTrackID) {
            tracks.forEach((track: Track) => {
              track.isPlaying = track.id === currentTrackID
            })
          }

          // If this is the first batch of tracks (offset 0), replace the tracks
          // Otherwise, append the new tracks to the existing ones
          if (data.data.offset === 0) {
            setPlaylistTracks(tracks)
          } else {
            setPlaylistTracks(prevTracks => [...prevTracks, ...tracks])
          }

          setTracksLoading(false)
        }

        // Handle currently playing changed event
        if (data.type === 'playback' && data.action === 'nowPlaying') {
          // Update the currently playing track if we're viewing the same playlist
          if (
            selectedPlaylist &&
            data.data.context?.playlistID === selectedPlaylist.id
          ) {
            setPlaylistTracks(prev =>
              prev.map(track => ({
                ...track,
                isPlaying: track.id === data.data.track.id
              }))
            )
          }
        }

        // Handle track played successfully event
        if (data.type === 'playback' && data.action === 'trackPlayed') {
          // Update the currently playing track
          if (
            selectedPlaylist &&
            data.data.playlistID === selectedPlaylist.id
          ) {
            setPlaylistTracks(prev =>
              prev.map(track => ({
                ...track,
                isPlaying: track.id === data.data.trackID
              }))
            )
          }
        }

        // Handle general playback updates
        if (
          data.type === 'playback' &&
          !data.action &&
          data.data?.track?.id
        ) {
          setPlaylistTracks(prev =>
            prev.map(track => ({
              ...track,
              isPlaying: track.id === data.data.track.id
            }))
          )
        }
      } catch (err) {
        console.error('Error parsing message:', err)
      }
    }

    socket.addEventListener('message', handleSocketMessage)

    return () => {
      socket.removeEventListener('message', handleSocketMessage)
    }
  }, [socket, ready, selectedPlaylist, playerData])

  // Close the sidebar
  const closeSidebar = useCallback(() => {
    setSelectedPlaylist(null)
    setPlaylistTracks([])
    setTracksPagination({
      offset: 0,
      limit: 50,
      total: 0,
      hasMore: false
    })
  }, [])

  // Handle keyboard navigation
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()

    if (e.key === 'Escape') {
      if (selectedPlaylist) {
        closeSidebar()
      } else {
        setShown(false)
      }
    }
  }

  return (
    <div
      className={styles.playlistsContainer}
      data-shown={shown}
      ref={containerRef}
      tabIndex={0}
      autoFocus={true}
      onKeyDown={onKeyDown}
    >
      <button onClick={() => setShown(false)} className={styles.close}>
        <span className="material-icons">keyboard_arrow_down</span>
      </button>

      <div className={styles.splitView}>
        {/* Playlists Panel */}
        <div
          className={`${styles.playlistsPanel} ${selectedPlaylist ? styles.withSidebar : ''}`}
        >
          <div className={styles.playlists}>
            {playlistsData === null && playlistsLoading && (
              <p className={styles.loading}>Loading playlists...</p>
            )}
            {playlistsData && (
              <div className={styles.playlistsList} ref={playlistsListRef}>
                {playlistsData.length === 0 ? (
                  <p className={styles.noPlaylists}>No playlists found</p>
                ) : (
                  playlistsData.map(playlist => (
                    <div
                      key={playlist.id}
                      className={`${styles.playlistItem} 
                        ${newlyLoadedIds.includes(playlist.id) ? styles.newlyLoaded : ''} 
                        ${selectedPlaylist?.id === playlist.id ? styles.active : ''}`}
                      onClick={() => handlePlaylistClick(playlist)}
                    >
                      <div className={styles.playlistImage}>
                        {playlist.image && <img src={playlist.image} alt={playlist.name} />}
                      </div>
                      <div className={styles.playlistInfo}>
                        <h3 className={styles.playlistTitle}>
                          {playlist.name}
                        </h3>
                        <p className={styles.playlistOwner}>
                          {playlist.owner?.display_name || ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {/* Show the loading indicator when loading more playlists */}
                {playlistsData &&
                  playlistsLoading &&
                  playlistsOffset < playlistsTotal && (
                    <div className={styles.loadingMore}>
                      <p>Loading more playlists...</p>
                    </div>
                  )}
                {/* Show the "Load More" button when there are more playlists to load and not already loading */}
                {playlistsData &&
                  !playlistsLoading &&
                  playlistsOffset < playlistsTotal && (
                    <div className={styles.loadMoreContainer}>
                      <button
                        className={styles.loadMoreButton}
                        onClick={loadMorePlaylists}
                      >
                        Load More
                      </button>
                    </div>
                  )}
                {/* Show end message when all playlists have been loaded */}
                {playlistsData &&
                  playlistsOffset >= playlistsTotal &&
                  playlistsTotal > 0 && (
                    <div className={styles.endOfList}>
                      <p>No more playlists</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Tracks Sidebar */}
        <div
          className={`${styles.tracksSidebar} ${selectedPlaylist ? styles.visible : ''}`}
        >
          {selectedPlaylist && (
            <>
              <div className={styles.sidebarHeader}>
                <div className={styles.sidebarTitle}>
                  <h2>{selectedPlaylist.name}</h2>
                </div>
                <p className={styles.sidebarSubtitle}>
                  {tracksPagination.total || selectedPlaylist.tracks.total}{' '}
                  tracks •{' '}
                  {selectedPlaylist.owner?.display_name || 'Unknown'}
                </p>
                <button
                  className={styles.closeButton}
                  onClick={closeSidebar}
                >
                  <span className="material-icons">
                    keyboard_arrow_left
                  </span>
                </button>
              </div>

              <div
                className={styles.trackList}
                ref={trackListRef}
                onScroll={handleTrackListScroll}
              >
                {playlistTracks.length === 0 && tracksLoading ? (
                  <div className={styles.sidebarLoading}>
                    <p>Loading tracks...</p>
                  </div>
                ) : playlistTracks.length === 0 ? (
                  <p>No tracks found in this playlist</p>
                ) : (
                  <>
                    {playlistTracks.map((track, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className={`${styles.trackItem} ${track.isPlaying ? styles.playing : ''}`}
                        onClick={() =>
                          handleTrackClick(track, selectedPlaylist!)
                        }
                      >
                        <div className={styles.trackNumber}>
                          {track.isPlaying ? (
                            <span className="material-icons">
                              equalizer
                            </span>
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className={styles.trackImage}>
                          {track.image && <img src={track.image} alt={track.name} />}
                        </div>
                        <div className={styles.trackInfo}>
                          <h4 className={styles.trackName}>
                            {track.name}
                          </h4>
                          <p className={styles.trackArtist}>
                            {track.artists.join(', ')}
                          </p>
                        </div>
                        <div className={styles.trackDuration}>
                          {formatDuration(track.duration_ms)}
                        </div>
                      </div>
                    ))}

                    {/* Loading more indicator */}
                    {tracksLoading && (
                      <div className={styles.tracksLoadingMore}>
                        <p>Loading more tracks...</p>
                      </div>
                    )}

                    {/* End of tracks message */}
                    {!tracksLoading &&
                      !tracksPagination.hasMore &&
                      playlistTracks.length > 0 && (
                        <div className={styles.tracksEndOfList}>
                          <p>End of playlist</p>
                        </div>
                      )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlaylistsScreen
