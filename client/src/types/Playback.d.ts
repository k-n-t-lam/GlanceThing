export type RepeatMode = 'off' | 'on' | 'one'

export type Action =
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'shuffle'
  | 'repeat'
  | 'volume'
  | 'image'

export interface PlaybackData {
  isPlaying: boolean
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  track: {
    id: string
    name: string
    artists: string[]
    album: string
    duration: {
      current: number
      total: number
    }
  }
  supportedActions: Action[],
  context?: {
    type?: string
    uri?: string
  }
}
