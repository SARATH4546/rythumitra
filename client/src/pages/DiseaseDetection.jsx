import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { AlertTriangle, Leaf, CheckCircle, Clock, Filter, RefreshCw, Eye, Bug, TrendingUp, MapPin } from 'lucide-react'

const SEVERITY_COLOR = {
  mild:     { bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.4)',  text: '#eab308', label: '🟡 Mild' },
  moderate: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', text: '#f97316', label: '🟠 Moderate' },
  severe:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  text: '#ef4444', label: '🔴 Severe' },
  unknown:  { bg: 'rgba(100,116,139,0.12)',border: 'rgba(100,116,139,0.4)',text: '#94a3b8', label: '⚪ Unknown' },
}

const STAT_CARD = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card" style={{ display:'flex', alignItems:'center', gap:16 }}>
    <div style={{ width:48, height:48, borderRadius:12, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <div style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{sub}</div>}
    </div>
  </div>
)

export default function DiseaseDetection() {
  const [detections, setDetections]   = useState([])
  const [stats, setStats]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [severityFilter, setSeverity] = useState('all')
  const [selected, setSelected]       = useState(null)
  const [verifyModal, setVerifyModal] = useState(null)
  const [verifyForm, setVerifyForm]   = useState({ verified_disease:'', admin_notes:'', treatment_given:'' })
  const [saving, setSaving]           = useState(false)

  const toast = (msg, type='success') => {
    const el = document.createElement('div')
    el.textContent = msg
    el.style.cssText = `position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;font-weight:600;z-index:9999;background:${type==='error'?'#ef4444':'#22c55e'}`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [det, st] = await Promise.all([
        axios.get('/api/disease/detections', { params: { limit: 50 } }),
        axios.get('/api/disease/stats'),
      ])
      setDetections(det.data.items || [])
      setStats(st.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = severityFilter === 'all'
    ? detections
    : severityFilter === 'healthy'
      ? detections.filter(d => d.is_healthy)
      : detections.filter(d => d.severity === severityFilter)

  const verify = async () => {
    setSaving(true)
    try {
      await axios.put(`/api/disease/${verifyModal.id}/verify`, verifyForm)
      toast('Diagnosis verified!')
      setVerifyModal(null)
      load()
    } catch (e) { toast(e.response?.data?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading-page"><div className="spinner"/></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', margin:0 }}>
            🔬 Crop Disease Detection
          </h1>
          <p style={{ color:'var(--text-muted)', margin:'4px 0 0', fontSize:14 }}>
            AI-powered disease analysis from farmer WhatsApp photos (Gemini Vision)
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {/* AI Status Banner */}
      <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:12, padding:'12px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:20 }}>🤖</div>
        <div>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>AI Services Active</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
            🔬 MobileNetV2 PlantVillage (disease) · 🎤 Vakyansh Wav2Vec2 Telugu STT · 🗣️ edge-TTS (Telugu voice) · 100% Local
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {[['MobileNetV2','#22c55e'],['Vakyansh','#8b5cf6'],['edge-TTS','#f59e0b']].map(([n,c]) => (
            <span key={n} style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${c}20`, color:c, border:`1px solid ${c}40` }}>{n} ✓</span>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          <STAT_CARD icon={Bug}          label="Total Detections"   value={stats.total}                             color="#ef4444" />
          <STAT_CARD icon={AlertTriangle} label="Severe Cases"      value={stats.bySeverity?.severe || 0}           color="#f97316" sub="Needs immediate attention" />
          <STAT_CARD icon={CheckCircle}  label="Healthy Reports"    value={stats.bySeverity?.healthy || 0}          color="#22c55e" sub="No disease found" />
          <STAT_CARD icon={TrendingUp}   label="Top Disease"        value={stats.topDiseases?.[0]?.name || '—'}     color="#8b5cf6" sub={stats.topDiseases?.[0] ? `${stats.topDiseases[0].count} cases` : ''} />
        </div>
      )}

      {/* Top diseases + Top crops */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div className="card">
            <div style={{ fontWeight:700, marginBottom:14, fontSize:14 }}>🦠 Top Diseases Detected</div>
            {(stats.topDiseases || []).map((d, i) => (
              <div key={d.name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:24, height:24, borderRadius:6, background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</div>
                <div style={{ flex:1, fontSize:13, color:'var(--text-primary)' }}>{d.name}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>{d.count} cases</div>
                <div style={{ width:60, height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(d.count/(stats.topDiseases[0]?.count||1))*100}%`, background:'#ef4444', borderRadius:3 }}/>
                </div>
              </div>
            ))}
            {!stats.topDiseases?.length && <div style={{ color:'var(--text-muted)', fontSize:13 }}>No detections yet. Farmers can send crop photos on WhatsApp.</div>}
          </div>

          <div className="card">
            <div style={{ fontWeight:700, marginBottom:14, fontSize:14 }}>🌾 Most Affected Crops</div>
            {(stats.topCrops || []).map((c, i) => (
              <div key={c.name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:24, height:24, borderRadius:6, background:'rgba(34,197,94,0.15)', color:'#22c55e', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</div>
                <div style={{ flex:1, fontSize:13, color:'var(--text-primary)' }}>{c.name}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>{c.count} reports</div>
                <div style={{ width:60, height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(c.count/(stats.topCrops[0]?.count||1))*100}%`, background:'#22c55e', borderRadius:3 }}/>
                </div>
              </div>
            ))}
            {!stats.topCrops?.length && <div style={{ color:'var(--text-muted)', fontSize:13 }}>No crops reported yet.</div>}
          </div>
        </div>
      )}

      {/* Filter + List */}
      <div className="filter-bar">
        <div style={{ display:'flex', gap:8 }}>
          {[['all','All'],['mild','Mild'],['moderate','Moderate'],['severe','Severe'],['healthy','Healthy']].map(([v,l]) => (
            <button key={v}
              className={`btn btn-sm ${severityFilter===v?'btn-primary':'btn-secondary'}`}
              onClick={() => setSeverity(v)}
            >{l}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', color:'var(--text-muted)', fontSize:13 }}>
          {filtered.length} detection{filtered.length!==1?'s':''}
        </div>
      </div>

      {/* Detection Cards */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Leaf size={48}/></div>
          <h3>No disease detections yet</h3>
          <p>Farmers can send a photo of their crop on WhatsApp and the AI will diagnose diseases automatically.</p>
          <div style={{ marginTop:16, padding:'12px 20px', background:'var(--bg-secondary)', borderRadius:8, fontSize:13, color:'var(--text-secondary)', maxWidth:400, textAlign:'left' }}>
            <strong>How it works:</strong><br/>
            1. Farmer sends crop photo on WhatsApp<br/>
            2. Gemini Vision AI analyzes the image<br/>
            3. Bot replies with disease name, treatment & Telugu voice note<br/>
            4. Detection logged here for admin review
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(d => {
            const sev = SEVERITY_COLOR[d.severity] || SEVERITY_COLOR.unknown
            return (
              <div key={d.id} className="card" style={{ border: d.is_healthy ? '1px solid rgba(34,197,94,0.3)' : `1px solid ${sev.border}`, background: d.is_healthy ? 'rgba(34,197,94,0.05)' : sev.bg }}>
                <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                  {/* Image thumbnail */}
                  {d.image_url ? (
                    <img src={d.image_url} alt="crop" style={{ width:80, height:80, objectFit:'cover', borderRadius:8, flexShrink:0, border:'1px solid var(--border)' }} onError={e => { e.target.style.display='none' }}/>
                  ) : (
                    <div style={{ width:80, height:80, borderRadius:8, background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:32 }}>🌿</div>
                  )}

                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                      <span style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)' }}>
                        {d.is_healthy ? '✅ Healthy Plant' : (d.telugu_disease || d.disease)}
                      </span>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:12, background:`${sev.text}20`, color:sev.text, fontWeight:700 }}>{sev.label}</span>
                      {d.verified && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:12, background:'rgba(34,197,94,0.2)', color:'#22c55e', fontWeight:700 }}>✓ Verified</span>}
                    </div>

                    <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-secondary)', marginBottom:8, flexWrap:'wrap' }}>
                      <span>👤 {d.farmer_name || d.mobile || '—'}</span>
                      <span><MapPin size={11}/> {d.district || '—'}</span>
                      <span>🌾 {d.plant || d.crop || '—'}</span>
                      <span><Clock size={11}/> {new Date(d.detected_at).toLocaleString('en-IN')}</span>
                      <span style={{ color: d.confidence >= 0.8 ? '#22c55e' : d.confidence >= 0.6 ? '#f59e0b' : '#94a3b8', fontWeight:600 }}>
                        {d.confidence ? `${Math.round(d.confidence * 100)}%` : '—'} confidence
                      </span>
                    </div>

                    {d.telugu_summary && (
                      <div style={{ fontSize:12, color:'var(--text-secondary)', background:'var(--bg-secondary)', padding:'8px 12px', borderRadius:8, marginBottom:8, lineHeight:1.6 }}>
                        {d.telugu_summary}
                      </div>
                    )}

                    {d.organic_remedy && (
                      <div style={{ fontSize:12, color:'#22c55e' }}>🌱 {d.organic_remedy}</div>
                    )}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
                    <button className="btn btn-sm btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}
                      onClick={() => setSelected(d)}>
                      <Eye size={13}/> Details
                    </button>
                    {!d.verified && (
                      <button className="btn btn-sm btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}
                        onClick={() => { setVerifyModal(d); setVerifyForm({ verified_disease: d.disease, admin_notes:'', treatment_given:'' }) }}>
                        ✓ Verify
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:560 }}>
            <div className="modal-header">
              <h3>Disease Detection Details</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:14 }}>
              {selected.image_url && <img src={selected.image_url} alt="crop" style={{ width:'100%', maxHeight:220, objectFit:'cover', borderRadius:10 }}/>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  ['Disease', selected.disease],
                  ['Severity', (SEVERITY_COLOR[selected.severity]||SEVERITY_COLOR.unknown).label],
                  ['Farmer', selected.farmer_name || selected.mobile || '—'],
                  ['District', selected.district || '—'],
                  ['Crop', selected.plant || selected.crop || '—'],
                  ['Confidence', selected.confidence ? `${Math.round(selected.confidence * 100)}%` : '—'],
                  ['Detected', new Date(selected.detected_at).toLocaleString('en-IN')],
                  ['Verified', selected.verified ? '✅ Yes' : '❌ No'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
              {selected.telugu_summary && (
                <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'12px' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>AI Summary (Telugu)</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.7 }}>{selected.telugu_summary}</div>
                </div>
              )}
              {selected.treatment?.length > 0 && (
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>💊 Treatment Steps</div>
                  {selected.treatment.map((t, i) => (
                    <div key={i} style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:4 }}>
                      {i+1}. {t}
                    </div>
                  ))}
                </div>
              )}
              {selected.organic_remedy && (
                <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ fontSize:11, color:'#22c55e', fontWeight:700, marginBottom:4 }}>🌱 Organic Remedy</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{selected.organic_remedy}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyModal && (
        <div className="modal-overlay" onClick={() => setVerifyModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✓ Verify AI Diagnosis</h3>
              <button className="modal-close" onClick={() => setVerifyModal(null)}>✕</button>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:13, color:'var(--text-secondary)' }}>
                AI detected: <strong>{verifyModal.disease}</strong> in {verifyModal.crop} ({verifyModal.district})
              </div>
              <div className="form-group">
                <label className="form-label">Verified Disease Name</label>
                <input className="form-control" value={verifyForm.verified_disease}
                  onChange={e => setVerifyForm(f => ({...f, verified_disease: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Notes</label>
                <textarea className="form-control" rows={3} value={verifyForm.admin_notes}
                  onChange={e => setVerifyForm(f => ({...f, admin_notes: e.target.value}))}
                  placeholder="Any observations, corrections, or context..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Treatment Given</label>
                <input className="form-control" value={verifyForm.treatment_given}
                  onChange={e => setVerifyForm(f => ({...f, treatment_given: e.target.value}))}
                  placeholder="Pesticide/medicine recommended to farmer..."/>
              </div>
              <button className="btn btn-primary" onClick={verify} disabled={saving}>
                {saving ? 'Saving...' : '✓ Confirm & Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
