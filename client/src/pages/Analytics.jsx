import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = ['#22c55e','#f0a500','#3b82f6','#f97316','#a855f7','#ef4444']
const fmt = n => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n ?? 0)

export default function Analytics() {
  const [calls, setCalls]       = useState([])
  const [wa, setWa]             = useState([])
  const [growth, setGrowth]     = useState([])
  const [districts, setDist]    = useState([])
  const [intents, setIntents]   = useState([])
  const [menus, setMenus]       = useState([])
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('ivr')

  useEffect(() => {
    Promise.all([
      axios.get('/api/analytics/summary'),
      axios.get('/api/analytics/calls/daily'),
      axios.get('/api/analytics/whatsapp/daily'),
      axios.get('/api/analytics/farmers/growth'),
      axios.get('/api/analytics/districts'),
      axios.get('/api/analytics/whatsapp/intents'),
      axios.get('/api/analytics/ivr/menus'),
    ]).then(([s, c, w, g, d, i, m]) => {
      setSummary(s.data)
      setCalls(c.data.map(r => ({ ...r, date: r.date?.slice(5) })))
      setWa(w.data.map(r => ({ ...r, date: r.date?.slice(5), avg_messages: Number(r.avg_messages).toFixed(1) })))
      setGrowth(g.data)
      setDist(d.data)
      setIntents(i.data)
      setMenus(m.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading analytics…</p></div>

  const ivrStats = [
    { label: 'Total IVR Calls', value: fmt(summary?.totalCalls), icon: '📞', color: 'var(--blue)' },
    { label: 'Today\'s Calls',  value: summary?.todayCalls,      icon: '📅', color: 'var(--green-primary)' },
  ]
  const waStats = [
    { label: 'WA Sessions',  value: fmt(summary?.totalWASessions), icon: '💬', color: 'var(--gold)' },
    { label: 'WA Opted-In',  value: fmt(summary?.whatsappOpted),   icon: '✅', color: 'var(--green-primary)' },
  ]

  return (
    <div>
      <div className="tabs">
        {['ivr', 'whatsapp', 'farmers', 'districts'].map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {{ ivr: '📞 IVR', whatsapp: '💬 WhatsApp', farmers: '👨‍🌾 Farmers', districts: '🗺️ Districts' }[t]}
          </button>
        ))}
      </div>

      {/* ── IVR TAB ── */}
      {tab === 'ivr' && (
        <div>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            {ivrStats.map(s => (
              <div key={s.label} className="stat-card green">
                <div className="stat-icon blue" style={{ fontSize: 22 }}>{s.icon}</div>
                <div className="stat-body">
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Daily Call Volume (30 days)</div></div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={calls}>
                  <defs>
                    <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="calls" stroke="#3b82f6" fill="url(#callGrad)" strokeWidth={2} name="Total Calls" />
                  <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="none" strokeWidth={1.5} name="Completed" strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">IVR Menu Selection Breakdown</div></div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={menus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Selections" radius={[4,4,0,0]}>
                    {menus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* IVR Call Log Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span className="card-title">Recent IVR Call Logs</span>
            </div>
            <RecentCallsTable />
          </div>
        </div>
      )}

      {/* ── WHATSAPP TAB ── */}
      {tab === 'whatsapp' && (
        <div>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            {waStats.map(s => (
              <div key={s.label} className="stat-card gold">
                <div className="stat-icon gold" style={{ fontSize: 22 }}>{s.icon}</div>
                <div className="stat-body">
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Daily WA Sessions (30 days)</div></div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={wa}>
                  <defs>
                    <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f0a500" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f0a500" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="sessions" stroke="#f0a500" fill="url(#waGrad)" strokeWidth={2} name="Sessions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Bot Intent Distribution</div></div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={intents} dataKey="count" nameKey="intent" cx="50%" cy="50%" outerRadius={85} paddingAngle={4}>
                    {intents.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── FARMERS TAB ── */}
      {tab === 'farmers' && (
        <div>
          <div className="card">
            <div className="card-header"><div className="card-title">Monthly Farmer Registration Growth</div></div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="new_farmers" name="New Farmers" fill="#22c55e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── DISTRICTS TAB ── */}
      {tab === 'districts' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title">District Performance Leaderboard</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Rank</th><th>District</th><th>Farmers</th><th>IVR Calls</th><th>WA Sessions</th><th>Engagement</th></tr>
              </thead>
              <tbody>
                {districts.map((d, i) => {
                  const total = d.calls + d.sessions
                  const maxTotal = districts[0] ? districts[0].calls + districts[0].sessions : 1
                  return (
                    <tr key={d.district}>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 14, color: i === 0 ? 'var(--gold)' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2f' : 'var(--text-muted)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.district}</td>
                      <td><span className="badge badge-green">{d.farmers}</span></td>
                      <td><span className="badge badge-blue">{d.calls}</span></td>
                      <td><span className="badge badge-gold">{d.sessions}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                            <div style={{ width: `${maxTotal > 0 ? (total / maxTotal) * 100 : 0}%`, height: '100%', background: 'var(--green-primary)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function RecentCallsTable() {
  const [logs, setLogs] = useState([])
  useEffect(() => { axios.get('/api/ivr/logs').then(r => setLogs(r.data.slice(0, 15))) }, [])
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Mobile</th><th>Farmer</th><th>District</th><th>Crop</th><th>Duration</th><th>Menus</th><th>Status</th></tr></thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td style={{ fontSize: 11 }}>{l.created_at?.slice(0,16)}</td>
              <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{l.mobile}</td>
              <td>{l.farmer_name || <span style={{ color: 'var(--text-muted)' }}>New User</span>}</td>
              <td>{l.district || '—'}</td>
              <td>{l.crop ? <span className="badge badge-green">{l.crop}</span> : '—'}</td>
              <td>{l.duration}s</td>
              <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{l.menu_selections || '—'}</td>
              <td><span className={`badge ${l.status === 'completed' ? 'badge-green' : l.status === 'dropped' ? 'badge-orange' : 'badge-gray'}`}>{l.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
