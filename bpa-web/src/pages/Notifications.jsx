import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Skeleton } from '../components/Skeleton'
import { BellIcon } from '@heroicons/react/24/outline'

export default function Notifications() {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications').then(r => setNotifs(r.data.data)).finally(() => setLoading(false))
  }, [])

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`)
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: 1 } : x))
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Notifications</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {loading ? (
          <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : notifs.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <BellIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No notifications
          </div>
        ) : notifs.map(n => (
          <div key={n.id} className={`px-5 py-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}
            onClick={() => !n.is_read && markRead(n.id)}>
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">{n.title}</div>
              <div className="text-sm text-gray-500 mt-0.5">{n.message}</div>
              <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
