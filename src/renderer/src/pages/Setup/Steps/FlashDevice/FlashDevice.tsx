import React, { useEffect, useState } from 'react'

import Loader from '@/components/Loader/Loader.js'

import styles from './FlashDevice.module.css'

interface FlashDeviceProps {
  onStepComplete: () => void
}

enum State {
  Pending,
  Finding,
  Found,
  NotFound
}

const FlashDevice: React.FC<FlashDeviceProps> = ({ onStepComplete }) => {
  const [state, setState] = useState<State>(0)

  async function findCarThing() {
    setState(State.Finding)
    const found = await window.api.findCarThing()
    setState(found ? State.Found : State.NotFound)
  }

  useEffect(() => {
    window.api.findCarThing().then(found => {
      if (found) setState(State.Found)
    })
  }, [])

  return (
    <div className={styles.flash}>
      <p className={styles.step}>Step 1</p>
      <h1>Flash your device</h1>
      <p>First, you have to flash your device with a custom firmware.</p>
      <a
        href="https://github.com/BluDood/GlanceThing/wiki/Flashing-the-CarThing"
        target="_blank"
        rel="noreferrer"
      >
        Follow the guide here.
      </a>
      <p>
        Once you have completed the flash, press &quot;Find Car Thing&quot;
      </p>
      {state === State.Finding ? (
        <div className={styles.state} key={'finding'}>
          <Loader />
          <p>Finding CarThing...</p>
        </div>
      ) : state === State.Found ? (
        <div className={styles.state} key={'found'}>
          <span className="material-icons">check_circle</span>
          <p>Found CarThing!</p>
        </div>
      ) : state === State.NotFound ? (
        <div className={styles.state} key={'notfound'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>Could not find CarThing!</p>
        </div>
      ) : null}
      <div className={styles.buttons}>
        {[State.Pending, State.NotFound].includes(state) ? (
          <button onClick={findCarThing}>Find Car Thing</button>
        ) : state === State.Found ? (
          <button onClick={onStepComplete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

export default FlashDevice
