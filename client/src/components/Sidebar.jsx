import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, TrendingUp, ScrollText,
  Bell, BarChart3, Phone, MessageCircle, Microscope, Mic
} from 'lucide-react'

const NAV = [
  { label: 'Overview',    icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Farmers',     icon: Users,           to: '/farmers' },
  { label: 'Mandi Prices',icon: TrendingUp,      to: '/prices' },
  { label: 'Schemes',     icon: ScrollText,      to: '/schemes' },
  { label: 'Alerts',      icon: Bell,            to: '/alerts' },
  { label: 'Analytics',   icon: BarChart3,       to: '/analytics' },
]

const SIM_NAV = [
  { label: 'IVR Simulator',     icon: Phone,         to: '/ivr' },
  { label: 'WhatsApp Bot',      icon: MessageCircle, to: '/whatsapp' },
]

const AI_NAV = [
  { label: 'Disease Detection', icon: Microscope,    to: '/disease', badge: '🤖 AI' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">🌾</div>
          <div className="logo-text">
            <span className="logo-title">RythuMitra</span>
            <span className="logo-sub">Admin Dashboard</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV.map(({ label, icon: Icon, to }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon className="nav-icon" size={16} />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: 12 }}>Simulators</div>
        {SIM_NAV.map(({ label, icon: Icon, to }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon className="nav-icon" size={16} />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: 12 }}>AI Features</div>
        {AI_NAV.map(({ label, icon: Icon, to, badge }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon className="nav-icon" size={16} />
            {label}
            {badge && <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:8, background:'rgba(139,92,246,0.2)', color:'#8b5cf6' }}>{badge}</span>}
          </NavLink>
        ))}

      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <div className="status-dot" />
          <span>API Server Online</span>
        </div>
        <div style={{ marginTop: 8, padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
          Andhra Pradesh · Phase 1
        </div>
      </div>
    </aside>
  )
}
