import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Plus, Send, Trash2, X, Bell } from 'lucide-react'
import { useToast } from '../components/Toast'

const DISTRICTS = ['','Guntur','Krishna','Kurnool','East Godavari','West Godavari','Visakhapatnam','Nellore','Chittoor','Kadapa','Anantapur','Prakasam','Srikakulam','Vizianagaram']
const CROPS = ['','Paddy','Cotton','Chilli','Groundnut','Maize','Tobacco','Sugarcane','Onion','Tomato','Turmeric','Banana','Mango','Jowar','Bajra','Sunflower','Soybean','Blackgram','Greengram','Redgram','Sesame']
const TYPES = ['price_spike','scheme_deadline','weather','broadcast','loan_reminder']
const BLANK = { type:'broadcast', message:'', message_telugu:'', district:'', crop:'', channel:'whatsapp' }

const TYPE_META = {
  price_spike:     { label:'Price Spike',       color:'badge-green',  icon:'📈' },
  scheme_deadline: { label:'Scheme Deadline',   color:'badge-gold',   icon:'📋' },
  weather:         { label:'Weather Advisory',  color:'badge-blue',   icon:'🌦️' },
  broadcast:       { label:'Broadcast',         color:'badge-purple', icon:'📢' },
  loan_reminder:   { label:'Loan Reminder',     color:'badge-orange', icon:'💳' },
}

export default function Alerts() {
  const toast = useToast()
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(BLANK)
  const [estimate, setEst]    = useState(null)
  const [saving, setSaving]   = useState(false)
  const [sending, setSending] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    axios.get('/api/alerts').then(r => setAlerts(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openModal  = () => { setForm(BLANK); setEst(null); setModal(true) }
  const closeModal = () => setModal(false)

  const calcEst = async () => {
    if (!form.message) return toast('Add a message first', 'error')
    setSaving(true)
    try {
      const r = await axios.post('/api/alerts', form)
      setEst(r.data)
      toast(`Draft created — est. ${r.data.estimated_recipients} recipients`)
      closeModal(); load()
    } catch (e) { toast(e.response?.data?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  const sendAlert = async (id) => {
    if (!confirm('Send this alert now?')) return
    setSending(id)
    try {
      const r = await axios.post(`/api/alerts/${id}/send`)
      toast(`✅ Sent to ${r.data.delivered} of ${r.data.total} farmers`)
      load()
    } catch { toast('Error sending alert', 'error') }
    finally { setSending(null) }
  }

  const del = async (id) => {
    if (!confirm('Delete this alert?')) return
    try { await axios.delete(`/api/alerts/${id}`); toast('Deleted'); load() }
    catch { toast('Error', 'error') }
  }

  const deliveryRate = (a) => a.recipients_count ? Math.round((a.delivered_count / a.recipients_count) * 100) : 0

  return (
    <div>
      <div className="filter-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {['all','draft','sent'].map(s => (
            <button key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}
              onClick={() => setStatusFilter(s)}
            >{s}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openModal}>
          <Plus size={14} /> Compose Alert
        </button>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : alerts.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Bell size={48} /></div><h3>No alerts yet</h3><p>Compose a broadcast alert to farmers</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {alerts.filter(a => statusFilter === 'all' || a.status === statusFilter).map(a => {

            const meta = TYPE_META[a.type] || TYPE_META.broadcast
            const rate = deliveryRate(a)
            return (
              <div key={a.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${meta.color}`}>{meta.label}</span>
                      <span className={`badge ${a.status === 'sent' ? 'badge-green' : 'badge-gray'}`}>{a.status === 'sent' ? '✅ Sent' : '📝 Draft'}</span>
                      {a.district && <span className="badge badge-blue">📍 {a.district}</span>}
                      {a.crop    && <span className="badge badge-gold">🌾 {a.crop}</span>}
                      <span className="badge badge-gray">{a.channel === 'whatsapp' ? '💬 WhatsApp' : a.channel === 'sms' ? '📱 SMS' : '📡 Both'}</span>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{a.message}</p>
                    {a.message_telugu && (
                      <p className="telugu" style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{a.message_telugu}</p>
                    )}

                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {a.status === 'sent' ? (
                        <>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recipients</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{a.recipients_count.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivered</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-primary)' }}>{a.delivered_count.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Rate</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: rate >= 90 ? 'var(--green-primary)' : rate >= 75 ? 'var(--gold)' : 'var(--red)' }}>{rate}%</div>
                          </div>
                          {/* Delivery bar */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${rate}%`, height: '100%', background: rate >= 90 ? 'var(--green-primary)' : rate >= 75 ? 'var(--gold)' : 'var(--red)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>Sent: {a.sent_at?.slice(0, 16)}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Est. recipients: <strong style={{ color: 'var(--text-primary)' }}>{a.recipients_count || 'All'}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    {a.status === 'draft' && (
                      <button className="btn btn-gold btn-sm" onClick={() => sendAlert(a.id)} disabled={sending === a.id}>
                        <Send size={12} /> {sending === a.id ? 'Sending…' : 'Send Now'}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => del(a.id)}><Trash2 size={12} /> Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Compose Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">📢 Compose Alert</span>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Alert Type *</label>
                <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Channel</label>
                <select className="form-control" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="sms">📱 SMS</option>
                  <option value="both">📡 Both (WA + SMS)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target District <span style={{ color: 'var(--text-muted)' }}>(blank = all)</span></label>
                <select className="form-control" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))}>
                  {DISTRICTS.map(d => <option key={d} value={d}>{d || 'All Districts'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Crop <span style={{ color: 'var(--text-muted)' }}>(blank = all)</span></label>
                <select className="form-control" value={form.crop} onChange={e => setForm(f => ({ ...f, crop: e.target.value }))}>
                  {CROPS.map(c => <option key={c} value={c}>{c || 'All Crops'}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Message (English) *</label>
              <textarea className="form-control" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Chilli prices rose 18% in Guntur mandi today…" />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.message.length} chars · Keep under 160 for SMS</div>
            </div>

            <div className="form-group">
              <label className="form-label">Message (Telugu) <span style={{ color: 'var(--text-muted)' }}>(for voice note)</span></label>
              <textarea className="form-control telugu" rows={3} value={form.message_telugu} onChange={e => setForm(f => ({ ...f, message_telugu: e.target.value }))} placeholder="గుంటూరు మండిలో మిర్చి ధర 18% పెరిగింది…" />
            </div>

            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              ℹ️ The alert will be saved as a draft. Review it before sending. WhatsApp messages are delivered within 60 seconds; SMS within 5 minutes.
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={calcEst} disabled={saving}>
                <Bell size={14} /> Create Draft & Estimate Recipients
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
