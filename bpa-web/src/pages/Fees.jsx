import { useEffect, useState } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const FEE_DESCRIPTIONS = {
  mayors_permit:     "Annual Mayor's Permit issued to the peddler.",
  sanitary_permit:   'Annual Sanitary Permit for food/goods handling.',
  health_certificate:'Health Certificate fee per person.',
  occupational_tax:  'Per papag/lag-it. Multiplied by the number of papag declared in the application.',
  garbage_fee:       'Annual garbage collection fee.',
  brgy_clearance:    'Barangay Clearance fee.',
  peddlers_tax:      'Annual Peddlers Tax.',
}

export default function Fees() {
  const [fees, setFees]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [edited, setEdited]   = useState({})

  const fetchFees = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/fees')
      setFees(data.data ?? [])
      const init = {}
      ;(data.data ?? []).forEach(f => { init[f.fee_key] = String(f.amount) })
      setEdited(init)
    } catch { toast.error('Failed to load fees') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchFees() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {}
      Object.entries(edited).forEach(([k, v]) => { payload[k] = parseFloat(v) || 0 })
      await api.put('/fees', { fees: payload })
      toast.success('Fee settings saved!')
      fetchFees()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const hasChanges = fees.some(f => String(f.amount) !== edited[f.fee_key])
  const previewTotal = fees.reduce((sum, f) => sum + (parseFloat(edited[f.fee_key]) || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Fee Settings</h2>
          <p className="text-sm mt-1" style={{ color: '#4A7A72' }}>
            Configure the fees charged for each permit component. Changes apply to all new payments.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving || !hasChanges}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#08A045' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-sm" style={{ color: '#8AADA8' }}>Loading fees...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fee cards */}
          <div className="lg:col-span-2 space-y-3">
            {fees.map(f => (
              <div key={f.fee_key} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: '#073B3A' }}>{f.label}</div>
                    <div className="text-xs mt-1" style={{ color: '#8AADA8' }}>
                      {FEE_DESCRIPTIONS[f.fee_key] ?? ''}
                    </div>
                    {f.fee_key === 'occupational_tax' && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                        ⚡ Multiplied by No. of Papag
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold" style={{ color: '#4A7A72' }}>₱</span>
                    <input type="number" min="0" step="0.01"
                      value={edited[f.fee_key] ?? ''}
                      onChange={e => setEdited(prev => ({ ...prev, [f.fee_key]: e.target.value }))}
                      className="w-28 border rounded-lg px-3 py-2 text-sm font-semibold text-right focus:outline-none focus:ring-2"
                      style={{
                        borderColor: edited[f.fee_key] !== String(f.amount) ? '#F59E0B' : '#D1E8E2',
                        color: '#073B3A',
                      }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#073B3A' }}>Fee Preview</h3>
              <p className="text-xs mb-3" style={{ color: '#8AADA8' }}>Example: 1 papag/lag-it</p>
              <div className="space-y-2">
                {fees.map(f => (
                  <div key={f.fee_key} className="flex justify-between text-xs">
                    <span style={{ color: '#4A7A72' }}>{f.label}</span>
                    <span className="font-semibold" style={{ color: '#073B3A' }}>
                      ₱{(parseFloat(edited[f.fee_key]) || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold" style={{ color: '#073B3A' }}>Total (1 papag)</span>
                <span className="text-lg font-extrabold" style={{ color: '#08A045' }}>
                  ₱{previewTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-sm mb-3" style={{ color: '#073B3A' }}>Occupational Tax Example</h3>
              <div className="space-y-2 text-xs" style={{ color: '#4A7A72' }}>
                {[1, 2, 3].map(n => {
                  const rate = parseFloat(edited['occupational_tax']) || 0
                  return (
                    <div key={n} className="flex justify-between">
                      <span>{n} papag × ₱{rate.toLocaleString()}</span>
                      <span className="font-semibold" style={{ color: '#073B3A' }}>
                        ₱{(rate * n).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {hasChanges && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs" style={{ color: '#D97706' }}>
                ⚠ You have unsaved changes. Click "Save Changes" to apply them.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
