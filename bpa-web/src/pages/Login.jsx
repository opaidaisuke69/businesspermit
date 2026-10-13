import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #073B3A 0%, #0B6E4F 60%, #08A045 100%)' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="LCC BPA" className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1" />
          <div>
            <div className="font-bold text-lg leading-tight">LCC BPA</div>
            <div className="text-xs text-white/60">Admin Portal</div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            La Carlota City<br />Business Permit<br />Application System
          </h1>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Digitizing the process of applying for peddler business permits and providing real-time vendor mapping for the City of La Carlota.
          </p>
          <div className="mt-8 flex gap-4">
            {[
              { n: '500+', l: 'Peddlers' },
              { n: '100%', l: 'Digital' },
              { n: '24/7', l: 'Access' },
            ].map(s => (
              <div key={s.l} className="bg-white/10 rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-bold">{s.n}</div>
                <div className="text-xs text-white/60 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/40 text-xs">© 2026 City Government of La Carlota. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src="/logo.png" alt="LCC BPA" className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1" />
            <div className="text-white">
              <div className="font-bold text-lg">LCC BPA</div>
              <div className="text-xs text-white/60">Admin Portal</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#073B3A' }}>Sign In</h2>
            <p className="text-sm mb-6" style={{ color: '#4A7A72' }}>For authorized LGU personnel only</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#0D2B28' }}>Email Address</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ borderColor: '#D1E8E2', '--tw-ring-color': '#08A045' }}
                  placeholder="admin@lcc.gov.ph"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#0D2B28' }}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all pr-12"
                    style={{ borderColor: '#D1E8E2' }}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm px-1"
                    style={{ color: '#4A7A72' }}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-60 mt-2"
                style={{ background: loading ? '#4A7A72' : 'linear-gradient(135deg, #073B3A, #0B6E4F)' }}>
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: '#D1E8E2' }}>
              <p className="text-xs" style={{ color: '#8AADA8' }}>
                🔒 Secure government portal — unauthorized access is prohibited
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
