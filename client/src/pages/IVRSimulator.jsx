import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Phone, PhoneOff, PhoneCall } from 'lucide-react'

const DISTRICTS = ['Guntur','Krishna','Kurnool','East Godavari','West Godavari','Visakhapatnam','Nellore']
const CROPS = ['Paddy','Cotton','Chilli','Groundnut','Maize','Tobacco','Onion','Tomato','Turmeric']

const KEYPAD = [
  ['1','ABC'],['2','DEF'],['3','GHI'],
  ['4','JKL'],['5','MNO'],['6','PQR'],
  ['7','STU'],['8','VWX'],['9','YZ'],
  ['*',''],  ['0',''],   ['#',''],
]

export default function IVRSimulator() {
  const [mobile, setMobile]   = useState('917890123456')
  const [callId, setCallId]   = useState(null)
  const [callActive, setCallActive] = useState(false)
  const [log, setLog]         = useState([])
  const [menu, setMenu]       = useState('main')
  const [district, setDistrict] = useState('')
  const [crop, setCrop]       = useState('')
  const [loading, setLoading] = useState(false)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const addLog = (who, text, textEn) => {
    setLog(l => [...l, { who, text, textEn, time: new Date().toLocaleTimeString() }])
  }

  const startCall = async () => {
    if (!mobile) return
    setLoading(true)
    setLog([])
    try {
      const r = await axios.post('/api/ivr/call', { mobile })
      setCallId(r.data.call_id)
      setCallActive(true)
      setMenu(r.data.menu || 'main')
      if (r.data.district) setDistrict(r.data.district)
      if (r.data.primary_crop) setCrop(r.data.primary_crop)
      addLog('system', '📞 Call connected — RythuMitra IVR', 'Call connected')
      addLog('bot', r.data.message, r.data.message_en)
    } catch (e) {
      addLog('system', '❌ Connection failed: ' + (e.response?.data?.error || e.message), '')
    }
    setLoading(false)
  }

  const endCall = async () => {
    if (callId) {
      await axios.post('/api/ivr/end', { call_id: callId, duration: log.length * 15 }).catch(() => {})
    }
    setCallActive(false)
    setCallId(null)
    setMenu('main')
    addLog('system', '📵 Call ended', 'Call ended')
  }

  const pressKey = async (key) => {
    if (!callActive || loading) return
    addLog('user', `🔢 Pressed: ${key}`, `Key: ${key}`)
    setLoading(true)
    try {
      const r = await axios.post('/api/ivr/dtmf', { call_id: callId, key, menu, mobile, district, crop })
      if (r.data.next_menu) setMenu(r.data.next_menu)
      if (r.data.district)  setDistrict(r.data.district)
      if (r.data.crop)      setCrop(r.data.crop)

      addLog('bot', r.data.message, r.data.message_en)

      if (r.data.action === 'transfer') {
        addLog('system', '🔀 Transferring to human agent…', 'Transferring')
        setTimeout(() => endCall(), 2000)
      }
      if (r.data.action === 'registration_complete') {
        addLog('system', `✅ Registered: ${r.data.crop} farmer in ${district}`, '')
      }
    } catch (e) {
      addLog('system', '❌ Error: ' + (e.response?.data?.error || e.message), '')
    }
    setLoading(false)
  }

  const logColor = { bot: 'var(--green-primary)', user: 'var(--gold)', system: 'var(--text-muted)' }
  const logBg    = { bot: 'var(--bg-card-hover)', user: 'rgba(240,165,0,0.08)', system: 'transparent' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      {/* Left: Info + Log */}
      <div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>📞 IVR Flow Simulator</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
            This simulator replicates the exact IVR call flow a farmer experiences when they give a missed call to RythuMitra's toll-free number. Enter a mobile number and press "Start Call" to begin.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Farmer Mobile Number</label>
              <input className="form-control" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="91XXXXXXXXXX" disabled={callActive} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">District (pre-fill for registered)</label>
              <select className="form-control" value={district} onChange={e => setDistrict(e.target.value)} disabled={callActive}>
                <option value="">Auto-detect</option>
                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">Crop (pre-fill for registered)</label>
              <select className="form-control" value={crop} onChange={e => setCrop(e.target.value)} disabled={callActive}>
                <option value="">Auto-detect</option>
                {CROPS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* IVR Menu Reference */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>IVR Menu Reference</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[['1','Today\'s mandi price'],['2','Govt schemes'],['3','Weather forecast'],['4','Loans & credit'],['5','Talk to agent'],['9','Change crop/district'],['0','Repeat menu']].map(([k,v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--green-primary)', fontSize: 11, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Call Log */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="card-title">Call Transcript</span>
            {callActive && <span className="badge badge-green" style={{ animation: 'pulse 2s infinite' }}>● LIVE</span>}
          </div>
          <div ref={logRef} style={{ height: 360, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {log.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon"><PhoneCall size={36} color="var(--text-muted)" /></div>
                <p>Press "Start Call" to begin simulation</p>
              </div>
            ) : log.map((l, i) => (
              <div key={i} style={{ background: logBg[l.who], borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid ${logColor[l.who]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: logColor[l.who], textTransform: 'uppercase' }}>
                    {l.who === 'bot' ? '🤖 IVR System' : l.who === 'user' ? '👨‍🌾 Farmer' : '⚙️ System'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.time}</span>
                </div>
                <div className="telugu" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{l.text}</div>
                {l.textEn && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{l.textEn}</div>}
              </div>
            ))}
            {loading && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Processing…</div>}
          </div>
        </div>
      </div>

      {/* Right: Phone UI */}
      <div>
        <div className="sim-phone">
          <div className="sim-header">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌾</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>RythuMitra IVR</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>1800-XXX-XXXX · Toll Free</div>
            </div>
            {callActive && <span className="badge badge-green" style={{ fontSize: 10 }}>● {(log.length * 15)}s</span>}
          </div>

          {/* Status */}
          <div style={{ background: callActive ? 'rgba(34,197,94,0.08)' : 'var(--bg-secondary)', padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Current Menu</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: callActive ? 'var(--green-primary)' : 'var(--text-muted)' }}>
              {callActive ? (menu === 'registration' ? '📝 Registration' : menu === 'crop_select' ? '🌾 Crop Select' : '🏠 Main Menu') : '📵 No Call'}
            </div>
            {district && callActive && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>📍 {district} {crop ? `· 🌾 ${crop}` : ''}</div>}
          </div>

          {/* Keypad */}
          <div className="ivr-keypad">
            {KEYPAD.map(([k, l]) => (
              <button key={k} className={`ivr-key${!callActive ? '' : ''}`} onClick={() => pressKey(k)} disabled={!callActive || loading}>
                <span>{k}</span>
                {l && <span className="key-label">{l}</span>}
              </button>
            ))}
          </div>

          {/* Call button */}
          <div style={{ padding: '12px 20px 20px', display: 'flex', justifyContent: 'center', gap: 20 }}>
            {!callActive ? (
              <button onClick={startCall} disabled={loading} style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(34,197,94,0.4)', transition: 'all 0.2s' }}>
                <Phone size={24} color="#000" />
              </button>
            ) : (
              <button onClick={endCall} style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--red)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(239,68,68,0.4)', transition: 'all 0.2s' }}>
                <PhoneOff size={24} color="#fff" />
              </button>
            )}
          </div>
        </div>

        {/* Quick test buttons */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 12, fontSize: 13 }}>Quick Test Scenarios</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '👨‍🌾 New Farmer Registration', mobile: '917700000001' },
              { label: '🌶️ Chilli Price — Guntur', mobile: '917800123456' },
              { label: '📋 Scheme Enquiry', mobile: '917900234567' },
            ].map(s => (
              <button key={s.mobile} className="btn btn-secondary btn-sm" disabled={callActive}
                onClick={() => { setMobile(s.mobile); setDistrict(''); setCrop('') }}
                style={{ justifyContent: 'flex-start' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
