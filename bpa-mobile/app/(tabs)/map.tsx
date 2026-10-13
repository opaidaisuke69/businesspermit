import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

interface Location {
  id: number; name: string; description: string
  latitude: string; longitude: string
  area_type: string; slot_number: string; status: string
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  available: { color: '#059669', bg: '#D1FAE5', label: 'Available' },
  occupied:  { color: '#DC2626', bg: '#FEE2E2', label: 'Occupied' },
  inactive:  { color: '#6B7280', bg: '#F3F4F6', label: 'Inactive' },
}

const FILTERS = [
  { value: '',          label: 'All',       icon: 'layers-outline' },
  { value: 'available', label: 'Available', icon: 'checkmark-circle-outline' },
  { value: 'occupied',  label: 'Occupied',  icon: 'close-circle-outline' },
]

export default function MapScreen() {
  const [locations, setLocations] = useState<Location[]>([])
  const [filter, setFilter]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'map' | 'list'>('map')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  const fetchLocations = async (silent = false) => {
    try {
      const r = await api.get('/locations')
      setLocations(r.data.data ?? [])
    } catch {}
    finally {
      if (!silent) {
        setLoading(false)
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
      }
    }
  }

  useEffect(() => {
    fetchLocations(false)
    pollRef.current = setInterval(() => fetchLocations(true), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const filtered = filter ? locations.filter(l => l.status === filter) : locations

  // Stats
  const stats = {
    available: locations.filter(l => l.status === 'available').length,
    occupied:  locations.filter(l => l.status === 'occupied').length,
  }

  const mapHtml = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0}#map{height:100vh;width:100vw}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false}).setView([10.4274,122.9228],16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:''}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
var icons={
  available:L.icon({iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34]}),
  occupied:L.icon({iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34]}),
};
${JSON.stringify(filtered)}.forEach(function(l){
  var icon=icons[l.status]||icons.available;
  L.marker([parseFloat(l.latitude),parseFloat(l.longitude)],{icon:icon}).addTo(map)
    .bindPopup('<div style="font-family:sans-serif;min-width:140px"><b style="font-size:14px">'+l.name+'</b><br><span style="color:#666;font-size:12px">Slot '+l.slot_number+'</span><br><span style="font-size:12px;font-weight:600;color:'+(l.status==='available'?'#059669':'#DC2626')+'">'+l.status+'</span></div>');
});
</script></body></html>`

  return (
    <View style={s.root}>
      {/* ── Custom header + stats ── */}
      <View style={[s.screenHeader, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.screenHeaderTitle}>Vendor Map</Text>
          <Text style={s.screenHeaderSub}>La Carlota City Saturday Market</Text>
        </View>
        <View style={s.statsRow}>
          {[
            { count: stats.available, color: Colors.emerald,  label: 'Free' },
            { count: stats.occupied,  color: '#EF4444',       label: 'Full' },
          ].map(st => (
            <View key={st.label} style={s.statChip}>
              <Text style={[s.statCount, { color: st.color }]}>{st.count}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Filter + view toggle ── */}
      <View style={s.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.value} style={[s.filterBtn, filter === f.value && s.filterBtnOn]}
              onPress={() => setFilter(f.value)} activeOpacity={0.8}>
              <Ionicons name={f.icon as any} size={13} color={filter === f.value ? '#fff' : Colors.textMuted} />
              <Text style={[s.filterText, filter === f.value && s.filterTextOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.viewToggle} onPress={() => setView(v => v === 'map' ? 'list' : 'map')} activeOpacity={0.8}>
          <Ionicons name={view === 'map' ? 'list-outline' : 'map-outline'} size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={s.loadingText}>Loading map...</Text>
        </View>
      ) : view === 'map' ? (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <WebView source={{ html: mapHtml }} style={{ flex: 1 }} />
        </Animated.View>
      ) : (
        <Animated.ScrollView style={[{ flex: 1 }, { opacity: fadeAnim }]} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="map-outline" size={40} color={Colors.border} />
              <Text style={s.emptyText}>No locations found</Text>
            </View>
          ) : filtered.map(l => {
            const meta = STATUS_META[l.status] ?? STATUS_META.inactive
            return (
              <View key={l.id} style={s.listCard}>
                <View style={[s.listDot, { backgroundColor: meta.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listName}>{l.name}</Text>
                  <Text style={s.listSub}>Slot {l.slot_number}</Text>
                </View>
                <View style={[s.listBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[s.listBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
            )
          })}
        </Animated.ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },

  // Screen header
  screenHeader:      { backgroundColor: Colors.primary, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  screenHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  screenHeaderSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  statsRow:          { flexDirection: 'row', gap: 8 },
  statChip:          { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44 },
  statCount:         { fontSize: 16, fontWeight: '800' },
  statLabel:         { fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 1, fontWeight: '600', textTransform: 'uppercase' },

  // Toolbar
  toolbar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterScroll: { paddingHorizontal: 12, gap: 6 },
  filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff' },
  filterBtnOn:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:   { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  filterTextOn: { color: '#fff' },
  viewToggle:   { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', marginLeft: 4, borderWidth: 1.5, borderColor: Colors.border },

  // Loading / empty
  loadingBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 13, color: Colors.textMuted },
  emptyBox:     { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText:    { fontSize: 14, color: Colors.textMuted },

  // List
  listContent:  { padding: 12, gap: 8 },
  listCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  listDot:      { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  listName:     { fontSize: 14, fontWeight: '700', color: Colors.text },
  listSub:      { fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  listBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  listBadgeText:{ fontSize: 11, fontWeight: '700' },
})
