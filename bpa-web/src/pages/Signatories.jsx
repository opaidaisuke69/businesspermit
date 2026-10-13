import { useEffect, useRef, useState, useCallback } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const SIG_DESCRIPTIONS = {
  sanitation_inspector: 'Sanitary Permit — Recommending Approval section.',
  city_health_officer:  'Sanitary Permit — Approved section.',
  city_mayor:           "Market Peddler's Permit — Approved section.",
  city_budget_officer:  "Market Peddler's Permit — second signatory.",
  collecting_officer:   'Official Receipt — signature line.',
}

const USED_ON = {
  sanitation_inspector: 'Sanitary Permit',
  city_health_officer:  'Sanitary Permit',
  city_mayor:           "Market Peddler's Permit",
  city_budget_officer:  "Market Peddler's Permit",
  collecting_officer:   'Official Receipt',
}

// ── Signature Pad Modal ──────────────────────────────────────
function SignaturePadModal({ roleLabel, current, onSave, onClose }) {
  const canvasRef   = useRef(null)
  const [tab, setTab]         = useState('draw')   // 'draw' | 'upload'
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [uploadPreview, setUploadPreview] = useState(null)
  const lastPos = useRef(null)

  // Init canvas
  useEffect(() => {
    if (tab !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [tab])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    setDrawing(true)
    setHasDrawn(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    lastPos.current = pos
  }

  const draw = (e) => {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDraw = () => setDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setUploadPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (tab === 'draw') {
      if (!hasDrawn) { toast.error('Please draw a signature first'); return }
      const dataUrl = canvasRef.current.toDataURL('image/png')
      onSave(dataUrl)
    } else {
      if (!uploadPreview) { toast.error('Please upload an image first'); return }
      onSave(uploadPreview)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-sm" style={{ color: '#073B3A' }}>Signature — {roleLabel}</div>
            <div className="text-xs mt-0.5" style={{ color: '#8AADA8' }}>Draw or upload a signature image</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 text-lg">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-5 mt-4 mb-3 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'draw',   label: '✏️ Draw' },
            { key: 'upload', label: '📁 Upload' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-1.5 rounded-md text-sm font-semibold transition-all"
              style={tab === t.key
                ? { backgroundColor: '#073B3A', color: '#fff' }
                : { color: '#4A7A72' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          {/* Draw tab */}
          {tab === 'draw' && (
            <div>
              <div className="border-2 rounded-xl overflow-hidden mb-3 cursor-crosshair"
                style={{ borderColor: '#D1E8E2', touchAction: 'none' }}>
                <canvas
                  ref={canvasRef}
                  width={440}
                  height={180}
                  style={{ width: '100%', height: '180px', display: 'block' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs" style={{ color: '#8AADA8' }}>Sign in the box above</span>
                <button onClick={clearCanvas}
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium hover:bg-gray-50"
                  style={{ borderColor: '#D1E8E2', color: '#4A7A72' }}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Upload tab */}
          {tab === 'upload' && (
            <div className="mb-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-gray-50 transition-colors mb-3"
                style={{ borderColor: '#D1E8E2' }}>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                {uploadPreview ? (
                  <img src={uploadPreview} alt="preview"
                    className="max-h-32 object-contain rounded" />
                ) : (
                  <>
                    <div className="text-3xl mb-2">🖼️</div>
                    <div className="text-sm font-medium" style={{ color: '#073B3A' }}>Click to upload signature</div>
                    <div className="text-xs mt-1" style={{ color: '#8AADA8' }}>PNG, JPG — transparent background recommended</div>
                  </>
                )}
              </label>
              {uploadPreview && (
                <button onClick={() => setUploadPreview(null)}
                  className="text-xs text-red-500 hover:underline">
                  Remove image
                </button>
              )}
            </div>
          )}

          {/* Current signature preview */}
          {current && (
            <div className="mb-4 p-3 rounded-xl border" style={{ borderColor: '#D1E8E2', backgroundColor: '#F0F7F4' }}>
              <div className="text-xs font-semibold mb-2" style={{ color: '#4A7A72' }}>Current signature:</div>
              <img src={current} alt="current signature"
                className="max-h-16 object-contain" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50"
              style={{ borderColor: '#D1E8E2', color: '#4A7A72' }}>
              Cancel
            </button>
            {current && (
              <button onClick={() => onSave('')}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border hover:bg-red-50"
                style={{ borderColor: '#FCA5A5', color: '#DC2626' }}>
                Remove
              </button>
            )}
            <button onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#073B3A' }}>
              Save Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function Signatories() {
  const [sigs, setSigs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [edited, setEdited]   = useState({})
  const [padModal, setPadModal] = useState(null)  // role_key of open modal

  const fetchSigs = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/signatories')
      setSigs(data.data ?? [])
      const init = {}
      ;(data.data ?? []).forEach(s => {
        init[s.role_key] = {
          person_name:   s.person_name,
          credentials:   s.credentials,
          signature_url: s.signature_url ?? '',
        }
      })
      setEdited(init)
    } catch { toast.error('Failed to load signatories') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSigs() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = Object.entries(edited).map(([role_key, v]) => ({
        role_key,
        person_name:   v.person_name,
        credentials:   v.credentials,
        signature_url: v.signature_url ?? '',
      }))
      await api.put('/signatories', { signatories: payload })
      toast.success('Signatories saved!')
      fetchSigs()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const hasChanges = sigs.some(s => {
    const e = edited[s.role_key]
    if (!e) return false
    return e.person_name !== s.person_name ||
           e.credentials !== s.credentials ||
           (e.signature_url ?? '') !== (s.signature_url ?? '')
  })

  const setField = (key, field, val) =>
    setEdited(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }))

  const handleSignatureSave = (roleKey, dataUrl) => {
    setField(roleKey, 'signature_url', dataUrl)
    setPadModal(null)
  }

  const openSig = sigs.find(s => s.role_key === padModal)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Document Signatories</h2>
          <p className="text-sm mt-1" style={{ color: '#4A7A72' }}>
            Set names, titles, and signatures that appear on permits and receipts.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving || !hasChanges}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#08A045' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-sm" style={{ color: '#8AADA8' }}>Loading...</div>
      ) : (
        <div className="space-y-4">
          {sigs.map(s => {
            const e = edited[s.role_key] ?? { person_name: s.person_name, credentials: s.credentials, signature_url: '' }
            const changed = e.person_name !== s.person_name ||
                            e.credentials !== s.credentials ||
                            (e.signature_url ?? '') !== (s.signature_url ?? '')
            const hasSig = !!(e.signature_url)

            return (
              <div key={s.role_key} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start gap-4">
                  {/* Signature thumbnail / add button */}
                  <button onClick={() => setPadModal(s.role_key)}
                    className="flex-shrink-0 w-20 h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors hover:bg-gray-50 overflow-hidden"
                    style={{ borderColor: hasSig ? '#08A045' : '#D1E8E2' }}
                    title={hasSig ? 'Edit signature' : 'Add signature'}>
                    {hasSig
                      ? <img src={e.signature_url} alt="sig" className="w-full h-full object-contain p-1" />
                      : <>
                          <span className="text-xl">✍</span>
                          <span className="text-xs mt-0.5 font-medium" style={{ color: '#4A7A72' }}>Sign</span>
                        </>
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: '#073B3A' }}>{s.role_label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#F0F7F4', color: '#4A7A72' }}>
                        {USED_ON[s.role_key] ?? 'Document'}
                      </span>
                      {hasSig && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                          ✓ Signature set
                        </span>
                      )}
                      {changed && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                          Unsaved
                        </span>
                      )}
                    </div>
                    <p className="text-xs mb-3" style={{ color: '#8AADA8' }}>
                      {SIG_DESCRIPTIONS[s.role_key] ?? ''}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-1"
                          style={{ color: '#4A7A72' }}>Full Name</label>
                        <input type="text" value={e.person_name}
                          onChange={ev => setField(s.role_key, 'person_name', ev.target.value)}
                          placeholder="e.g. JUAN DELA CRUZ, M.D."
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{
                            borderColor: e.person_name !== s.person_name ? '#F59E0B' : '#D1E8E2',
                            color: '#073B3A',
                          }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-1"
                          style={{ color: '#4A7A72' }}>Title / Credentials</label>
                        <input type="text" value={e.credentials}
                          onChange={ev => setField(s.role_key, 'credentials', ev.target.value)}
                          placeholder="e.g. City Health Officer"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{
                            borderColor: e.credentials !== s.credentials ? '#F59E0B' : '#D1E8E2',
                            color: '#073B3A',
                          }} />
                      </div>
                    </div>

                    {/* Preview */}
                    {e.person_name && (
                      <div className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-3"
                        style={{ backgroundColor: '#F0F7F4' }}>
                        {hasSig && (
                          <img src={e.signature_url} alt="sig preview"
                            className="h-8 object-contain flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold uppercase" style={{ color: '#073B3A' }}>{e.person_name}</div>
                          {e.credentials && <div style={{ color: '#4A7A72' }}>{e.credentials}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {hasChanges && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs" style={{ color: '#D97706' }}>
              ⚠ You have unsaved changes. Click "Save Changes" to apply them to all future permits and receipts.
            </div>
          )}
        </div>
      )}

      {/* Signature Pad Modal */}
      {padModal && openSig && (
        <SignaturePadModal
          roleLabel={openSig.role_label}
          current={edited[padModal]?.signature_url ?? ''}
          onSave={(dataUrl) => handleSignatureSave(padModal, dataUrl)}
          onClose={() => setPadModal(null)}
        />
      )}
    </div>
  )
}
