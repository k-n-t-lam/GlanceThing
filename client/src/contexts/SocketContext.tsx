import React, { createContext, useEffect, useRef, useState } from 'react'

import { getSocketPassword } from '@/lib/utils.ts'

interface SocketContextProps {
  ready: boolean
  firstLoad: boolean
  socket: WebSocket | null
}

const SocketContext = createContext<SocketContextProps>({
  ready: false,
  firstLoad: true,
  socket: null
})

interface SocketContextProviderProps {
  children: React.ReactNode
}

const SocketContextProvider = ({
  children
}: SocketContextProviderProps) => {
  const [ready, setReady] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const [firstLoad, setFirstLoad] = useState(true)

  function connect() {
    ws.current = new WebSocket('ws://localhost:1337')

    ws.current.onopen = async () => {
      const pass = await getSocketPassword()
      if (pass)
        ws.current?.send(
          JSON.stringify({
            type: 'auth',
            data: pass
          })
        )
      setReady(true)
      setTimeout(() => {
        setFirstLoad(false)
      }, 500)
    }

    ws.current.onclose = () => {
      setReady(false)
      setTimeout(() => {
        connect()
      }, 1000)
    }
  }

  useEffect(() => {
    connect()

    return () => {
      ws.current?.close()
    }
    // eslint-disable-next-line
  }, [])

  return (
    <SocketContext.Provider
      value={{
        ready,
        firstLoad,
        socket: ws.current
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export { SocketContext, SocketContextProvider }
