import React, { useEffect, useRef, useState } from 'react'
import styles from './Spotify.module.css'
import Loader from '@/components/Loader/Loader.js'

interface SpotifyProps {
  onStepComplete: () => void
}

enum SpotifyStep {
  API,
  Token
}

const Spotify: React.FC<SpotifyProps> = ({ onStepComplete }) => {
  const [step, setStep] = useState<SpotifyStep>(0)
  const credentialsRef = useRef<{
    clientId: string
    clientSecret: string
    refreshToken: string
  } | null>(null)
  const [hasSetup, setHasSetup] = useState(false)

  useEffect(() => {
    window.api.getPlaybackHandlerConfig('spotify').then(data => {
      if (data) setHasSetup(true)
    })
  }, [])

  return (
    <div className={styles.spotify}>
      {step === SpotifyStep.API ? (
        <SpotifyAPISetup
          onStepComplete={data => {
            setStep(SpotifyStep.Token)
            credentialsRef.current = data
          }}
        />
      ) : step === SpotifyStep.Token ? (
        <TokenSetup
          onStepComplete={data => {
            if (credentialsRef.current) {
              window.api.setPlaybackHandlerConfig('spotify', {
                ...credentialsRef.current,
                ...data
              })
              onStepComplete()
            }
          }}
        />
      ) : null}
      <div className={styles.hasSetup} data-shown={hasSetup}>
        <span className="material-icons">check_circle</span>
        <h2>Spotify is already set up!</h2>
        <p>You can choose to set it up again or skip this step.</p>
        <div className={styles.actions}>
          <button onClick={() => setHasSetup(false)}>Set up again</button>
          <button onClick={onStepComplete}>Continue</button>
        </div>
      </div>
    </div>
  )
}

interface SpotifyAPISetupProps {
  onStepComplete: (data: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }) => void
}

enum SpotifyAPISetupState {
  Pending,
  Checking,
  Valid,
  Invalid,
  Error
}

const SpotifyAPISetup: React.FC<SpotifyAPISetupProps> = ({
  onStepComplete
}) => {
  const [state, setState] = useState<SpotifyAPISetupState>(0)
  const [error, setError] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [isAuthorizing, setIsAuthorizing] = useState(false)

  const idRef = useRef<HTMLInputElement | null>(null)
  const secretRef = useRef<HTMLInputElement | null>(null)
  const tokenRef = useRef<HTMLInputElement | null>(null)

  async function startOAuth() {
    setError('')
    setIsAuthorizing(true)

    if (!clientId || !clientSecret) {
      setError('ID and Secret required')
      setIsAuthorizing(false)
      return
    }

    try {
      const token = await window.api.setupSpotifyOAuth(clientId, clientSecret)

      if (!token) {
        setError('No token received, please check your credentials')
        setIsAuthorizing(false)
        return
      }

      setRefreshToken(token)
      if (tokenRef.current) tokenRef.current.value = token

      setState(SpotifyAPISetupState.Pending)
      setError('')
    } catch (err: unknown) {
      setError('OAuth failed')
    }

    setIsAuthorizing(false)
  }

  async function check() {
    if (!clientId || !clientSecret || !refreshToken) {
      setError('All fields required')
      setState(SpotifyAPISetupState.Invalid)
      return
    }

    setError('')
    setState(SpotifyAPISetupState.Checking)

    try {
      const valid = await window.api.validateConfig('spotify', {
        clientId,
        clientSecret,
        refreshToken
      })

      if (valid) {
        setState(SpotifyAPISetupState.Valid)
      } else {
        setError('Invalid credentials')
        setState(SpotifyAPISetupState.Invalid)
      }
    } catch (err: unknown) {
      setError('Validation failed')
      setState(SpotifyAPISetupState.Error)
    }
  }

  function complete() {
    if (!clientId || !clientSecret || !refreshToken) {
      setError('All fields required')
      setState(SpotifyAPISetupState.Invalid)
      return
    }

    onStepComplete({ clientId, clientSecret, refreshToken })
  }

  return (
    <div className={styles.step}>
      <h2>Step 1: Spotify API Setup</h2>
      <p>
        GlanceThing required an Spotify Developer App authenticate your account and control playback via API.
      </p>
      <ol>
        <li>
          <b>Create Spotify Developer App</b> at{' '}
          <a href="https://developer.spotify.com/dashboard/applications" target="_blank" rel="noreferrer">Spotify Dashboard</a>
          <ul>
            <li>Create a new application and fill out a name and description. Check the box for use of the <code>Web API</code></li>
            <li>Add <code>glancething://spotify</code> as Redirect URI</li>
            <li>Copy Client ID and Secret below</li>
          </ul>
        </li>
        <div className={styles.inputs}>
          <input
            type="text"
            className={styles.input}
            placeholder="Client ID"
            ref={idRef}
            value={clientId}
            onChange={(e) => setClientId(e.target.value.trim())}
          />
          <input
            type="password"
            className={styles.input}
            placeholder="Client Secret"
            ref={secretRef}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value.trim())}
          />
        </div>
        <li>
          <b>Authorize with Spotify:</b>
          <button
            type="button"
            onClick={startOAuth}
            disabled={isAuthorizing || !clientId || !clientSecret}
            className={styles.authBtn}
          >
            {isAuthorizing ? 'Authorizing...' : 'Get Token'}
          </button>
        </li>
      </ol>
      <div className={styles.inputs}>
        <input
          type="hidden"
          className={styles.input}
          ref={tokenRef}
          value={refreshToken}
          readOnly={true}
          onChange={(e) => setRefreshToken(e.target.value.trim())}
        />
      </div>
      {state === SpotifyAPISetupState.Checking ? (
        <div className={styles.state} data-small="true" key={'checking'}>
          <Loader />
          <p>Checking...</p>
        </div>
      ) : state === SpotifyAPISetupState.Valid ? (
        <div className={styles.state} data-small="true" key={'valid'}>
          <span className="material-icons">check_circle</span>
          <p>Valid!</p>
        </div>
      ) : state === SpotifyAPISetupState.Invalid ? (
        <div className={styles.state} data-small="true" key={'invalid'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error ?? 'Invalid credentials'}</p>
        </div>
      ) : state === SpotifyAPISetupState.Error ? (
        <div className={styles.state} data-small="true" key={'error'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error}</p>
        </div>
      ) : refreshToken ? (
        <div className={styles.state} data-small="true" key={'token-received'}>
          <span className="material-icons">info</span>
          <p>Token received! Click Check to verify.</p>
        </div>
      ) : error ? (
        <div className={styles.state} data-small="true" key={'oauth-error'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error}</p>
        </div>
      ) : null}
      <div className={styles.buttons}>
        {[
          SpotifyAPISetupState.Pending,
          SpotifyAPISetupState.Error,
          SpotifyAPISetupState.Invalid
        ].includes(state) ? (
          <button onClick={check} disabled={state === SpotifyAPISetupState.Checking}>
            Check
          </button>
        ) : [SpotifyAPISetupState.Valid].includes(state) ? (
          <button onClick={complete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

interface TokenSetupProps {
  onStepComplete: (data: { sp_dc: string }) => void
}

enum TokenSetupState {
  Pending,
  Checking,
  Valid,
  Invalid,
  Error
}

const TokenSetup: React.FC<TokenSetupProps> = ({ onStepComplete }) => {
  const [state, setState] = useState<TokenSetupState>(0)
  const [error, setError] = useState('')
  const [spDcToken, setSpDcToken] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function check() {
    const token = spDcToken.trim()

    setError('')
    setState(TokenSetupState.Checking)

    if (!validate(token)) return

    try {
      const valid = await window.api.validateConfig('spotify', {
        sp_dc: token
      })

      if (valid) {
        setState(TokenSetupState.Valid)
      } else {
        setError('Invalid token')
        setState(TokenSetupState.Invalid)
      }
    } catch (err: unknown) {
      setError('Validation error')
      setState(TokenSetupState.Error)
    }
  }

  function complete() {
    const token = spDcToken.trim()
    if (!validate(token)) return
    onStepComplete({ sp_dc: token })
  }

  function validate(token: string) {
    if (!token || token.trim().length === 0) {
      setError('Token cannot be empty!')
      setState(TokenSetupState.Invalid)
      return false
    }

    if (token.includes('sp_dc=') || token.includes('"') || token.includes("'")) {
      setError('Only paste the token here, without sp_dc or quotes!')
      setState(TokenSetupState.Invalid)
      return false
    }

    if (!/^[A-Za-z0-9-_]+$/.test(token)) {
      setError('Invalid token format! Please check your input.')
      setState(TokenSetupState.Invalid)
      return false
    }
    return true
  }

  return (
    <div className={styles.step}>
      <h2>Step 2: Spotify Web Token Setup</h2>
      <p>
        GlanceThing needs an extra to enable realtime playback updates,
        You can check detail in{' '}
        <a
          href="https://github.com/BluDood/GlanceThing/wiki/Getting-your-Spotify-token"
          target="_blank"
          rel="noreferrer"
        >
          this guide
        </a>.
      </p>
      <ol>
        <li>Open <a href="https://open.spotify.com" target="_blank" rel="noreferrer">Spotify Web Player</a> in incognito mode and log in</li>
        <li>Open DevTools (CTRL+SHIFT+I)</li>
        <li>Go to <code>Storage</code> (Firefox) or <code>Application</code> (Chrome)</li>
        <li>Go to <code>Cookies</code>, <code>https://open.spotify.com</code>, and search for <code>sp_dc</code></li>
        <li>Copy the value below</li>
      </ol>
      <div className={styles.inputs}>
        <input
          ref={inputRef}
          disabled={[
            TokenSetupState.Checking,
            TokenSetupState.Valid
          ].includes(state)}
          type="password"
          placeholder="sp_dc token"
          className={styles.input}
          value={spDcToken}
          onChange={(e) => setSpDcToken(e.target.value.trim())}
        />
      </div>
      {state === TokenSetupState.Checking ? (
        <div className={styles.state} data-small="true" key={'checking'}>
          <Loader />
          <p>Checking...</p>
        </div>
      ) : state === TokenSetupState.Valid ? (
        <div className={styles.state} data-small="true" key={'valid'}>
          <span className="material-icons">check_circle</span>
          <p>Valid!</p>
        </div>
      ) : state === TokenSetupState.Invalid ? (
        <div className={styles.state} data-small="true" key={'invalid'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error ?? 'Invalid token!'}</p>
        </div>
      ) : state === TokenSetupState.Error ? (
        <div className={styles.state} data-small="true" key={'error'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error}</p>
        </div>
      ) : null}
      <div className={styles.buttons}>
        {[
          TokenSetupState.Pending,
          TokenSetupState.Error,
          TokenSetupState.Invalid
        ].includes(state) ? (
          <button
            onClick={check}
            disabled={state === TokenSetupState.Checking}
            data-hidden={state === TokenSetupState.Valid}
          >
            Check
          </button>
        ) : [TokenSetupState.Valid].includes(state) ? (
          <button onClick={complete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

export default Spotify
