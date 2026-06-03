import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, Phone, MessageCircle, Bell, TrendingUp, Activity, Zap, Map } from 'lucide-react'

const COLORS = ['#22c55e', '#f0a500', '#3b82f6', '#f97316', '#a855f7']

const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n

export default function Dashboard() {
  const [summary, setSummary]   = useState(null)
  const [callData, setCallData] = useState([])
  const [waData, setWaData]     = useState([])
  const [growth, setGrowth]     = useState([])
  const [districts, setDistricts] = useState([])
  const [intents, setIntents]   = useState([])
  const [spikes, setSpikes]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get('/api/analytics/summary'),
      axios.get('/api/analytics/calls/daily'),
      axios.get('/api/analytics/whatsapp/daily'),
      axios.get('/api/analytics/farmers/growth'),
      axios.get('/api/analytics/districts'),
      axios.get('/api/analytics/whatsapp/intents'),
      axios.get('/api/prices/spikes'),
    ]).then(([s, c, w, g, d, i, sp]) => {
      setSummary(s.data)
      setCallData(c.data.slice(-14).map(r => ({ ...r, date: r.date?.slice(5) })))
      setWaData(w.data.slice(-14).map(r => ({ ...r, date: r.date?.slice(5) })))
      setGrowth(g.data)
      setDistricts(d.data.slice(0, 6))
      setIntents(i.data)
      setSpikes(sp.data.slice(0, 5))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="loading-page">
      <div className="spinner" />
      <p>Loading dashboard…</p>
    </div>
  )

  const STATS = [
    { label: 'Total Farmers', value: fmt(summary?.totalFarmers || 0), icon: '👨‍🌾', color: 'green', change: `+${summary?.recentWeek || 0} this week`, dir: 'up' },
    { label: 'WhatsApp Opted-In', value: fmt(summary?.whatsappOpted || 0), icon: '💬', color: 'gold', change: `${summary?.ivrOnly || 0} IVR-only`, dir: 'up' },
    { label: 'IVR Calls Today', value: summary?.todayCalls || 0, icon: '📞', color: 'blue', change: `${fmt(summary?.totalCalls || 0)} total`, dir: 'up' },
    { label: 'WA Sessions', value: fmt(summary?.totalWASessions || 0), icon: '📱', color: 'orange', change: 'last 30 days', dir: 'up' },
    { label: 'Alerts Sent', value: summary?.alertsSent || 0, icon: '🔔', color: 'purple', change: `${fmt(summary?.alertsDelivered || 0)} delivered`, dir: 'up' },
  ]

  return (
    <div>
      {/* KPI Stats */}
      <div className="stat-grid">
        {STATS.map(s => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div className={`stat-icon ${s.color}`} style={{ fontSize: 22 }}>{s.icon}</div>
            <div className="stat-body">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className={`stat-change ${s.dir}`}>▲ {s.change}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Price Spikes Banner */}
      {spikes.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(240,165,0,0.12), rgba(249,115,22,0.08))',
          border: '1px solid rgba(240,165,0,0.25)',
          borderRadius: 'var(--radius)',
          padding: '12px 20px',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="var(--gold)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>Price Alerts</span>
          </div>
          {spikes.map((s, i) => (
            <span key={i} className={`badge ${s.change_pct > 0 ? 'badge-green' : 'badge-red'}`}>
              {s.crop} · {s.district}: {s.change_pct > 0 ? '▲' : '▼'} {Math.abs(s.change_pct)}% · ₹{s.price_modal.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">IVR Calls — Last 14 Days</div>
              <div className="card-subtitle">Daily incoming call volume</div>
            </div>
            <Phone size={16} color="var(--text-muted)" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={callData}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="calls" stroke="#22c55e" fill="url(#cg)" strokeWidth={2} name="Calls" />
              <Area type="monotone" dataKey="completed" stroke="#3b82f6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Completed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">WhatsApp Sessions — Last 14 Days</div>
              <div className="card-subtitle">Daily bot conversation volume</div>
            </div>
            <MessageCircle size={16} color="var(--text-muted)" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={waData}>
              <defs>
                <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f0a500" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f0a500" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="sessions" stroke="#f0a500" fill="url(#wg)" strokeWidth={2} name="Sessions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2-1" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">District Leaderboard</div>
              <div className="card-subtitle">Farmers, calls & WhatsApp sessions by district</div>
            </div>
            <Map size={16} color="var(--text-muted)" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={districts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis dataKey="district" type="category" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={90} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="farmers" name="Farmers" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="calls"   name="IVR Calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="sessions" name="WhatsApp" fill="#f0a500" radius={[0, 4, 4, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Bot Intents</div>
              <div className="card-subtitle">WhatsApp query breakdown</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={intents} dataKey="count" nameKey="intent" cx="50%" cy="50%" outerRadius={80} paddingAngle={3} label={({ intent, percent }) => `${intent} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10, fill: 'var(--text-muted)' }}>
                {intents.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Farmer Growth */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Farmer Registration Growth</div>
            <div className="card-subtitle">Monthly new registrations</div>
          </div>
          <Users size={16} color="var(--text-muted)" />
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={growth}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="new_farmers" name="New Farmers" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
