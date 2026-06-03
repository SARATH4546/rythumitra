import { useLocation } from 'react-router-dom'
import { RefreshCw, Download } from 'lucide-react'

const TITLES = {
  '/dashboard': { title: 'Overview', sub: 'Real-time platform metrics' },
  '/farmers':   { title: 'Farmers', sub: 'Registered farmer profiles' },
  '/prices':    { title: 'Mandi Prices', sub: 'Daily market price management' },
  '/schemes':   { title: 'Government Schemes', sub: 'Scheme information & eligibility' },
  '/alerts':    { title: 'Alerts & Broadcasts', sub: 'Push alert management' },
  '/analytics': { title: 'Analytics', sub: 'Call logs, engagement & growth' },
  '/ivr':       { title: 'IVR Simulator', sub: 'Simulate farmer call flow' },
  '/whatsapp':  { title: 'WhatsApp Bot', sub: 'Simulate bot conversation' },
}

export default function Header() {
  const { pathname } = useLocation()
  const { title, sub } = TITLES[pathname] || { title: 'RythuMitra', sub: '' }

  const now = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <header className="header">
      <div className="header-left">
        <span className="header-title">{title}</span>
        <span className="header-subtitle">{sub} · {now}</span>
      </div>
      <div className="header-right">
        <button className="header-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Refresh
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-primary)', animation: 'pulse 2s infinite' }} />
          <span style={{ color: 'var(--text-muted)' }}>Live · AP</span>
        </div>
      </div>
    </header>
  )
}
