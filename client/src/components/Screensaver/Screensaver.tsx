import React, { useEffect, useState } from 'react'

import { SleepState } from '@/contexts/SleepContext.tsx'

import styles from './Screensaver.module.css'

interface ScreensaverProps {
  type: SleepState
}

const Screensaver: React.FC<ScreensaverProps> = ({ type }) => {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (type === 'screensaver') {
      setLoaded(true)
    } else {
      setTimeout(() => {
        setLoaded(false)
      }, 500)
    }
  }, [type])

  return (
    <div className={styles.screensaver} data-active={type !== 'off'}>
      {loaded && (
        <>
          <div className={styles.circle1}></div>
          <div className={styles.circle2}></div>
          <div className={styles.circle3}></div>
        </>
      )}
    </div>
  )
}

export default Screensaver
