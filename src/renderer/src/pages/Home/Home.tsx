import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import icon from '@/assets/icon.png'

import styles from './Home.module.css'

enum CarThingState {
  NotFound = 'not_found',
  NotInstalled = 'not_installed',
  Installing = 'installing',
  Ready = 'ready'
}

const Home: React.FC = () => {
  const navigate = useNavigate()
  const [carThingState, setCarThingState] = useState<CarThingState | null>(
    null
  )
  const carThingStateRef = useRef(carThingState)

  useEffect(() => {
    window.api.getStorageValue('setupComplete').then(setupComplete => {
      if (!setupComplete) navigate('/setup')
    })

    const removeListener = window.api.on('carThingState', async s => {
      const state = s as CarThingState

      setCarThingState(state)
      carThingStateRef.current = state
    })

    const timeout = setTimeout(() => {
      if (carThingStateRef.current !== null) return

      window.api.triggerCarThingStateUpdate()
    }, 200)

    return () => {
      removeListener()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className={styles.home}>
      <img src={icon} alt="" />
      <h1>GlanceThing</h1>
      <div className={styles.status}>
        {carThingState === CarThingState.NotFound ? (
          <>
            <p>
              CarThing not found. Please reconnect it to your computer, or
              run setup again.
            </p>
            <button onClick={() => navigate('/setup')}>
              Setup <span className="material-icons">arrow_forward</span>
            </button>
          </>
        ) : carThingState === CarThingState.NotInstalled ? (
          <>
            <p>CarThing found, but the app is not installed.</p>
            <button onClick={() => navigate('/setup')}>
              Setup <span className="material-icons">arrow_forward</span>
            </button>
          </>
        ) : carThingState === CarThingState.Installing ? (
          <p>
            CarThing found, but the app is not installed. Installing...
          </p>
        ) : carThingState === CarThingState.Ready ? (
          <p>CarThing is ready!</p>
        ) : (
          <p>Checking for CarThing...</p>
        )}
      </div>
    </div>
  )
}

export default Home
