import React, { useEffect, useRef, useState } from 'react'

import Loader from '@/components/Loader/Loader.js'

import styles from './Spotify.module.css'

interface SpotifyProps {
  onStepComplete: () => void
}

enum State {
  Pending,
  Checking,
  Valid,
  Invalid
}

const Spotify: React.FC<SpotifyProps> = ({ onStepComplete }) => {
  const [state, setState] = useState<State>(0)

  const inputRef = useRef<HTMLInputElement | null>(null)

  async function check() {
    const token = inputRef.current!.value
    setState(State.Checking)
    const valid = await window.api.setSpotifyToken(token)
    if (valid) setState(State.Valid)
    else setState(State.Invalid)
  }

  useEffect(() => {
    window.api.getStorageValue('sp_dc').then(t => {
      if (t) setState(State.Valid)
    })
  }, [])

  return (
    <div className={styles.spotify}>
      <p className={styles.step}>Step 3</p>
      <h1>Getting Spotify Token</h1>
      <p>
        Now you&apos;ll get your Spotify token, so GlanceThing can show you
        your playback status live.
      </p>
      <a
        href="https://github.com/BluDood/GlanceThing/wiki/Getting-your-Spotify-token"
        target="_blank"
        rel="noreferrer"
      >
        Follow this guide on how to get it.
      </a>
      <input
        ref={inputRef}
        disabled={[State.Checking, State.Valid].includes(state)}
        type="password"
        placeholder="sp_dc token"
      />
      {state === State.Checking ? (
        <div className={styles.state} key={'checking'}>
          <Loader />
          <p>Checking...</p>
        </div>
      ) : state === State.Valid ? (
        <div className={styles.state} key={'valid'}>
          <span className="material-icons">check_circle</span>
          <p>Valid!</p>
        </div>
      ) : state === State.Invalid ? (
        <div className={styles.state} key={'invalid'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>Invalid token!</p>
        </div>
      ) : null}
      <div className={styles.buttons}>
        {[State.Pending, State.Invalid].includes(state) ? (
          <button onClick={check}>Check</button>
        ) : state === State.Valid ? (
          <button onClick={onStepComplete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

export default Spotify
