import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import {
  HomeIcon, UsersIcon, DocumentTextIcon, CreditCardIcon,
  MapPinIcon, ChartBarIcon, BellIcon, ArrowRightOnRectangleIcon,
  Bars3Icon, XMarkIcon, DocumentCheckIcon,
  CurrencyDollarIcon, IdentificationIcon,
} from '@heroicons/react/24/outline'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, color: '#21D375' },
    ],
  },
  {
    label: 'Peddler Management',
    items: [
      { to: '/users',        label: 'Peddlers',      icon: UsersIcon,         color: '#08A045', badge: 'pending_users' },
      { to: '/applications', label: 'Applications',  icon: DocumentTextIcon,  color: '#0B6E4F', badge: 'pending_applications' },
      { to: '/payments',     label: 'Payments',      icon: CreditCardIcon,    color: '#21D375', badge: 'pending_payments' },
      { to: '/permits',      label: 'Permits',       icon: DocumentCheckIcon, color: '#08A045' },
    ],
  },
  {
    label: 'Market & Locations',
    items: [
      { to: '/locations',    label: 'Vendor Map',    icon: MapPinIcon,        color: '#0B6E4F' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Reports', icon: ChartBarIcon, color: '#08A045' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/fees',        label: 'Fee Settings',  icon: CurrencyDollarIcon, color: '#C9A227' },
      { to: '/signatories', label: 'Signatories',   icon: IdentificationIcon, color: '#C9A227' },
    ],
  },
]

export default function Layout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [counts, setCounts] = useState({ pending_users: 0, pending_applications: 0, pending_payments: 0, unread_notifications: 0 })

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data } = await api.get('/counts/pending')
        setCounts(data)
        console.log('Counts updated:', data)
      } catch (err) {
        console.error('Failed to fetch counts:', err)
      }
    }
    
    fetchCounts()
    // Poll every 1 second for real-time updates
    const interval = setInterval(fetchCounts, 1000)
    console.log('Polling started - fetching every 1 second')
    return () => {
      clearInterval(interval)
      console.log('Polling stopped')
    }
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F7F4' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: 'linear-gradient(180deg, #073B3A 0%, #052928 100%)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
            <img src="/logo.png" alt="LCC" className="w-8 h-8 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm leading-tight">LCC BPA</div>
            <div className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin Panel</div>
          </div>
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
            <XMarkIcon className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              {/* Category label */}
              <div className="px-3 mb-1"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, color, badge }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${isActive ? 'text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/8'}`
                    }
                    style={({ isActive }) => isActive ? {
                      background: 'linear-gradient(135deg, rgba(8,160,69,0.25), rgba(33,211,117,0.15))',
                      borderLeft: `3px solid ${color}`,
                    } : { borderLeft: '3px solid transparent' }}
                  >
                    <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span className="flex-1">{label}</span>
                    {badge && counts[badge] > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white min-w-[20px] text-center">
                        {counts[badge]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Admin info */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #08A045, #21D375)' }}>
              {admin?.name?.[0] ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{admin?.name}</div>
              <div className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {admin?.role?.replace('_', ' ')}
              </div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20">
              <ArrowRightOnRectangleIcon className="w-4 h-4 text-white/50 hover:text-red-400" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b px-4 py-3 flex items-center gap-4 flex-shrink-0 shadow-sm"
          style={{ borderColor: '#D1E8E2' }}>
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="w-5 h-5" style={{ color: '#073B3A' }} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold hidden sm:block" style={{ color: '#073B3A' }}>
              La Carlota City Peddler Business Permit Application System
            </h1>
          </div>
          <NavLink to="/notifications"
            className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
            <BellIcon className="w-5 h-5" style={{ color: '#4A7A72' }} />
            {counts.unread_notifications > 0 && (
              <span className="absolute top-0 right-0 px-1.5 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white min-w-[18px] text-center">
                {counts.unread_notifications}
              </span>
            )}
          </NavLink>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #073B3A, #0B6E4F)' }}>
            {admin?.name?.[0] ?? 'A'}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
