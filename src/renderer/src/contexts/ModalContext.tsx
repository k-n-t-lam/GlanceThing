import { createContext, useState } from 'react'

interface ModalContextType {
  settingsOpen: boolean
  setSettingsOpen: (value: boolean) => void
  shortcutsEditorOpen: boolean
  setShortcutsEditorOpen: (value: boolean) => void
}

const ModalContext = createContext<ModalContextType>({
  settingsOpen: false,
  setSettingsOpen: () => {},
  shortcutsEditorOpen: false,
  setShortcutsEditorOpen: () => {}
})

interface ModalContextProviderProps {
  children: React.ReactNode
}

const ModalContextProvider = ({ children }: ModalContextProviderProps) => {
  const [settingsOpen, _setSettingsOpen] = useState(false)
  const [shortcutsEditorOpen, _setShortcutsEditorOpen] = useState(false)

  function setSettingsOpen(value: boolean) {
    if (value) {
      _setShortcutsEditorOpen(false)
      _setSettingsOpen(true)
    } else {
      _setSettingsOpen(false)
    }
  }

  function setShortcutsEditorOpen(value: boolean) {
    if (value) {
      _setSettingsOpen(false)
      _setShortcutsEditorOpen(true)
    } else {
      _setShortcutsEditorOpen(false)
    }
  }

  return (
    <ModalContext.Provider
      value={{
        settingsOpen,
        setSettingsOpen,
        shortcutsEditorOpen,
        setShortcutsEditorOpen
      }}
    >
      {children}
    </ModalContext.Provider>
  )
}

export { ModalContext, ModalContextProvider }
