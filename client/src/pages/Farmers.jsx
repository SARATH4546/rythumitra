import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Search, Plus, Edit2, Trash2, X, Phone, MessageCircle } from 'lucide-react'
import { useToast } from '../components/Toast'

const DISTRICTS = ['Guntur','Krishna','Kurnool','East Godavari','West Godavari','Visakhapatnam','Srikakulam','Vizianagaram','Prakasam','Nellore','Chittoor','Kadapa','Anantapur']
const CROPS = ['Paddy','Cotton','Chilli','Groundnut','Maize','Tobacco','Sugarcane','Onion','Tomato','Turmeric','Banana','Mango','Jowar','Bajra','Sunflower','Soybean','Blackgram','Greengram','Redgram','Sesame']

const BLANK = { name:'', mobile:'', district:'', primary_crop:'', secondary_crop:'', preferred_alert_time:'morning', whatsapp_opted_in:false, channel:'ivr' }

export default function Farmers() {
  const toast = useToast()
  const [farmers, setFarmers]   = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [distFilter, setDist]   = useState('')
  const [cropFilter, setCrop]   = useState('')
  const [modal, setModal]       = useState(null)   // null | 'add' | {farmer}
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)

  const LIMIT = 15

  const load = useCallback(() => {
    setLoading(true)
    axios.get('/api/farmers', { params: { page, limit: LIMIT, search, district: distFilter, crop: cropFilter } })
      .then(r => { setFarmers(r.data.farmers); setTotal(r.data.total); })
      .finally(() => setLoading(false))
  }, [page, search, distFilter, cropFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, distFilter, cropFilter])

  const openAdd  = () => { setForm(BLANK); setModal('add') }
  const openEdit = f  => { setForm({ ...f, whatsapp_opted_in: !!f.whatsapp_opted_in }); setModal(f) }
  const closeModal = () => setModal(null)

  const save = async () => {
    if (!form.mobile || !form.district || !form.primary_crop) return toast('Fill required fields', 'error')
    setSaving(true)
    try {
      if (modal === 'add') {
        await axios.post('/api/farmers', form)
        toast('Farmer registered successfully')
      } else {
        await axios.put(`/api/farmers/${modal.id}`, form)
        toast('Farmer updated')
      }
      closeModal(); load()
    } catch (e) {
      toast(e.response?.data?.error || 'Error saving farmer', 'error')
    } finally { setSaving(false) }
  }

  const del = async (id, name) => {
    if (!confirm(`Delete farmer ${name}?`)) return
    try {
      await axios.delete(`/api/farmers/${id}`)
      toast('Farmer deleted'); load()
    } catch { toast('Error deleting', 'error') }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div>
      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} className="search-icon" />
          <input placeholder="Search name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 160 }} value={distFilter} onChange={e => setDist(e.target.value)}>
          <option value="">All Districts</option>
          {DISTRICTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="form-control" style={{ width: 160 }} value={cropFilter} onChange={e => setCrop(e.target.value)}>
          <option value="">All Crops</option>
          {CROPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{total} farmers</span>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Farmer</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div className="loading-page"><div className="spinner" /></div>
          ) : farmers.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">👨‍🌾</div><h3>No farmers found</h3></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name / Mobile</th>
                  <th>District</th>
                  <th>Primary Crop</th>
                  <th>Secondary Crop</th>
                  <th>Channel</th>
                  <th>Alert Time</th>
                  <th>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {farmers.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.mobile}</div>
                    </td>
                    <td>{f.district}</td>
                    <td><span className="badge badge-green">{f.primary_crop}</span></td>
                    <td>{f.secondary_crop ? <span className="badge badge-gold">{f.secondary_crop}</span> : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(f.channel === 'ivr' || f.channel === 'both') && <span className="badge badge-blue"><Phone size={9} /> IVR</span>}
                        {f.whatsapp_opted_in ? <span className="badge badge-green"><MessageCircle size={9} /> WA</span> : null}
                      </div>
                    </td>
                    <td><span className="badge badge-gray">{f.preferred_alert_time === 'morning' ? '🌅 7 AM' : '🌆 6 PM'}</span></td>
                    <td style={{ fontSize: 11 }}>{f.created_at?.slice(0, 10)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(f)}><Edit2 size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(f.id, f.name)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'Register New Farmer' : 'Edit Farmer'}</span>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mobile *</label>
                <input className="form-control" placeholder="91XXXXXXXXXX" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-control" placeholder="Farmer name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District *</label>
                <select className="form-control" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))}>
                  <option value="">Select district</option>
                  {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Primary Crop *</label>
                <select className="form-control" value={form.primary_crop} onChange={e => setForm(f => ({ ...f, primary_crop: e.target.value }))}>
                  <option value="">Select crop</option>
                  {CROPS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Secondary Crop</label>
                <select className="form-control" value={form.secondary_crop} onChange={e => setForm(f => ({ ...f, secondary_crop: e.target.value }))}>
                  <option value="">None</option>
                  {CROPS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Alert Time</label>
                <select className="form-control" value={form.preferred_alert_time} onChange={e => setForm(f => ({ ...f, preferred_alert_time: e.target.value }))}>
                  <option value="morning">🌅 Morning (7 AM)</option>
                  <option value="evening">🌆 Evening (6 PM)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Channel</label>
                <select className="form-control" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="ivr">IVR Only</option>
                  <option value="whatsapp">WhatsApp Only</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={!!form.whatsapp_opted_in} onChange={e => setForm(f => ({ ...f, whatsapp_opted_in: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--green-primary)' }} />
                  WhatsApp Opted-In
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Register Farmer' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
