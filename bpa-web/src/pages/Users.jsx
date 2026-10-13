import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'
import { useDebounce } from '../hooks/useDebounce'
import { TableSkeleton, Skeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon, EyeIcon, NoSymbolIcon, CheckIcon } from '@heroicons/react/24/outline'

const PRIMARY_IDS   = ['Philippine National ID (PhilSys ID)','Philippine Passport',"Driver's License (LTO)",'Unified Multi-Purpose ID (UMID)','Professional Regulation Commission (PRC) ID','Postal ID (PHLPost)',"Voter's ID / Voter's Certification"]
const SECONDARY_IDS = ['PhilHealth ID','TIN ID (BIR)','Senior Citizen ID','PWD ID','Barangay ID','Company / Employee ID','Student ID']

const DOC_LABELS = {
  primary_id:          '🪪 Primary ID',
  secondary_id:        '🪪 Secondary ID',
  barangay_clearance:  '📋 Barangay Clearance',
  old_business_permit: '📄 Old Business Permit',
  selfie:              '🤳 Selfie',
  product_photo:       '🛒 Product Photo',
}

export default function Users() {
  const [users, setUsers]       = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectModal, setRejectModal]     = useState(null)
  const [rejectReason, setRejectReason]   = useState('')
  const [deactivateModal, setDeactivateModal] = useState(null)
  const [deactivateReason, setDeactivateReason] = useState('')
  const debouncedSearch = useDebounce(search)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users', { params: { search: debouncedSearch, status, page, limit: 15 } })
      setUsers(data.data)
      setTotal(data.total)
    } finally { setLoading(false) }
  }, [debouncedSearch, status, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const viewDetails = async (u) => {
    setDetailLoading(true)
    setSelected({ ...u, _loading: true })
    try {
      const { data } = await api.get(`/verification/users/${u.id}`)
      setSelected(data)
    } catch { setSelected(u) }
    finally { setDetailLoading(false) }
  }

  const verify = async (id) => {
    await api.post(`/users/${id}/verify`)
    toast.success('User verified')
    fetchUsers()
    if (selected?.id === id) setSelected(s => ({ ...s, verification_status: 'verified' }))
  }

  const reject = async () => {
    await api.post(`/users/${rejectModal}/reject`, { reason: rejectReason })
    toast.success('User rejected')
    setRejectModal(null); setRejectReason('')
    fetchUsers()
  }

  const deactivate = async () => {
    try {
      await api.post(`/users/${deactivateModal}/deactivate`, { reason: deactivateReason })
      toast.success('Account deactivated')
      setDeactivateModal(null); setDeactivateReason('')
      fetchUsers()
    } catch (err) { toast.error(err.response?.data?.error ?? 'Failed') }
  }

  const activate = async (id) => {
    try {
      await api.post(`/users/${id}/activate`)
      toast.success('Account reactivated')
      fetchUsers()
    } catch (err) { toast.error(err.response?.data?.error ?? 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Peddlers</h2>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or email..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name','Email','Phone','Onboarding','Status','Account','Registered','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="p-4"><TableSkeleton rows={5} cols={8} /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No peddlers found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                  <td className="px-4 py-3">
                    <OnboardingBadge step={u.onboarding_step} completed={u.onboarding_completed} />
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={u.verification_status} /></td>
                  <td className="px-4 py-3">
                    {u.is_active == 1
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => viewDetails(u)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="View Details">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {u.verification_status === 'pending' && (
                        <>
                          <button onClick={() => verify(u.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Verify">
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setRejectModal(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Reject">
                            <XCircleIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {u.is_active == 1 ? (
                        <button onClick={() => { setDeactivateModal(u.id); setDeactivateReason('') }}
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-500" title="Deactivate Account">
                          <NoSymbolIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => activate(u.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Reactivate Account">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 15) || 1}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Peddler Verification Details" size="xl">
        {selected && (
          detailLoading || selected._loading ? (
            <div className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-40 w-full" /></div>
          ) : (
            <div className="space-y-6 text-sm">
              {/* Personal Info */}
              <section>
                <h4 className="font-semibold text-gray-700 mb-3 pb-1 border-b">Personal Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Full Name" value={`${selected.first_name} ${selected.last_name}`} />
                  <Info label="Email" value={selected.email} />
                  <Info label="Phone" value={selected.phone} />
                  <Info label="Address" value={selected.address || '—'} />
                  <Info label="Verification" value={<StatusBadge status={selected.verification_status} />} />
                  <Info label="Onboarding" value={<OnboardingBadge step={selected.onboarding_step} completed={selected.onboarding_completed} />} />
                </div>
                {selected.rejection_reason && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 text-red-700 text-xs">{selected.rejection_reason}</div>
                )}
              </section>

              {/* Documents */}
              <section>
                <h4 className="font-semibold text-gray-700 mb-3 pb-1 border-b">Uploaded Documents</h4>
                {!selected.documents?.length ? (
                  <p className="text-gray-400 text-xs">No documents uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {selected.documents.map(d => (
                      <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer"
                        className="flex items-start gap-3 border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors group">
                        <span className="text-2xl">{d.doc_category === 'selfie' ? '🤳' : d.doc_category === 'product_photo' ? '🛒' : '🪪'}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 text-xs truncate">{d.id_type || d.doc_category.replace(/_/g,' ')}</div>
                          <div className="text-gray-400 text-xs capitalize">{DOC_LABELS[d.doc_category] ?? d.doc_category}</div>
                          <div className="text-blue-500 text-xs group-hover:underline mt-1">View →</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              {/* Assistants */}
              <section>
                <h4 className="font-semibold text-gray-700 mb-3 pb-1 border-b">Assistants ({selected.assistants?.length ?? 0})</h4>
                {!selected.assistants?.length ? (
                  <p className="text-gray-400 text-xs">No assistants added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selected.assistants.map(a => (
                      <div key={a.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                        {a.photo_url
                          ? <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">👤</div>
                        }
                        <div>
                          <div className="font-medium text-gray-800">{a.first_name} {a.last_name}</div>
                          <div className="text-xs text-gray-500">{a.relationship} · {a.phone}</div>
                          <div className="text-xs text-gray-400">{a.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Actions */}
              {selected.verification_status === 'pending' && (
                <div className="flex gap-3 pt-2 border-t">
                  <button onClick={() => { verify(selected.id); setSelected(null) }}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700">
                    ✓ Verify Account
                  </button>
                  <button onClick={() => { setRejectModal(selected.id); setSelected(null) }}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700">
                    ✕ Reject Account
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject User" size="sm">
        <div className="space-y-4">
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 h-24 resize-none" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={reject} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal open={!!deactivateModal} onClose={() => setDeactivateModal(null)} title="Deactivate Account" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            The peddler will no longer be able to log in. They will be notified. You can reactivate the account at any time.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500">Reason</label>
            <textarea value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)}
              placeholder="e.g. Violation of market rules..."
              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 h-20 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeactivateModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={deactivate} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold">
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="font-medium text-gray-800">{value}</div>
    </div>
  )
}

function OnboardingBadge({ step, completed }) {
  if (completed) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Complete</span>
  if (!step) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not started</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Phase {step}/3</span>
}
