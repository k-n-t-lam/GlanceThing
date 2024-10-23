import { useContext } from 'react'

import Loader from '@/components/Loading/Loader.tsx'

import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './LoadingScreen.module.css'

const LoadingScreen: React.FC = () => {
  const { ready, firstLoad } = useContext(SocketContext)

  return (
    <div className={styles.loading} data-shown={!ready}>
      <div className={styles.background} />
      {firstLoad ? (
        <>
          <img src="./icon.png" alt="" />
          <h1>Welcome to GlanceThing!</h1>
          <p>
            Open GlanceThing on your computer and follow the instructions.
          </p>
        </>
      ) : (
        <>
          <Loader />
          <p>Reconnecting...</p>
        </>
      )}
    </div>
  )
}

export default LoadingScreen
