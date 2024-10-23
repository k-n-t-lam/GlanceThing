import Loader from '@/components/Loading/Loader.tsx'

import styles from './RestoreScreen.module.css'

const RestoreScreen: React.FC = () => {
  return (
    <div className={styles.restore}>
      <div className={styles.background}></div>
      <Loader />
      <p>Restoring...</p>
    </div>
  )
}

export default RestoreScreen
