import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Plus, Edit2, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { useToast } from '../components/Toast'

const BLANK = { name:'', name_telugu:'', department:'', benefit:'', benefit_amount:'', eligibility:'', deadline:'', how_to_apply:'', is_active:true }

export default function Schemes() {
  const toast = useToast()
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(BLANK)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    axios.get('/api/schemes').then(r => setSchemes(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd  = () => { setForm(BLANK); setModal('add') }
  const openEdit = s  => { setForm({ ...s, is_active: !!s.is_active }); setModal(s) }
  const closeModal = () => setModal(null)

  const save = async () => {
    if (!form.name || !form.department || !form.benefit) return toast('Fill required fields', 'error')
    setSaving(true)
    try {
      if (modal === 'add') { await axios.post('/api/schemes', form); toast('Scheme created') }
      else { await axios.put(`/api/schemes/${modal.id}`, form); toast('Scheme updated') }
      closeModal(); load()
    } catch (e) { toast(e.response?.data?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  const toggle = async (s) => {
    try {
      await axios.put(`/api/schemes/${s.id}`, { is_active: !s.is_active })
      toast(`Scheme ${s.is_active ? 'deactivated' : 'activated'}`)
      load()
    } catch { toast('Error toggling', 'error') }
  }

  const del = async (id, name) => {
    if (!confirm(`Delete scheme "${name}"?`)) return
    try { await axios.delete(`/api/schemes/${id}`); toast('Deleted'); load() }
    catch { toast('Error deleting', 'error') }
  }

  return (
    <div>
      <div className="filter-bar">
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{schemes.length} schemes · {schemes.filter(s => s.is_active).length} active</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openAdd}><Plus size={14} /> Add Scheme</button>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {schemes.map(s => (
            <div key={s.id} className="card" style={{ opacity: s.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                    {s.name_telugu && <span className="telugu" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.name_telugu}</span>}
                    <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? '● Active' : '○ Inactive'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{s.department}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.benefit}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {s.benefit_amount && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Benefit Amount</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{s.benefit_amount}</div>
                      </div>
                    )}
                    {s.deadline && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Deadline</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: new Date(s.deadline) < new Date() ? 'var(--red)' : 'var(--text-primary)' }}>
                          {new Date(s.deadline) < new Date() ? '⚠️ ' : ''}{s.deadline}
                        </div>
                      </div>
                    )}
                  </div>
                  {s.eligibility && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px' }}>
                      <strong>Eligibility:</strong> {s.eligibility}
                    </div>
                  )}
                  {s.how_to_apply && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px' }}>
                      <strong>How to Apply:</strong> {s.how_to_apply}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}><Edit2 size={12} /> Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => toggle(s)}>
                    {s.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(s.id, s.name)}><Trash2 size={12} /> Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'Add Scheme' : `Edit — ${modal.name}`}</span>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Scheme Name (English) *</label>
                <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="PM-KISAN" />
              </div>
              <div className="form-group">
                <label className="form-label">Name in Telugu</label>
                <input className="form-control telugu" value={form.name_telugu} onChange={e => setForm(f => ({ ...f, name_telugu: e.target.value }))} placeholder="పీఎమ్-కిసాన్" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Department / Ministry *</label>
              <input className="form-control" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Central — Agriculture Ministry" />
            </div>
            <div className="form-group">
              <label className="form-label">Benefit Description *</label>
              <textarea className="form-control" value={form.benefit} onChange={e => setForm(f => ({ ...f, benefit: e.target.value }))} placeholder="₹6,000/year direct income support…" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Benefit Amount</label>
                <input className="form-control" value={form.benefit_amount} onChange={e => setForm(f => ({ ...f, benefit_amount: e.target.value }))} placeholder="₹6,000/year" />
              </div>
              <div className="form-group">
                <label className="form-label">Enrollment Deadline</label>
                <input className="form-control" type="date" value={form.deadline || ''} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Eligibility Criteria</label>
              <textarea className="form-control" value={form.eligibility} onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))} placeholder="All small and marginal farmers…" />
            </div>
            <div className="form-group">
              <label className="form-label">How to Apply</label>
              <textarea className="form-control" value={form.how_to_apply} onChange={e => setForm(f => ({ ...f, how_to_apply: e.target.value }))} placeholder="Visit nearest CSC with Aadhaar + land record…" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Create Scheme' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
