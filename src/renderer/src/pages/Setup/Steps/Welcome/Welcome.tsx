import React from 'react'

import styles from './Welcome.module.css'

import icon from '@/assets/icon.png'

interface WelcomeProps {
  onStepComplete: () => void
}

const Welcome: React.FC<WelcomeProps> = ({ onStepComplete }) => {
  return (
    <div className={styles.welcome}>
      <img src={icon} alt="" />
      <h1>Welcome to GlanceThing!</h1>
      <p>
        With only a few steps, you&apos;ll be up and running with
        GlanceThing.
      </p>
      <div className={styles.buttons}>
        <button onClick={onStepComplete}>Get Started</button>
      </div>
    </div>
  )
}

export default Welcome
