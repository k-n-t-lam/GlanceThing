import { setAutoBrightness } from '../adb.js'

import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'wake'

export const hasActions = false

export const handle: HandlerFunction = async () => {
  await setAutoBrightness(null, true)
}
