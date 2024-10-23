import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import styles from './Developer.module.css'

enum CarThingState {
  NotFound = 'not_found',
  NotInstalled = 'not_installed',
  Installing = 'installing',
  Ready = 'ready'
}

const Developer: React.FC = () => {
  const [serverStarted, setServerStarted] = useState(false)

  const [carThingState, setCarThingState] = useState<CarThingState | null>(
    null
  )
  const carThingStateRef = useRef(carThingState)

  useEffect(() => {
    async function checkServerStarted() {
      const started = await window.api.isServerStarted()
      setServerStarted(started)
    }

    const interval = setInterval(checkServerStarted, 1000)

    const removeListener = window.api.on('carThingState', s => {
      const state = s as CarThingState

      setCarThingState(state)
      carThingStateRef.current = state
    })

    const timeout = setTimeout(() => {
      if (carThingStateRef.current !== null) return

      window.api.triggerCarThingStateUpdate()
    }, 200)

    checkServerStarted()

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
      removeListener()
    }
  }, [])

  return (
    <div className={styles.developer}>
      <h1>Developer</h1>
      <Link to="/">Back</Link>

      <h2>CarThing</h2>
      <p>State: {carThingState}</p>
      <div>
        <button onClick={() => window.api.installApp()}>
          Install Web App
        </button>
        <button onClick={() => window.api.forwardSocketServer()}>
          Forward WebSocketServer
        </button>
      </div>

      <h2>Server</h2>
      <div>
        {serverStarted ? (
          <button onClick={() => window.api.stopServer()}>
            Stop WebSocketServer
          </button>
        ) : (
          <button onClick={() => window.api.startServer()}>
            Start WebSocketServer
          </button>
        )}
      </div>
    </div>
  )
}

export default Developer
