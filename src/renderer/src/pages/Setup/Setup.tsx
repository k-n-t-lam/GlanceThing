import React, { useState } from 'react'

import FlashDevice from './Steps/FlashDevice/FlashDevice.js'
import InstallApp from './Steps/InstallApp/InstallApp.js'
import Connect from './Steps/Connect/Connect.js'
import Welcome from './Steps/Welcome/Welcome.js'
import Done from './Steps/Done/Done.js'

import styles from './Setup.module.css'
import Spotify from './Steps/Spotify/Spotify.js'

enum Steps {
  Welcome,
  FlashDevice,
  InstallApp,
  Spotify,
  Connect,
  Complete
}

const Setup: React.FC = () => {
  const [step, setStep] = useState<Steps>(0)

  return (
    <div className={styles.setup}>
      {step === Steps.Welcome ? (
        <Welcome onStepComplete={() => setStep(Steps.FlashDevice)} />
      ) : step === Steps.FlashDevice ? (
        <FlashDevice onStepComplete={() => setStep(Steps.InstallApp)} />
      ) : step === Steps.InstallApp ? (
        <InstallApp onStepComplete={() => setStep(Steps.Spotify)} />
      ) : step === Steps.Spotify ? (
        <Spotify onStepComplete={() => setStep(Steps.Connect)} />
      ) : step === Steps.Connect ? (
        <Connect onStepComplete={() => setStep(Steps.Complete)} />
      ) : step === Steps.Complete ? (
        <Done />
      ) : null}
    </div>
  )
}

export default Setup
