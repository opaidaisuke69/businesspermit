import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import api from '../lib/api'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import toast from 'react-hot-toast'

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const icons = {
  available: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png', iconSize: [25,41], iconAnchor: [12,41] }),
  occupied:  new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25,41], iconAnchor: [12,41] }),
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng)
    },
  })
  return null
}

export default function VendorMap() {
  const [locations, setLocations] = useState([])
  const [filter, setFilter] = useState('')
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', latitude: '10.4274', longitude: '122.9228', area_type: 'saturday_market', slot_number: '', status: 'available' })

  const fetchLocations = useCallback(async () => {
    const params = filter ? { status: filter } : {}
    const { data } = await api.get('/locations', { params })
    setLocations(data.data)
  }, [filter])

  useEffect(() => { fetchLocations() }, [fetchLocations])

  const save = async () => {
    try {
      if (editModal) {
        await api.put(`/locations/${editModal.id}`, form)
        toast.success('Location updated')
        setEditModal(null)
      } else {
        await api.post('/locations', form)
        toast.success('Location added')
        setAddModal(false)
      }
      fetchLocations()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed')
    }
  }

  const deactivate = async (id) => {
    await api.delete(`/locations/${id}`)
    toast.success('Location deactivated')
    fetchLocations()
  }

  const openEdit = (loc) => {
    setForm({ name: loc.name, description: loc.description, latitude: loc.latitude, longitude: loc.longitude, area_type: loc.area_type, slot_number: loc.slot_number, status: loc.status })
    setEditModal(loc)
  }

  const handleMapClick = (latlng) => {
    setForm({ 
      name: '', 
      description: '', 
      latitude: latlng.lat.toFixed(8), 
      longitude: latlng.lng.toFixed(8), 
      area_type: 'saturday_market', 
      slot_number: '', 
      status: 'available' 
    })
    setAddModal(true)
  }

  const filtered = locations.filter(l => !filter || l.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Vendor Map</h2>
        <button onClick={() => setAddModal(true)}
          className="px-4 py-2 bg-[#1a3a6b] text-white text-sm rounded-lg hover:bg-[#0f2347]">
          + Add Location
        </button>
      </div>

      {/* Legend & Filter */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Occupied</span>
          <span className="text-xs text-gray-500 ml-2">💡 Click on the map to add a new location</span>
        </div>
        <div className="ml-auto flex gap-2">
          {['','available','occupied'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${filter === s ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'border-gray-200 hover:bg-gray-50'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: 480 }}>
        <MapContainer center={[10.4274, 122.9228]} zoom={16} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          <MapClickHandler onMapClick={handleMapClick} />
          {filtered.map(loc => (
            <Marker key={loc.id} position={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
              icon={icons[loc.status] ?? icons.available}>
              <Popup>
                <div className="text-sm min-w-40">
                  <div className="font-semibold mb-1">{loc.name}</div>
                  <div className="text-gray-500 text-xs mb-2">{loc.description}</div>
                  <div className="mb-2">
                    <StatusBadge status={loc.status} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(loc)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => deactivate(loc.id)} className="text-xs text-red-600 hover:underline">Deactivate</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Location List */}
      <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">All Locations ({filtered.length})</div>
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {filtered.map(loc => (
            <div key={loc.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">{loc.name} <span className="text-gray-400 font-normal">#{loc.slot_number}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={loc.status} />
                <button onClick={() => openEdit(loc)} className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={addModal || !!editModal} onClose={() => { setAddModal(false); setEditModal(null) }}
        title={editModal ? 'Edit Location' : 'Add Location'} size="md">
        <div className="space-y-3">
          {[
            { label: 'Name', key: 'name', type: 'text' },
            { label: 'Slot Number', key: 'slot_number', type: 'text' },
            { label: 'Latitude', key: 'latitude', type: 'number' },
            { label: 'Longitude', key: 'longitude', type: 'number' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b] h-16 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]">
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => { setAddModal(false); setEditModal(null) }} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-[#1a3a6b] text-white rounded-lg hover:bg-[#0f2347]">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
