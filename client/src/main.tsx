import { createRoot } from 'react-dom/client'

import { SocketContextProvider } from '@/contexts/SocketContext.tsx'
import { AppBlurContextProvider } from '@/contexts/AppBlurContext.tsx'

import App from '@/App.tsx'

import './index.css'
import '@fontsource-variable/open-sans'
import '@fontsource/material-icons'

const root = createRoot(document.getElementById('root')!)

root.render(
  <SocketContextProvider>
    <AppBlurContextProvider>
      <App />
    </AppBlurContextProvider>
  </SocketContextProvider>
)
