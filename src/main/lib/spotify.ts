import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { parse } from 'node-html-parser'
import EventEmitter from 'events'
import WebSocket from 'ws'
import { log, safeParse } from './utils.js'

async function subscribe(connection_id: string, token: string) {
  return await axios.put(
    'https://api.spotify.com/v1/me/notifications/player',
    null,
    {
      params: {
        connection_id
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      validateStatus: () => true
    }
  )
}

export async function getToken(sp_dc: string) {
  const res = await axios.get('https://open.spotify.com', {
    headers: {
      cookie: `sp_dc=${sp_dc};`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    },
    validateStatus: () => true
  })

  if (res.status !== 200) throw new Error('Invalid sp_dc')

  const html = parse(res.data)

  const script = html.querySelector('script#session')

  if (!script) throw new Error('Invalid sp_dc')

  const json = safeParse(script.innerText)

  if (!json) throw new Error('Invalid sp_dc')

  return json.accessToken
}

export interface SpotifyCurrentPlayingResponse {
  device: {
    id: string
    is_active: boolean
    is_private_session: boolean
    is_restricted: boolean
    name: string
    type: string
    volume_percent: number
    supports_volume: boolean
  }
  repeat_state: string
  shuffle_state: boolean
  context: {
    external_urls: {
      spotify: string
    }
    href: string
    type: string
    uri: string
  }
  timestamp: number
  progress_ms: number
  is_playing: boolean
  item: {
    name: string
    external_urls: {
      spotify: string
    }
    artists: {
      name: string
      external_urls: {
        spotify: string
      }
    }[]
    album: {
      name: string
      href: string
      images: {
        url: string
        width: number
        height: number
      }[]
    }
    duration_ms: number
  }
}

interface FilteredSpotifyCurrentPlayingResponse {
  session: true
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

interface NoSessionResponse {
  session: false
}

export function filterData(
  data: SpotifyCurrentPlayingResponse
): FilteredSpotifyCurrentPlayingResponse | NoSessionResponse {
  const {
    is_playing,
    item,
    progress_ms,
    device,
    repeat_state,
    shuffle_state
  } = data

  if (!item) {
    return {
      session: false
    }
  }

  return {
    session: true,
    playing: is_playing,
    name: item.name,
    trackURL: item.external_urls.spotify,
    repeat_state,
    shuffle_state,
    artists: item.artists.map(a => ({
      name: a.name,
      url: a.external_urls.spotify
    })),
    album: {
      name: item.album.name,
      url: item.album.href
    },
    covers: item.album.images,
    duration: {
      current: progress_ms,
      total: item.duration_ms
    },
    device: {
      volume_percent: device.volume_percent,
      supports_volume: device.supports_volume
    }
  }
}

export async function fetchImage(id: string) {
  const res = await axios.get(`https://i.scdn.co/image/${id}`, {
    responseType: 'arraybuffer'
  })

  return `data:image/jpeg;base64,${Buffer.from(res.data).toString('base64')}`
}

class SpotifyAPI extends EventEmitter {
  sp_dc: string
  token: string | null
  ws: WebSocket | null
  instance: AxiosInstance = axios.create({
    baseURL: 'https://api.spotify.com/v1',
    validateStatus: () => true
  })

  constructor(sp_dc: string) {
    super()

    this.sp_dc = sp_dc
    this.token = null
    this.ws = null

    this.instance.interceptors.request.use(config => {
      config.headers.Authorization = `Bearer ${this.token}`
      return config
    })

    this.instance.interceptors.response.use(async res => {
      if (res.status === 401) {
        log('Refreshing token...', 'Spotify')
        this.token = await getToken(this.sp_dc)
        return this.instance(res.config)
      }

      return res
    })
  }

  async start() {
    this.token = await getToken(this.sp_dc)

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${this.token}`
    )

    this.setup()
  }

  setup() {
    if (!this.ws) return
    const ping = () => this.ws!.send('{"type":"ping"}')

    this.ws.on('open', () => {
      ping()
      const interval = setInterval(() => {
        if (!this.ws) return clearInterval(interval)
        ping()
      }, 15000)
    })

    this.ws.on('message', async d => {
      const msg = JSON.parse(d.toString())
      if (msg.headers?.['Spotify-Connection-Id']) {
        await subscribe(msg.headers['Spotify-Connection-Id'], this.token!)
          .then(() => this.emit('ready'))
          .catch(err => this.emit('error', err))

        return
      }
      const event = msg.payloads?.[0]?.events?.[0]
      if (!event) return
      this.emit(event.type, event.event)
    })

    this.ws.on('close', () => this.emit('close'))

    this.ws.on('error', err => this.emit('error', err))
  }

  async close() {
    if (!this.ws) return
    this.ws.removeAllListeners()
    this.ws.close()
    this.ws = null
    this.removeAllListeners()
  }

  async getCurrent(): Promise<
    FilteredSpotifyCurrentPlayingResponse | NoSessionResponse
  > {
    const res = await this.instance.get('/me/player')

    if (!res.data)
      return {
        session: false
      }

    return filterData(res.data)
  }

  async setPlaying(playing: boolean) {
    let res: AxiosResponse
    if (playing) {
      res = await this.instance.put('/me/player/play')
    } else {
      res = await this.instance.put('/me/player/pause')
    }

    return res.status === 200
  }

  async setVolume(volume: number) {
    const res = await this.instance.put(
      '/me/player/volume',
      {},
      {
        params: {
          volume_percent: volume
        }
      }
    )

    return res.status === 204
  }

  async next() {
    const res = await this.instance.post('/me/player/next')

    return res.status === 204
  }

  async previous() {
    const res = await this.instance.post('/me/player/previous')

    return res.status === 204
  }

  async shuffle(state: boolean) {
    const res = await this.instance.put('/me/player/shuffle', null, {
      params: {
        state
      }
    })

    return res.status === 204
  }

  async repeat(state: 'track' | 'context' | 'off') {
    const res = await this.instance.put('/me/player/repeat', null, {
      params: {
        state
      }
    })

    return res.status === 204
  }
}

export let spotify: SpotifyAPI | null = null

export function setupSpotify(sp_dc: string) {
  spotify = new SpotifyAPI(sp_dc)
  return spotify
}
