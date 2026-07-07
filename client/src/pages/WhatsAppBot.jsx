import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Send, Mic, User } from 'lucide-react'

const DISTRICTS = ['Guntur','Krishna','Kurnool','East Godavari','West Godavari','Visakhapatnam','Nellore']
const CROPS     = ['Paddy','Cotton','Chilli','Groundnut','Maize','Onion','Tomato','Turmeric']

const QUICK_MSGS = [
  { label: '👋 Hello', text: 'Hello' },
  { label: '📈 ధర', text: 'ధర' },
  { label: '📋 పథకాలు', text: 'పథకం' },
  { label: '🌦️ వాతావరణం', text: 'వాతావరణం' },
  { label: '💳 రుణం', text: 'రుణం' },
  { label: '🛑 Stop', text: 'stop' },
]

export default function WhatsAppBot() {
  const [mobile, setMobile]     = useState('917890123456')
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [sending, setSending]   = useState(false)
  const [regStep, setRegStep]   = useState(null)
  const [regData, setRegData]   = useState({ district: '', primary_crop: '' })
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const addMsg = (role, content) => setMessages(m => [...m, { role, content, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }])

  const send = async (text) => {
    if (!text.trim() || sending) return
    addMsg('user', [{ type: 'text', text, text_en: text }])
    setInput('')
    setSending(true)
    try {
      const r = await axios.post('/api/whatsapp/message', { mobile, text, session_id: sessionId })
      if (r.data.session_id) setSessionId(r.data.session_id)
      addMsg('bot', r.data.messages)

      // If registration flow detected, setup state
      if (r.data.is_new) setRegStep('district')
    } catch (e) {
      addMsg('bot', [{ type: 'text', text: '❌ Error connecting to bot server', text_en: '' }])
    }
    setSending(false)
  }

  const handleQR = async (value) => {
    // Handle quick reply values
    if (value.startsWith('district_')) {
      const dist = value.replace('district_', '')
      setRegData(d => ({ ...d, district: dist }))
      addMsg('user', [{ type: 'text', text: `📍 ${dist}`, text_en: dist }])
      setSending(true)
      try {
        const r = await axios.post('/api/whatsapp/message', { mobile, text: dist, session_id: sessionId })
        if (r.data.session_id) setSessionId(r.data.session_id)
        addMsg('bot', r.data.messages)
      } catch {}
      setSending(false)
      return
    }
    send(value)
  }

  const handleRegister = async () => {
    if (!regData.district || !regData.primary_crop) return
    try {
      await axios.post('/api/whatsapp/register', { mobile, ...regData })
      setRegStep(null)
      addMsg('bot', [{
        type: 'text',
        text: `✅ నమోదు పూర్తయింది! ${regData.district} జిల్లాలో ${regData.primary_crop} రైతుగా నమోదు అయ్యారు.\n\nఇప్పుడు మీరు "ధర" పంపి నేటి ధర తెలుసుకోవచ్చు.`,
        text_en: `Registration complete! You are now registered as a ${regData.primary_crop} farmer in ${regData.district}.`
      }])
    } catch {}
  }

  const clearChat = () => { setMessages([]); setSessionId(null); setRegStep(null) }

  const renderMessage = (msg, i) => {
    if (msg.type === 'text') {
      return (
        <div key={i}>
          <div className="telugu" style={{ fontSize: 13, lineHeight: 1.6 }}>{msg.text}</div>
          {msg.text_en && msg.text_en !== msg.text && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{msg.text_en}</div>
          )}
        </div>
      )
    }

    if (msg.type === 'voice_note') {
      const audioFile = msg.audio_file || 'greeting_new'
      const audioUrl  = `/audio/${audioFile}.mp3`
      return (
        <div key={i} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mic size={14} color="#000" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 20 }}>
                {Array.from({ length: 24 }, (_, j) => (
                  <div key={j} style={{ width: 2, height: `${6 + Math.abs(Math.sin(j * 0.8) * 10)}px`, background: 'var(--green-primary)', borderRadius: 1, opacity: 0.75 }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Telugu Voice Note</div>
            </div>
          </div>
          <audio
            controls
            src={audioUrl}
            style={{ width: '100%', height: 32, borderRadius: 8, outline: 'none', accentColor: '#22c55e' }}
            onError={e => e.target.style.display='none'}
          />
          {msg.audio_label && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{msg.audio_label}</div>
          )}
        </div>
      )
    }

    if (msg.type === 'price_card') {
      const pd = msg.data
      return pd ? (
        <div key={i} style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(240,165,0,0.1))', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>🌾</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{pd.crop}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {pd.district} Mandi · {pd.date}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            {[['Min', pd.min, '#94a3b8'], ['Modal', pd.modal, '#22c55e'], ['Max', pd.max, '#f0a500']].map(([label, val, color]) => (
              <div key={label} style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 4px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{val ? `₹${Number(val).toLocaleString('en-IN')}` : '—'}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>/{pd.unit}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>Source: {pd.source}</div>
        </div>
      ) : null
    }

    if (msg.type === 'scheme_card') {
      const sd = msg.data
      return (
        <div key={i} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>📋 {sd.name}</div>
          {sd.name_telugu && <div className="telugu" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{sd.name_telugu}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sd.benefit}</div>
          {sd.amount && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>{sd.amount}</div>}
          {sd.deadline && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>⏰ Deadline: {sd.deadline}</div>}
        </div>
      )
    }

    if (msg.type === 'weather_card') {
      return (
        <div key={i} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🌦️ {msg.district} Weather Forecast</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {msg.forecast?.map((f, fi) => (
              <div key={fi} style={{ flex: 1, textAlign: 'center', background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.day}</div>
                <div style={{ fontSize: 20, margin: '4px 0' }}>{f.icon}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{f.condition}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{f.temp}</div>
                <div style={{ fontSize: 10, color: '#3b82f6' }}>💧 {f.rain}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (msg.type === 'loan_card') {
      return (
        <div key={i}>
          {msg.data?.map((loan, li) => (
            <div key={li} style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>💳 {loan.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>📊 Interest: <strong style={{ color: 'var(--green-primary)' }}>{loan.interest}</strong></span>
                <span>💰 Limit: <strong style={{ color: 'var(--gold)' }}>{loan.limit}</strong></span>
                <span>📞 Contact: {loan.contact}</span>
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (msg.type === 'quick_reply') {
      return (
        <div key={i} className="sim-quick-replies">
          {msg.options?.map((opt, oi) => (
            <button key={oi} className="sim-qr-btn" onClick={() => handleQR(opt.value)}>{opt.label}</button>
          ))}
        </div>
      )
    }

    if (msg.type === 'price_chart') {
      return (
        <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>7-Day Price Trend</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
            {msg.data?.map((d, di) => {
              const prices = msg.data.map(x => x.price_modal)
              const maxP = Math.max(...prices), minP = Math.min(...prices)
              const h = maxP === minP ? 18 : Math.round(((d.price_modal - minP) / (maxP - minP)) * 28) + 8
              return <div key={di} style={{ flex: 1, height: h, background: 'var(--green-primary)', borderRadius: '2px 2px 0 0', opacity: 0.7 + (di / msg.data.length) * 0.3 }} title={`₹${d.price_modal}`} />
            })}
          </div>
        </div>
      )
    }

    return null
  }



  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      {/* Left: Info */}
      <div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>💬 WhatsApp Bot Simulator</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
            Simulate the RythuMitra WhatsApp bot experience. The bot detects intent from Telugu and English text, responds with voice notes, price cards, scheme cards, and weather forecasts.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Farmer Mobile</label>
              <input className="form-control" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="91XXXXXXXXXX" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={clearChat}>Clear Chat</button>
            </div>
          </div>

          {/* Intent triggers reference */}
          <div style={{ marginTop: 16, background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Intent Trigger Keywords</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['📈 Price', '"ధర", "price", "rate", "mandi"'],
                ['📋 Scheme', '"పథకం", "scheme", "yojana"'],
                ['🌦️ Weather', '"వాతావరణం", "weather", "rain"'],
                ['💳 Loan', '"రుణం", "loan", "KCC", "credit"'],
                ['👋 Greeting', '"Hello", "నమస్కారం", "start"'],
                ['🛑 Stop', '"stop", "unsubscribe", "ఆపు"'],
              ].map(([k, v]) => (
                <div key={k} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{k}:</span> {v}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Registration panel if needed */}
        {regStep && (
          <div className="card" style={{ border: '1px solid rgba(240,165,0,0.3)' }}>
            <div className="card-title" style={{ marginBottom: 12, color: 'var(--gold)' }}>📝 Complete Registration</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District *</label>
                <select className="form-control" value={regData.district} onChange={e => setRegData(d => ({ ...d, district: e.target.value }))}>
                  <option value="">Select district</option>
                  {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Primary Crop *</label>
                <select className="form-control" value={regData.primary_crop} onChange={e => setRegData(d => ({ ...d, primary_crop: e.target.value }))}>
                  <option value="">Select crop</option>
                  {CROPS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleRegister}>Complete Registration</button>
          </div>
        )}

        {/* WhatsApp Sessions table */}
        <SessionsTable mobile={mobile} />
      </div>

      {/* Right: Chat UI */}
      <div>
        <div className="sim-phone">
          {/* WA header */}
          <div className="sim-header">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌾</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>RythuMitra</div>
              <div style={{ fontSize: 11, color: '#25d366' }}>● Online · Telugu Bot</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📲 WA</div>
          </div>

          {/* Chat messages */}
          <div ref={chatRef} className="sim-screen">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                Send a message to start the conversation.<br />
                Try "Hello" or "ధర"
              </div>
            )}
            {messages.map((m, mi) => (
              <div key={mi} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={`sim-bubble ${m.role === 'user' ? 'user' : 'bot'}`} style={{ maxWidth: '85%' }}>
                  {Array.isArray(m.content)
                    ? m.content.map((c, ci) => renderMessage(c, ci))
                    : <div style={{ fontSize: 13 }}>{m.content}</div>
                  }
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                    {m.time} {m.role === 'user' ? '✓✓' : ''}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div className="sim-bubble bot" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `pulse ${0.6 + i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_MSGS.map(q => (
              <button key={q.text} className="sim-qr-btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => send(q.text)} disabled={sending}>
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="sim-footer">
            <input
              style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ width: 38, height: 38, borderRadius: '50%', background: '#25d366', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() ? 0.5 : 1 }}>
              <Send size={16} color="#000" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionsTable({ mobile }) {
  const [sessions, setSessions] = useState([])
  useEffect(() => { axios.get('/api/whatsapp/sessions').then(r => setSessions(r.data.slice(0, 8))).catch(() => {}) }, [mobile])
  return (
    <div className="card" style={{ marginTop: 16, padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <span className="card-title">Recent WhatsApp Sessions</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mobile</th><th>Farmer</th><th>Last Intent</th><th>Messages</th><th>District</th><th>Updated</th></tr></thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{s.mobile}</td>
                <td>{s.farmer_name || <span style={{ color: 'var(--text-muted)' }}>Unregistered</span>}</td>
                <td><span className={`badge ${s.last_intent === 'price' ? 'badge-green' : s.last_intent === 'scheme' ? 'badge-blue' : s.last_intent === 'weather' ? 'badge-gold' : 'badge-gray'}`}>{s.last_intent}</span></td>
                <td>{s.messages_count}</td>
                <td>{s.district || s.farmer_district || '—'}</td>
                <td style={{ fontSize: 11 }}>{s.updated_at?.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
