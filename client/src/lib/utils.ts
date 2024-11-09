import axios from 'axios'

export function getClosestImage(
  covers: { url: string; width: number; height: number }[],
  width: number
) {
  const valid = covers.filter(cover => cover.width >= width)
  if (valid.length === 0) return covers[0]

  valid.sort((a, b) => a.width - b.width)

  return valid[0]
}

export async function getSocketPassword() {
  const res = await axios.get('./ws-password')
  return res.data.replace('\n', '')
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
