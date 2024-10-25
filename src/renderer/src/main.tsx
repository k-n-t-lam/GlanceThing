import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import { DevModeContextProvider } from './contexts/DevModeContext.js'
import { ModalContextProvider } from './contexts/ModalContext.js'

import App from './App'

import './index.css'
import '@fontsource-variable/open-sans'
import '@fontsource/material-icons'

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  <React.StrictMode>
    <MemoryRouter>
      <DevModeContextProvider>
        <ModalContextProvider>
          <App />
        </ModalContextProvider>
      </DevModeContextProvider>
    </MemoryRouter>
  </React.StrictMode>
)
