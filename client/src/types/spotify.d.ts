export interface FilteredSpotifyCurrentPlayingResponse {
  session: true
  type: 'track' | 'episode'
  playing: boolean
  name: string
  trackURL: string
  repeat_state: string
  shuffle_state: boolean
  artists: {
    name: string
    url: string
  }[]
  album: {
    name: string
    url: string
  }
  covers: {
    url: string
    width: number
    height: number
  }[]
  duration: {
    current: number
    total: number
  }
  device: {
    volume_percent: number
    supports_volume: boolean
  }
}
