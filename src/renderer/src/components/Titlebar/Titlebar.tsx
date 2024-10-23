import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ModalContext } from '@/contexts/ModalContext.js'

import styles from './Titlebar.module.css'

const Titlebar: React.FC = () => {
  const navigate = useNavigate()
  const { setSettingsOpen, setShortcutsEditorOpen } =
    useContext(ModalContext)

  const [devMode, setDevMode] = useState(false)

  const buttons = [
    ...(devMode
      ? [
          {
            icon: 'code',
            action: () => navigate('/developer')
          }
        ]
      : []),
    {
      icon: 'apps',
      action: () => setShortcutsEditorOpen(true)
    },
    {
      icon: 'settings',
      action: () => setSettingsOpen(true)
    },
    {
      icon: 'close',
      action: () => window.close()
    }
  ]

  useEffect(() => {
    window.api.isDevMode().then(setDevMode)
  }, [])

  return (
    <div className={styles.titlebar}>
      <div className={styles.actions}>
        {buttons.map(({ icon, action }) => (
          <button key={icon} onClick={action}>
            <span className="material-icons">{icon}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Titlebar
