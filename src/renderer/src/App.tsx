import { Route, Routes } from 'react-router-dom'

import Developer from './pages/Developer/Developer.js'
import Setup from './pages/Setup/Setup.js'
import Layout from './components/Layout/Layout.js'
import Home from './pages/Home/Home.js'

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/developer" element={<Developer />} />
      </Route>
    </Routes>
  )
}

export default App
