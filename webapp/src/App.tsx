import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Apps from "./pages/Apps";
import Channels from "./pages/Channels";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Favorites from "./pages/Favorites";
import Guilds from "./pages/Guilds";
import Help from "./pages/Help";
import Invites from "./pages/Invites";
import Members from "./pages/Members";
import Messages from "./pages/Messages";
import Rag from "./pages/Rag";
import SendMessage from "./pages/SendMessage";
import Settings from "./pages/Settings";
import Skills from "./pages/Skills";
import Stats from "./pages/Stats";
import Tools from "./pages/Tools";
import Trawl from "./pages/Trawl";

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
        <Route path="/chat" element={<Chat />} />
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
  );
}
