import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Guilds from './pages/Guilds'
import Channels from './pages/Channels'
import Invites from './pages/Invites'
import Members from './pages/Members'
import Messages from './pages/Messages'
import SendMessage from './pages/SendMessage'
import Favorites from './pages/Favorites'
import Trawl from './pages/Trawl'
import Rag from './pages/Rag'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Help from './pages/Help'
import Tools from './pages/Tools'
import Skills from './pages/Skills'
import Apps from './pages/Apps'

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/guilds" element={<Guilds />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/invites" element={<Invites />} />
        <Route path="/members" element={<Members />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/send" element={<SendMessage />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/trawl" element={<Trawl />} />
        <Route path="/rag" element={<Rag />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}
