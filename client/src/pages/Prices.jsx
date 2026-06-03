import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Plus, Edit2, Trash2, X, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { useToast } from '../components/Toast'

const DISTRICTS = ['Guntur','Krishna','Kurnool','East Godavari','West Godavari','Visakhapatnam','Nellore','Chittoor','Kadapa','Anantapur','Prakasam','Srikakulam','Vizianagaram']
const CROPS = ['Paddy','Cotton','Chilli','Groundnut','Maize','Tobacco','Sugarcane','Onion','Tomato','Turmeric','Banana','Mango','Jowar','Bajra','Sunflower','Soybean','Blackgram','Greengram','Redgram','Sesame']
const BLANK = { crop: '', district: '', price_min: '', price_max: '', price_modal: '', unit: 'quintal', source: 'manual' }

export default function Prices() {
  const toast = useToast()
  const [prices, setPrices]   = useState([])
  const [spikes, setSpikes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [distFilter, setDist] = useState('')
  const [cropFilter, setCrop] = useState('')
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(BLANK)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      axios.get('/api/prices', { params: { district: distFilter, crop: cropFilter } }),
      axios.get('/api/prices/spikes')
    ]).then(([p, s]) => {
      setPrices(p.data)
      setSpikes(s.data)
    }).finally(() => setLoading(false))
  }, [distFilter, cropFilter])

  useEffect(() => { load() }, [load])

  const openAdd  = () => { setForm(BLANK); setModal('add') }
  const openEdit = row => { setForm({ crop: row.crop, district: row.district, price_min: row.price_min, price_max: row.price_max, price_modal: row.price_modal, unit: row.unit, source: 'manual' }); setModal(row) }
  const closeModal = () => setModal(null)

  const save = async () => {
    if (!form.crop || !form.district || !form.price_modal) return toast('Fill required fields', 'error')
    setSaving(true)
    try {
      await axios.post('/api/prices', form)
      toast(modal === 'add' ? 'Price added' : 'Price updated')
      closeModal(); load()
    } catch (e) { toast(e.response?.data?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  const del = async (id, crop, dist) => {
    if (!confirm(`Delete ${crop} price for ${dist}?`)) return
    try { await axios.delete(`/api/prices/${id}`); toast('Deleted'); load() }
    catch { toast('Error deleting', 'error') }
  }

  const fmtPrice = n => `₹${Number(n).toLocaleString('en-IN')}`

  return (
    <div>
      {/* Spike alerts */}
      {spikes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Price Spike Alerts <span className="badge badge-orange">{spikes.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {spikes.map((s, i) => (
              <div key={i} style={{
                background: s.change_pct > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${s.change_pct > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: 'var(--radius-sm)', padding: '10px 16px', minWidth: 200
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.crop} · {s.district}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.change_pct > 0 ? 'var(--green-primary)' : 'var(--red)', marginTop: 4 }}>
                  {s.change_pct > 0 ? <TrendingUp size={16} style={{ verticalAlign: 'middle' }} /> : <TrendingDown size={16} style={{ verticalAlign: 'middle' }} />}
                  {' '}{Math.abs(s.change_pct)}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Today: {fmtPrice(s.price_modal)} · Avg: {fmtPrice(s.avg_7day)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <select className="form-control" style={{ width: 180 }} value={distFilter} onChange={e => setDist(e.target.value)}>
          <option value="">All Districts</option>
          {DISTRICTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="form-control" style={{ width: 160 }} value={cropFilter} onChange={e => setCrop(e.target.value)}>
          <option value="">All Crops</option>
          {CROPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={13} /> Refresh</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{prices.length} entries</span>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add / Override Price</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div className="loading-page"><div className="spinner" /></div>
          ) : prices.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📊</div><h3>No price data found</h3></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Crop</th>
                  <th>District</th>
                  <th>Min (₹/qtl)</th>
                  <th>Modal (₹/qtl)</th>
                  <th>Max (₹/qtl)</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => {
                  const spike = spikes.find(s => s.crop === p.crop && s.district === p.district)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.crop}
                        {spike && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: spike.change_pct > 0 ? 'var(--green-primary)' : 'var(--red)', fontWeight: 700 }}>
                            {spike.change_pct > 0 ? '▲' : '▼'}{Math.abs(spike.change_pct)}%
                          </span>
                        )}
                      </td>
                      <td>{p.district}</td>
                      <td className="text-muted">{fmtPrice(p.price_min)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--green-primary)', fontSize: 14 }}>{fmtPrice(p.price_modal)}</td>
                      <td className="text-muted">{fmtPrice(p.price_max)}</td>
                      <td>
                        <span className={`badge ${p.source === 'manual' ? 'badge-orange' : 'badge-blue'}`}>
                          {p.source === 'manual' ? '✏️ Manual' : '🌐 Agmarknet'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{p.date}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.updated_at?.slice(11, 16)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}><Edit2 size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(p.id, p.crop, p.district)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'Add / Override Price' : `Edit — ${modal.crop} · ${modal.district}`}</span>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Crop *</label>
                <select className="form-control" value={form.crop} onChange={e => setForm(f => ({ ...f, crop: e.target.value }))}>
                  <option value="">Select crop</option>
                  {CROPS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">District *</label>
                <select className="form-control" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))}>
                  <option value="">Select district</option>
                  {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Min Price (₹/qtl)</label>
                <input className="form-control" type="number" value={form.price_min} onChange={e => setForm(f => ({ ...f, price_min: e.target.value }))} placeholder="e.g. 1800" />
              </div>
              <div className="form-group">
                <label className="form-label">Modal Price (₹/qtl) *</label>
                <input className="form-control" type="number" value={form.price_modal} onChange={e => setForm(f => ({ ...f, price_modal: e.target.value }))} placeholder="e.g. 2000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Max Price (₹/qtl)</label>
                <input className="form-control" type="number" value={form.price_max} onChange={e => setForm(f => ({ ...f, price_max: e.target.value }))} placeholder="e.g. 2200" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-control" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  <option value="quintal">Quintal (100 kg)</option>
                  <option value="kg">Kilogram</option>
                  <option value="tonne">Tonne</option>
                </select>
              </div>
            </div>
            <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              ⚠️ Manual override will be tagged as "Manual" source. System will serve this data with a disclaimer audio to farmers.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Price'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
