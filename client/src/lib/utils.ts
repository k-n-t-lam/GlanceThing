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
