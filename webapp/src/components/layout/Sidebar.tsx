import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  Hash,
  Link2,
  Users,
  MessageSquare,
  Send,
  Star,
  Search,
  BarChart3,
  Settings,
  HelpCircle,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Terminal,
  BookMarked,
  LayoutGrid,
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/guilds', label: 'Guilds', icon: Server },
  { path: '/channels', label: 'Channels', icon: Hash },
  { path: '/invites', label: 'Invites', icon: Link2 },
  { path: '/members', label: 'Members', icon: Users },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
  { path: '/send', label: 'Send message', icon: Send },
  { path: '/favorites', label: 'Favorites', icon: Star },
  { path: '/trawl', label: 'Trawl', icon: Search },
  { path: '/rag', label: 'RAG (LanceDB)', icon: Database },
  { path: '/stats', label: 'Statistics', icon: BarChart3 },
  { path: '/tools', label: 'Tools', icon: Terminal },
  { path: '/skills', label: 'Skills', icon: BookMarked },
  { path: '/apps', label: 'Apps', icon: LayoutGrid },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help', icon: HelpCircle },
]

export default function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      style={{ width: isCollapsed ? 80 : 260 }}
      className="relative flex flex-col bg-[#0f0f12] border-r border-white/5 z-50 overflow-hidden transition-[width] duration-200"
    >
      <div className="h-20 flex items-center px-6 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <MessageCircle className="text-white w-6 h-6" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold tracking-tight text-white leading-tight">Discord MCP</span>
              <span className="text-[10px] font-medium text-indigo-400/80 uppercase tracking-widest">Dashboard</span>
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-[#0f0f12] border border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-300"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
